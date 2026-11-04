import { APPOINTMENT_NON_BLOCKING, APPOINTMENT_TRANSITIONS, LABELS, ROLES } from '../config/constants.js';
import { Appointment, Client, Package, Reservation, Resource, Room, Sale, Service, nextCode } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { formatDateTime } from '../utils/dates.js';
import { audit } from './audit.service.js';
import { assertAvailable, lockKeysFor } from './availability.service.js';
import { servicePrice } from './finance.calc.js';
import { createSale } from './finance.service.js';
import { withLocks } from './lock.service.js';
import { clientDisplayName } from './privacy.service.js';

const RESERVATION_STATUS_FOR = {
  solicitado: 'pendente',
  agendado: 'confirmada',
  confirmado: 'confirmada',
  em_andamento: 'em_uso',
  concluido: 'concluida',
  cancelado: 'cancelada',
  nao_compareceu: 'cancelada',
};

const isBlocking = (status) => !APPOINTMENT_NON_BLOCKING.includes(status);
const sameIds = (a = [], b = []) => JSON.stringify(a.map(String).sort()) === JSON.stringify(b.map(String).sort());

function historyEntry(req, action, description) {
  return { at: new Date(), by: req?.user?._id, byName: req?.user?.name, action, description };
}

/** Carrega e valida as referências do agendamento (cliente, serviço, sala, equipamentos...). */
async function resolveRefs(data) {
  const [client, service] = await Promise.all([Client.findById(data.client).lean(), Service.findById(data.service).lean()]);
  if (!client || client.active === false) throw AppError.badRequest('Cliente não encontrado ou inativo.');
  if (!service) throw AppError.badRequest('Serviço não encontrado.');

  let pkg = null;
  if (data.package) {
    pkg = await Package.findById(data.package).lean();
    if (!pkg) throw AppError.badRequest('Pacote não encontrado.');
    if (!pkg.items.some((it) => String(it.service) === String(service._id))) {
      throw AppError.badRequest(`O pacote "${pkg.name}" não inclui o serviço "${service.name}".`);
    }
  }

  if (service.requiresInstructor && !data.instructor) {
    throw AppError.badRequest(`O serviço "${service.name}" exige um instrutor.`);
  }

  if (data.room && service.compatibleRooms?.length && !service.compatibleRooms.some((r) => String(r) === String(data.room))) {
    const room = await Room.findById(data.room).lean();
    throw AppError.badRequest(`A sala "${room?.name ?? 'selecionada'}" não é compatível com o serviço "${service.name}".`);
  }
  if (service.requiresRoom && !data.room) {
    throw AppError.badRequest(`Selecione uma sala para o serviço "${service.name}".`);
  }

  const resources = data.resources?.length ? await Resource.find({ _id: { $in: data.resources } }).lean() : [];
  for (const req of service.requiredResources || []) {
    const needed = req.category === 'simulador' && service.pricingMode === 'por_quantidade'
      ? Math.max(req.quantity, data.quantity || 1)
      : req.quantity;
    const selected = resources.filter((r) => r.category === req.category).length;
    if (selected < needed) {
      const label = LABELS.resourceCategory[req.category].toLowerCase();
      throw AppError.badRequest(`Este serviço requer ${needed} ${label}(es). Selecione ${needed - selected} a mais.`);
    }
  }

  return { client, service, pkg };
}

/* ─────────────────────────────── Criação ─────────────────────────────────── */

