import { LABELS } from '../config/constants.js';
import { Client, Reservation, nextCode } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { formatDateTime } from '../utils/dates.js';
import { audit } from './audit.service.js';
import { assertAvailable, lockKeysFor } from './availability.service.js';
import { createSale } from './finance.service.js';
import { withLocks } from './lock.service.js';

/**
 * Reservas avulsas de salas/equipamentos (locação, evento, uso interno, manutenção).
 * Reservas criadas por agendamentos são gerenciadas pelo próprio agendamento.
 */

function assertHasTargets(rooms, resources) {
  if (!rooms.length && !resources.length) {
    throw AppError.badRequest('Selecione ao menos uma sala ou um equipamento.');
  }
}

export async function createReservation(data, req) {
  const rooms = [...new Set(data.rooms || [])];
  const resources = [...new Set(data.resources || [])];
  assertHasTargets(rooms, resources);
  const start = new Date(data.start);
  const end = new Date(data.end);

  if (data.client && !(await Client.exists({ _id: data.client }))) throw AppError.badRequest('Cliente não encontrado.');

  const reservation = await withLocks(lockKeysFor({ rooms, resources }), async () => {
    await assertAvailable({ start, end, rooms, resources, usageType: data.usageType });
    return Reservation.create({
      code: await nextCode('R'),
      title: data.title,
      client: data.client || null,
      responsible: data.responsible || '',
      rooms,
      resources,
      start,
      end,
      usageType: data.usageType,
      amount: data.amount || 0,
      status: data.status || 'confirmada',
      notes: data.notes || '',
      createdBy: req?.user?._id,
    });
  });

  await audit(req, {
    action: 'reservation.create',
    entity: 'Reservation',
    entityId: reservation._id,
    entityLabel: reservation.code,
    summary: `Reserva ${reservation.code} (${LABELS.usageType[reservation.usageType]}) criada para ${formatDateTime(start)}`,
    details: { salas: rooms.length, equipamentos: resources.length },
  });

  // Locações/eventos podem gerar a venda correspondente
  if (data.createSale && reservation.amount > 0) {
    const sale = await createSale(
      {
        client: data.client || null,
        items: [
          {
            type: reservation.usageType === 'locacao' ? 'locacao' : 'personalizado',
            description: reservation.title,
            modality: reservation.usageType === 'evento' ? 'Eventos' : 'Locação',
            quantity: 1,
            unitPrice: reservation.amount,
          },
        ],
        reservation: reservation._id,
        paymentTerms: 'antecipado',
      },
      req,
    );
    reservation.sale = sale._id;
    await reservation.save();
  }
  return reservation;
}

export async function updateReservation(id, data, req) {
  const current = await Reservation.findById(id);
  if (!current) throw AppError.notFound('Reserva não encontrada.');
  if (current.appointment) {
    throw AppError.badRequest('Esta reserva pertence a um agendamento. Edite o agendamento para remanejá-la.');
  }
  if (['cancelada', 'concluida'].includes(current.status)) {
    throw AppError.badRequest('Reservas canceladas ou concluídas não podem ser alteradas.');
  }

  const rooms = data.rooms ?? current.rooms.map(String);
  const resources = data.resources ?? current.resources.map(String);
  assertHasTargets(rooms, resources);
  const start = data.start ? new Date(data.start) : current.start;
  const end = data.end ? new Date(data.end) : current.end;
  const before = { start: current.start, end: current.end };

  const keys = [
    ...lockKeysFor({ rooms, resources }),
    ...lockKeysFor({ rooms: current.rooms, resources: current.resources }),
  ];
  await withLocks(keys, async () => {
    await assertAvailable({
      start,
      end,
      rooms,
      resources,
      usageType: data.usageType ?? current.usageType,
      excludeReservation: current._id,
    });
    Object.assign(current, { rooms, resources, start, end });
    for (const f of ['title', 'client', 'responsible', 'usageType', 'amount', 'status', 'notes']) {
      if (data[f] !== undefined) current[f] = data[f];
    }
    await current.save();
  });

  const moved = before.start.getTime() !== start.getTime() || before.end.getTime() !== end.getTime();
  await audit(req, {
    action: moved ? 'reservation.reschedule' : 'reservation.update',
    entity: 'Reservation',
    entityId: current._id,
    entityLabel: current.code,
    summary: moved
      ? `Reserva ${current.code} remanejada: ${formatDateTime(before.start)} → ${formatDateTime(start)}`
      : `Reserva ${current.code} atualizada`,
  });
  return current;
}

export async function cancelReservation(id, reason, req) {
  const current = await Reservation.findById(id);
  if (!current) throw AppError.notFound('Reserva não encontrada.');
  if (current.appointment) {
    throw AppError.badRequest('Esta reserva pertence a um agendamento. Cancele o agendamento.');
  }
  if (current.status === 'cancelada') throw AppError.badRequest('Esta reserva já está cancelada.');
  current.status = 'cancelada';
  current.cancelReason = reason;
  current.cancelledAt = new Date();
  await current.save();
  await audit(req, {
    action: 'reservation.cancel',
    entity: 'Reservation',
    entityId: current._id,
    entityLabel: current.code,
    summary: `Reserva ${current.code} cancelada — ${reason}`,
  });
  return current;
}

export async function setReservationStatus(id, status, req) {
  const current = await Reservation.findById(id);
  if (!current) throw AppError.notFound('Reserva não encontrada.');
  if (current.appointment) throw AppError.badRequest('Atualize o status pelo agendamento vinculado.');
  if (status === 'cancelada') throw AppError.badRequest('Use a opção "Cancelar reserva" e informe o motivo.');
  if (current.status === 'cancelada') throw AppError.badRequest('Reservas canceladas não podem ser reativadas.');
  const from = current.status;
  current.status = status;
  await current.save();
  await audit(req, {
    action: 'reservation.status',
    entity: 'Reservation',
    entityId: current._id,
    entityLabel: current.code,
    summary: `Reserva ${current.code}: ${LABELS.reservationStatus[from]} → ${LABELS.reservationStatus[status]}`,
  });
  return current;
}
