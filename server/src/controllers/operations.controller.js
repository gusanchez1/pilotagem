import { APPOINTMENT_NON_BLOCKING, RESERVATION_NON_BLOCKING } from '../config/constants.js';
import { Appointment, Instructor, Reservation, Resource, Room } from '../models/index.js';
import {
  addSessionNote,
  changeAppointmentStatus,
  createAppointment,
  updateAppointment,
} from '../services/appointment.service.js';
import { checkAvailability } from '../services/availability.service.js';
import {
  APPOINTMENT_POPULATE,
  RESERVATION_POPULATE,
  presentAppointment,
  presentReservation,
} from '../services/presenters.js';
import {
  cancelReservation,
  createReservation,
  setReservationStatus,
  updateReservation,
} from '../services/reservation.service.js';
import { AppError } from '../utils/AppError.js';
import { endOfDayExclusive, resolvePeriod, startOfDay, toDateKey } from '../utils/dates.js';
import { pageResult, paginate } from '../utils/pagination.js';

/* ───────────────────────────── Agendamentos ──────────────────────────────── */

function appointmentFilter(q) {
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.start = { $gte: start, $lt: end };
  }
  for (const f of ['instructor', 'room', 'client', 'service']) if (q[f]) filter[f] = q[f];
  if (q.status?.length) filter.status = { $in: q.status };
  if (q.origin?.length) filter.origin = { $in: q.origin };
  return filter;
}

export async function listAppointments(req, res) {
  const q = req.validQuery;
  const filter = appointmentFilter(q);
  const page = paginate(q, { defaultLimit: 500, maxLimit: 1000 });
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ start: 1 }).skip(page.skip).limit(page.limit).populate(APPOINTMENT_POPULATE).lean(),
    Appointment.countDocuments(filter),
  ]);
  res.json(pageResult(items.map((a) => presentAppointment(a, req.user)), total, page));
}

async function loadAppointment(id, user) {
  const appt = await Appointment.findById(id)
    .populate(APPOINTMENT_POPULATE)
    .populate({ path: 'reservation', select: 'code status' })
    .lean();
  if (!appt) throw AppError.notFound('Agendamento não encontrado.');
  return presentAppointment(appt, user);
}

export async function getAppointment(req, res) {
  res.json(await loadAppointment(req.validParams.id, req.user));
}

export async function postAppointment(req, res) {
  const appt = await createAppointment(req.body, req);
  res.status(201).json(await loadAppointment(appt._id, req.user));
}

export async function patchAppointment(req, res) {
  const appt = await updateAppointment(req.validParams.id, req.body, req);
  res.json(await loadAppointment(appt._id, req.user));
}

export async function postAppointmentStatus(req, res) {
  const appt = await changeAppointmentStatus(req.validParams.id, req.body, req);
  res.json(await loadAppointment(appt._id, req.user));
}

export async function postAppointmentNote(req, res) {
  const appt = await addSessionNote(req.validParams.id, req.body.text, req);
  res.json(await loadAppointment(appt._id, req.user));
}

/* ─────────────────────────────── Portal do instrutor ─────────────────────── */

function assertOwnInstructor(req) {
  if (!req.user.instructor) throw AppError.forbidden('Seu usuário não está vinculado a um instrutor.');
  return req.user.instructor;
}

export async function portalAgenda(req, res) {
  const instructor = assertOwnInstructor(req);
  const today = toDateKey();
  const from = req.validQuery.from || today;
  const to = req.validQuery.to || from;
  const { start, end } = resolvePeriod(from, to);
  const items = await Appointment.find({ instructor, start: { $gte: start, $lt: end } })
    .sort({ start: 1 })
    .populate(APPOINTMENT_POPULATE)
    .lean();
  res.json(items.map((a) => presentAppointment(a, req.user)));
}

export async function portalSummary(req, res) {
  const instructor = assertOwnInstructor(req);
  const today = toDateKey();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDayExclusive(today);
  const [todayItems, upcoming, completedMonth, profile] = await Promise.all([
    Appointment.find({ instructor, start: { $gte: dayStart, $lt: dayEnd } }).sort({ start: 1 }).populate(APPOINTMENT_POPULATE).lean(),
    Appointment.find({ instructor, start: { $gte: dayEnd }, status: { $nin: APPOINTMENT_NON_BLOCKING } })
      .sort({ start: 1 })
      .limit(15)
      .populate(APPOINTMENT_POPULATE)
      .lean(),
    Appointment.countDocuments({ instructor, status: 'concluido', start: { $gte: resolvePeriod().start, $lt: dayEnd } }),
    Instructor.findById(instructor).lean(),
  ]);
  res.json({
    instructor: profile,
    today: todayItems.map((a) => presentAppointment(a, req.user)),
    upcoming: upcoming.map((a) => presentAppointment(a, req.user)),
    completedThisMonth: completedMonth,
  });
}

export async function portalStatus(req, res) {
  assertOwnInstructor(req);
  const appt = await changeAppointmentStatus(req.validParams.id, req.body, req);
  res.json(await loadAppointment(appt._id, req.user));
}

export async function portalNote(req, res) {
  assertOwnInstructor(req);
  const appt = await addSessionNote(req.validParams.id, req.body.text, req);
  res.json(await loadAppointment(appt._id, req.user));
}

