import { APPOINTMENT_NON_BLOCKING, LABELS, RESERVATION_NON_BLOCKING } from '../config/constants.js';
import { Appointment, Instructor, Reservation, Resource, Room } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { toTimeKey, formatDate } from '../utils/dates.js';

/**
 * Regras de disponibilidade.
 *
 * Dois intervalos [a1, a2) e [b1, b2) conflitam quando a1 < b2 && b1 < a2.
 * - Salas e equipamentos: ocupação vem das RESERVAS não canceladas (inclui manutenção, locação...).
 * - Instrutor: ocupação vem dos AGENDAMENTOS que bloqueiam horário.
 * - Sala fora de "ativa" ou equipamento fora de "disponivel" não pode ser reservado.
 * Cada recurso é validado individualmente e todos os conflitos são retornados.
 */

const ids = (list = []) => [...new Set(list.filter(Boolean).map(String))];

export function lockKeysFor({ instructor, rooms = [], resources = [] }) {
  return [
    ...(instructor ? [`instructor:${instructor}`] : []),
    ...ids(rooms).map((id) => `room:${id}`),
    ...ids(resources).map((id) => `resource:${id}`),
  ];
}

function span(start, end) {
  return `${formatDate(start)} das ${toTimeKey(start)} às ${toTimeKey(end)}`;
}

export async function checkAvailability({
  start,
  end,
  instructor = null,
  rooms = [],
  resources = [],
  usageType = 'treinamento',
  excludeAppointment = null,
  excludeReservation = null,
}) {
  start = new Date(start);
  end = new Date(end);
  if (!(start < end)) throw AppError.badRequest('O horário de término deve ser posterior ao de início.');

  const roomIds = ids(rooms);
  const resourceIds = ids(resources);
  const conflicts = [];
  const sharedRooms = new Set();

  const overlap = { start: { $lt: end }, end: { $gt: start } };

  // ── Salas ────────────────────────────────────────────────
  if (roomIds.length) {
    const docs = await Room.find({ _id: { $in: roomIds } }).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    for (const id of roomIds) {
      const room = byId.get(id);
      if (room?.shared) sharedRooms.add(id);
      if (!room) {
        conflicts.push({ type: 'room', id, name: 'Sala', reason: 'not_found', message: 'Sala não encontrada.' });
      } else if (room.status !== 'ativa') {
        conflicts.push({
          type: 'room',
          id,
          name: room.name,
          reason: room.status,
          message: `${room.name} está ${room.status === 'manutencao' ? 'em manutenção' : 'inativa'} e não pode ser reservada.`,
        });
      }
    }
  }

  // ── Equipamentos ─────────────────────────────────────────
  if (resourceIds.length) {
    const docs = await Resource.find({ _id: { $in: resourceIds } }).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    for (const id of resourceIds) {
      const res = byId.get(id);
      if (!res) {
        conflicts.push({ type: 'resource', id, name: 'Equipamento', reason: 'not_found', message: 'Equipamento não encontrado.' });
      } else if (res.status !== 'disponivel') {
        conflicts.push({
          type: 'resource',
          id,
          name: res.name,
          reason: res.status,
          message: `${res.name} está ${res.status === 'manutencao' ? 'em manutenção' : 'inativo'} e não pode ser reservado.`,
        });
      }
    }
  }

  // ── Reservas sobrepostas (salas e equipamentos) ──────────
  if (roomIds.length || resourceIds.length) {
    const filter = {
      ...overlap,
      status: { $nin: RESERVATION_NON_BLOCKING },
      $or: [
        ...(roomIds.length ? [{ rooms: { $in: roomIds } }] : []),
        ...(resourceIds.length ? [{ resources: { $in: resourceIds } }] : []),
      ],
    };
    if (excludeReservation) filter._id = { $ne: excludeReservation };
    const busy = await Reservation.find(filter)
      .populate('rooms', 'name')
      .populate('resources', 'name')
      .lean();

    for (const r of busy) {
      const withInfo = { kind: 'reservation', code: r.code, title: r.title, start: r.start, end: r.end, usageType: r.usageType };
      const usage = LABELS.usageType[r.usageType] || r.usageType;
      for (const room of r.rooms) {
        // Sala compartilhada: treinamentos simultâneos são permitidos (equipamentos validados à parte)
        const coexist = sharedRooms.has(String(room._id)) && usageType === 'treinamento' && r.usageType === 'treinamento';
        if (roomIds.includes(String(room._id)) && !coexist) {
          conflicts.push({
            type: 'room',
            id: String(room._id),
            name: room.name,
            reason: 'occupied',
            message: `${room.name} já está reservada em ${span(r.start, r.end)} (${usage} · ${r.code}).`,
            with: withInfo,
          });
        }
      }
      for (const res of r.resources) {
        if (resourceIds.includes(String(res._id))) {
          conflicts.push({
            type: 'resource',
            id: String(res._id),
            name: res.name,
            reason: 'occupied',
            message: `${res.name} já está reservado em ${span(r.start, r.end)} (${usage} · ${r.code}).`,
            with: withInfo,
          });
        }
      }
    }
  }

  // ── Instrutor ────────────────────────────────────────────
  if (instructor) {
    const inst = await Instructor.findById(instructor).lean();
    if (!inst) {
      conflicts.push({ type: 'instructor', id: String(instructor), name: 'Instrutor', reason: 'not_found', message: 'Instrutor não encontrado.' });
    } else {
      if (!inst.active) {
        conflicts.push({ type: 'instructor', id: String(inst._id), name: inst.name, reason: 'inactive', message: `${inst.name} está inativo.` });
      }
      const filter = { instructor: inst._id, status: { $nin: APPOINTMENT_NON_BLOCKING }, ...overlap };
      if (excludeAppointment) filter._id = { $ne: excludeAppointment };
      const busy = await Appointment.find(filter).populate('service', 'name').lean();
      for (const a of busy) {
        conflicts.push({
          type: 'instructor',
          id: String(inst._id),
          name: inst.name,
          reason: 'occupied',
          message: `${inst.name} já tem ${a.service?.name || 'um treinamento'} em ${span(a.start, a.end)} (${a.code}).`,
          with: { kind: 'appointment', code: a.code, title: a.service?.name, start: a.start, end: a.end },
        });
      }
    }
  }

  return { available: conflicts.length === 0, conflicts };
}

export async function assertAvailable(params) {
  const result = await checkAvailability(params);
  if (!result.available) {
    const message =
      result.conflicts.length === 1
        ? result.conflicts[0].message
        : `Foram encontrados ${result.conflicts.length} conflitos de disponibilidade.`;
    throw AppError.conflict(message, { conflicts: result.conflicts });
  }
  return result;
}