export async function createAppointment(data, req) {
  const { client, service, pkg } = await resolveRefs(data);
  if (data.sale) {
    const sale = await Sale.findById(data.sale).lean();
    if (!sale || sale.status !== 'ativa' || String(sale.client) !== String(client._id)) {
      throw AppError.badRequest('A venda informada não pertence a este cliente ou está cancelada.');
    }
  }
  const start = new Date(data.start);
  const end = new Date(data.end);
  const quantity = data.quantity || 1;
  const contractedAmount =
    data.contractedAmount ?? (pkg ? 0 : servicePrice(service, quantity));
  const status = data.status || 'agendado';
  const rooms = data.room ? [data.room] : [];
  const resources = data.resources || [];

  const appointment = await withLocks(lockKeysFor({ instructor: data.instructor, rooms, resources }), async () => {
    if (isBlocking(status)) {
      await assertAvailable({ start, end, instructor: data.instructor, rooms, resources });
    }

    const appt = await Appointment.create({
      code: await nextCode('AG'),
      client: client._id,
      service: service._id,
      package: pkg?._id ?? null,
      sale: data.sale || null,
      instructor: data.instructor || null,
      room: data.room || null,
      resources,
      quantity,
      start,
      end,
      contractedAmount,
      origin: data.origin || 'recepcao',
      status,
      notes: data.notes || '',
      history: [historyEntry(req, 'criado', `Agendado para ${formatDateTime(start)}`)],
      createdBy: req?.user?._id,
    });

    // Sessão de pacote já vendido: vincula o agendamento à venda existente
    if (data.sale) {
      await Sale.updateOne({ _id: data.sale, client: client._id }, { $addToSet: { appointments: appt._id } });
    }

    if (rooms.length || resources.length) {
      const reservation = await Reservation.create({
        code: await nextCode('R'),
        title: `${service.name} — ${clientDisplayName(client)}`,
        client: client._id,
        appointment: appt._id,
        rooms,
        resources,
        start,
        end,
        usageType: 'treinamento',
        status: RESERVATION_STATUS_FOR[status],
        createdBy: req?.user?._id,
      });
      appt.reservation = reservation._id;
      await appt.save();
    }
    return appt;
  });

  await audit(req, {
    action: 'appointment.create',
    entity: 'Appointment',
    entityId: appointment._id,
    entityLabel: appointment.code,
    summary: `Agendamento ${appointment.code} criado: ${service.name} em ${formatDateTime(start)}`,
    details: { origem: LABELS.origin[appointment.origin], status: appointment.status },
  });

  // Venda vinculada (opcional) — registrada no financeiro com o preço contratado
  if (data.createSale && contractedAmount > 0) {
    await createSale(
      {
        client: client._id,
        items: [
          {
            type: 'servico',
            service: service._id,
            description:
              service.pricingMode === 'por_quantidade'
                ? `${service.name} — ${quantity} ${service.quantityLabel}${quantity > 1 ? 'es' : ''}`
                : service.name,
            quantity: 1,
            unitPrice: contractedAmount,
          },
        ],
        appointments: [appointment._id],
        paymentTerms: data.paymentTerms || 'antecipado',
        dueDate: data.saleDueDate,
        payments: data.initialPayment ? [data.initialPayment] : [],
      },
      req,
    );
  }

  return Appointment.findById(appointment._id);
}

/* ─────────────────────── Edição / remanejamento ──────────────────────────── */

export async function updateAppointment(id, data, req) {
  const current = await Appointment.findById(id);
  if (!current) throw AppError.notFound('Agendamento não encontrado.');
  if (['cancelado', 'concluido'].includes(current.status)) {
    // Apenas observações podem ser alteradas em agendamentos encerrados
    if (data.notes !== undefined) {
      current.notes = data.notes;
      await current.save();
      return current;
    }
    throw AppError.badRequest('Agendamentos concluídos ou cancelados não podem ser remanejados.');
  }

  const next = {
    client: data.client ?? String(current.client),
    service: data.service ?? String(current.service),
    package: data.package !== undefined ? data.package : current.package && String(current.package),
    instructor: data.instructor !== undefined ? data.instructor : current.instructor && String(current.instructor),
    room: data.room !== undefined ? data.room : current.room && String(current.room),
    resources: data.resources ?? current.resources.map(String),
    quantity: data.quantity ?? current.quantity,
    start: data.start ? new Date(data.start) : current.start,
    end: data.end ? new Date(data.end) : current.end,
  };

  const scheduleChanged =
    next.start.getTime() !== current.start.getTime() ||
    next.end.getTime() !== current.end.getTime() ||
    String(next.instructor || '') !== String(current.instructor || '') ||
    String(next.room || '') !== String(current.room || '') ||
    !sameIds(next.resources, current.resources);

  const { client, service } = await resolveRefs(next);

  const before = {
    start: current.start,
    end: current.end,
    instructor: current.instructor,
    room: current.room,
    resources: current.resources.map(String),
  };
  const rooms = next.room ? [next.room] : [];

  const keys = [
    ...lockKeysFor({ instructor: next.instructor, rooms, resources: next.resources }),
    ...lockKeysFor({ instructor: before.instructor, rooms: before.room ? [before.room] : [], resources: before.resources }),
  ];

  const updated = await withLocks(keys, async () => {
    if (scheduleChanged && isBlocking(current.status)) {
      await assertAvailable({
        start: next.start,
        end: next.end,
        instructor: next.instructor,
        rooms,
        resources: next.resources,
        excludeAppointment: current._id,
        excludeReservation: current.reservation,
      });
    }

    Object.assign(current, {
      client: next.client,
      service: next.service,
      package: next.package || null,
      instructor: next.instructor || null,
      room: next.room || null,
      resources: next.resources,
      quantity: next.quantity,
      start: next.start,
      end: next.end,
    });
    for (const f of ['contractedAmount', 'origin', 'notes']) {
      if (data[f] !== undefined) current[f] = data[f];
    }
    if (scheduleChanged) {
      current.history.push(
        historyEntry(req, 'remanejado', `Remanejado de ${formatDateTime(before.start)} para ${formatDateTime(next.start)}`),
      );
    }

    // Sincroniza a reserva (ocupação de sala/equipamentos)
    const reservationData = {
      title: `${service.name} — ${clientDisplayName(client)}`,
      client: client._id,
      rooms,
      resources: next.resources,
      start: next.start,
      end: next.end,
    };
    if (current.reservation) {
      if (rooms.length || next.resources.length) {
        await Reservation.updateOne({ _id: current.reservation }, { $set: reservationData });
      } else {
        await Reservation.updateOne(
          { _id: current.reservation },
          { $set: { status: 'cancelada', cancelReason: 'Agendamento sem sala/equipamentos', cancelledAt: new Date() } },
        );
        current.reservation = null;
      }
    } else if (rooms.length || next.resources.length) {
      const reservation = await Reservation.create({
        ...reservationData,
        code: await nextCode('R'),
        appointment: current._id,
        usageType: 'treinamento',
        status: RESERVATION_STATUS_FOR[current.status],
        createdBy: req?.user?._id,
      });
      current.reservation = reservation._id;
    }
    await current.save();
    return current;
  });

  await audit(req, {
    action: scheduleChanged ? 'appointment.reschedule' : 'appointment.update',
    entity: 'Appointment',
    entityId: updated._id,
    entityLabel: updated.code,
    summary: scheduleChanged
      ? `Agendamento ${updated.code} remanejado: ${formatDateTime(before.start)} → ${formatDateTime(updated.start)}`
      : `Agendamento ${updated.code} atualizado`,
    details: scheduleChanged
      ? { de: { inicio: before.start, fim: before.end }, para: { inicio: updated.start, fim: updated.end } }
      : null,
  });
  return updated;
}