/* ──────────────────────────────── Reservas ───────────────────────────────── */

export async function listReservations(req, res) {
  const q = req.validQuery;
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.start = { $lt: end };
    filter.end = { $gt: start };
  }
  if (q.room) filter.rooms = q.room;
  if (q.resource) filter.resources = q.resource;
  if (q.status?.length) filter.status = { $in: q.status };
  if (q.usageType?.length) filter.usageType = { $in: q.usageType };
  const page = paginate(q, { defaultLimit: 500, maxLimit: 1000 });
  const [items, total] = await Promise.all([
    Reservation.find(filter).sort({ start: 1 }).skip(page.skip).limit(page.limit).populate(RESERVATION_POPULATE).lean(),
    Reservation.countDocuments(filter),
  ]);
  res.json(pageResult(items.map((r) => presentReservation(r, req.user)), total, page));
}

async function loadReservation(id, user) {
  const r = await Reservation.findById(id).populate(RESERVATION_POPULATE).lean();
  if (!r) throw AppError.notFound('Reserva não encontrada.');
  return presentReservation(r, user);
}

export async function getReservation(req, res) {
  res.json(await loadReservation(req.validParams.id, req.user));
}

export async function postReservation(req, res) {
  const r = await createReservation(req.body, req);
  res.status(201).json(await loadReservation(r._id, req.user));
}

export async function patchReservation(req, res) {
  const r = await updateReservation(req.validParams.id, req.body, req);
  res.json(await loadReservation(r._id, req.user));
}

export async function postReservationCancel(req, res) {
  const r = await cancelReservation(req.validParams.id, req.body.reason, req);
  res.json(await loadReservation(r._id, req.user));
}

export async function postReservationStatus(req, res) {
  const r = await setReservationStatus(req.validParams.id, req.body.status, req);
  res.json(await loadReservation(r._id, req.user));
}

/* ───────────────────────────── Disponibilidade ───────────────────────────── */

export async function postAvailabilityCheck(req, res) {
  const b = req.body;
  const rooms = [...b.rooms, ...(b.room ? [b.room] : [])];
  const result = await checkAvailability({ ...b, rooms });
  res.json(result);
}

/**
 * Linha do tempo de um dia: cada sala/equipamento/instrutor com suas ocupações.
 * Base da visão "quadro de disponibilidade".
 */
export async function getTimeline(req, res) {
  const date = req.validQuery.date || toDateKey();
  const start = startOfDay(date);
  const end = endOfDayExclusive(date);
  const [rooms, resources, instructors, reservations, appointments] = await Promise.all([
    Room.find().sort({ code: 1 }).lean(),
    Resource.find().sort({ category: 1, code: 1 }).lean(),
    Instructor.find({ active: true }).sort({ name: 1 }).lean(),
    Reservation.find({ start: { $lt: end }, end: { $gt: start }, status: { $nin: RESERVATION_NON_BLOCKING } })
      .populate(RESERVATION_POPULATE)
      .lean(),
    Appointment.find({ start: { $lt: end }, end: { $gt: start }, instructor: { $ne: null }, status: { $nin: APPOINTMENT_NON_BLOCKING } })
      .populate(APPOINTMENT_POPULATE)
      .lean(),
  ]);

  const presentedRes = reservations.map((r) => presentReservation(r, req.user));
  const presentedAppts = appointments.map((a) => presentAppointment(a, req.user));
  const slim = (r) => ({
    _id: r._id,
    code: r.code,
    title: r.title,
    start: r.start,
    end: r.end,
    usageType: r.usageType,
    status: r.status,
    appointment: r.appointment?._id ?? null,
    client: r.client ? { displayName: r.client.displayName, confidential: r.client.confidential } : null,
  });

  res.json({
    date,
    rooms: rooms.map((room) => ({
      ...room,
      bookings: presentedRes.filter((r) => r.rooms.some((x) => String(x._id) === String(room._id))).map(slim),
    })),
    resources: resources.map((resource) => ({
      ...resource,
      bookings: presentedRes.filter((r) => r.resources.some((x) => String(x._id) === String(resource._id))).map(slim),
    })),
    instructors: instructors.map((inst) => ({
      ...inst,
      bookings: presentedAppts
        .filter((a) => String(a.instructor?._id) === String(inst._id))
        .map((a) => ({
          _id: a._id,
          code: a.code,
          title: a.service?.name,
          start: a.start,
          end: a.end,
          status: a.status,
          appointment: a._id,
          client: a.client ? { displayName: a.client.displayName, confidential: a.client.confidential } : null,
        })),
    })),
  });
}

/** Ocupação atual das salas (para o dashboard e a tela de salas). */
export async function getOccupancyNow(_req, res) {
  const now = new Date();
  const [rooms, current] = await Promise.all([
    Room.find().sort({ code: 1 }).lean(),
    Reservation.find({ start: { $lte: now }, end: { $gt: now }, status: { $nin: RESERVATION_NON_BLOCKING } }).lean(),
  ]);
  res.json(
    rooms.map((room) => {
      const booking = current.find((r) => r.rooms.some((x) => String(x) === String(room._id)));
      return {
        _id: room._id,
        name: room.name,
        code: room.code,
        status: room.status,
        occupied: Boolean(booking),
        usageType: booking?.usageType ?? null,
        until: booking?.end ?? null,
      };
    }),
  );
}