/* ───────────────────────────────── Status ────────────────────────────────── */

export async function changeAppointmentStatus(id, { status, reason }, req) {
  const appt = await Appointment.findById(id);
  if (!appt) throw AppError.notFound('Agendamento não encontrado.');

  if (req?.user?.role === ROLES.INSTRUTOR) {
    if (!req.user.instructor || String(appt.instructor) !== String(req.user.instructor)) {
      throw AppError.forbidden('Você só pode atualizar os seus próprios treinamentos.');
    }
    if (!['em_andamento', 'concluido', 'nao_compareceu', 'confirmado'].includes(status)) {
      throw AppError.forbidden('Instrutores podem apenas iniciar, concluir ou registrar ausência.');
    }
  }

  const from = appt.status;
  if (from === status) return appt;
  if (!APPOINTMENT_TRANSITIONS[from]?.includes(status)) {
    throw AppError.badRequest(
      `Não é possível alterar de "${LABELS.appointmentStatus[from]}" para "${LABELS.appointmentStatus[status]}".`,
    );
  }
  if (status === 'cancelado' && !reason) throw AppError.badRequest('Informe o motivo do cancelamento.');

  const run = async () => {
    // Voltar de um status que libera o horário exige nova verificação de disponibilidade
    if (!isBlocking(from) && isBlocking(status)) {
      await assertAvailable({
        start: appt.start,
        end: appt.end,
        instructor: appt.instructor,
        rooms: appt.room ? [appt.room] : [],
        resources: appt.resources,
        excludeAppointment: appt._id,
        excludeReservation: appt.reservation,
      });
    }
    appt.status = status;
    if (status === 'cancelado') appt.cancelReason = reason;
    appt.history.push(
      historyEntry(
        req,
        'status',
        `${LABELS.appointmentStatus[from]} → ${LABELS.appointmentStatus[status]}${reason ? ` (${reason})` : ''}`,
      ),
    );
    await appt.save();
    if (appt.reservation) {
      const patch = { status: RESERVATION_STATUS_FOR[status] };
      if (patch.status === 'cancelada') Object.assign(patch, { cancelledAt: new Date(), cancelReason: reason || LABELS.appointmentStatus[status] });
      await Reservation.updateOne({ _id: appt.reservation }, { $set: patch });
    }
  };

  if (!isBlocking(from) && isBlocking(status)) {
    await withLocks(lockKeysFor({ instructor: appt.instructor, rooms: appt.room ? [appt.room] : [], resources: appt.resources }), run);
  } else {
    await run();
  }

  await audit(req, {
    action: status === 'cancelado' ? 'appointment.cancel' : 'appointment.status',
    entity: 'Appointment',
    entityId: appt._id,
    entityLabel: appt.code,
    summary: `Agendamento ${appt.code}: ${LABELS.appointmentStatus[from]} → ${LABELS.appointmentStatus[status]}${reason ? ` — ${reason}` : ''}`,
    details: { de: from, para: status, motivo: reason || null },
  });
  return appt;
}

export async function addSessionNote(id, text, req) {
  const appt = await Appointment.findById(id);
  if (!appt) throw AppError.notFound('Agendamento não encontrado.');
  if (req?.user?.role === ROLES.INSTRUTOR && String(appt.instructor) !== String(req.user.instructor)) {
    throw AppError.forbidden('Você só pode registrar observações nos seus próprios treinamentos.');
  }
  appt.sessionNotes.push({ author: req.user._id, authorName: req.user.name, text });
  await appt.save();
  await audit(req, {
    action: 'appointment.note',
    entity: 'Appointment',
    entityId: appt._id,
    entityLabel: appt.code,
    summary: `Observação de sessão registrada no agendamento ${appt.code}`,
  });
  return appt;
}
