import { Router } from 'express';
import { PERMISSIONS as P } from '../config/permissions.js';
import {
  getAppointment,
  getOccupancyNow,
  getReservation,
  getTimeline,
  listAppointments,
  listReservations,
  patchAppointment,
  patchReservation,
  portalAgenda,
  portalNote,
  portalStatus,
  portalSummary,
  postAppointment,
  postAppointmentNote,
  postAppointmentStatus,
  postAvailabilityCheck,
  postReservation,
  postReservationCancel,
  postReservationStatus,
} from '../controllers/operations.controller.js';
import { permit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParams, periodQuery } from '../validators/common.js';
import {
  appointmentCreateSchema,
  appointmentListQuery,
  appointmentStatusSchema,
  appointmentUpdateSchema,
  availabilitySchema,
  noteSchema,
  reasonSchema,
  reservationCreateSchema,
  reservationListQuery,
  reservationStatusSchema,
  reservationUpdateSchema,
  timelineQuery,
} from '../validators/schemas.js';

/** Operação: agenda, portal do instrutor, reservas e disponibilidade. */
const router = Router();

/* Agendamentos */
router.get('/appointments', permit(P.APPOINTMENTS_VIEW), validate({ query: appointmentListQuery }), listAppointments);
router.post('/appointments', permit(P.APPOINTMENTS_MANAGE), validate({ body: appointmentCreateSchema }), postAppointment);
router.get('/appointments/:id', permit(P.APPOINTMENTS_VIEW), validate({ params: idParams }), getAppointment);
router.patch('/appointments/:id', permit(P.APPOINTMENTS_MANAGE), validate({ params: idParams, body: appointmentUpdateSchema }), patchAppointment);
router.post(
  '/appointments/:id/status',
  permit(P.APPOINTMENTS_MANAGE),
  validate({ params: idParams, body: appointmentStatusSchema }),
  postAppointmentStatus,
);
router.post('/appointments/:id/notes', permit(P.APPOINTMENTS_MANAGE), validate({ params: idParams, body: noteSchema }), postAppointmentNote);

/* Portal do instrutor — sempre restrito aos próprios treinamentos */
router.get('/portal/summary', permit(P.PORTAL_VIEW), portalSummary);
router.get('/portal/agenda', permit(P.PORTAL_VIEW), validate({ query: periodQuery }), portalAgenda);
router.post(
  '/portal/appointments/:id/status',
  permit(P.PORTAL_VIEW),
  permit(P.APPOINTMENTS_UPDATE_STATUS),
  validate({ params: idParams, body: appointmentStatusSchema }),
  portalStatus,
);
router.post('/portal/appointments/:id/notes', permit(P.PORTAL_VIEW), validate({ params: idParams, body: noteSchema }), portalNote);

/* Reservas */
router.get('/reservations', permit(P.RESERVATIONS_VIEW), validate({ query: reservationListQuery }), listReservations);
router.post('/reservations', permit(P.RESERVATIONS_MANAGE), validate({ body: reservationCreateSchema }), postReservation);
router.get('/reservations/:id', permit(P.RESERVATIONS_VIEW), validate({ params: idParams }), getReservation);
router.patch('/reservations/:id', permit(P.RESERVATIONS_MANAGE), validate({ params: idParams, body: reservationUpdateSchema }), patchReservation);
router.post('/reservations/:id/cancel', permit(P.RESERVATIONS_MANAGE), validate({ params: idParams, body: reasonSchema }), postReservationCancel);
router.post(
  '/reservations/:id/status',
  permit(P.RESERVATIONS_MANAGE),
  validate({ params: idParams, body: reservationStatusSchema }),
  postReservationStatus,
);

/* Disponibilidade */
router.post('/availability/check', permit(P.APPOINTMENTS_VIEW, P.RESERVATIONS_VIEW), validate({ body: availabilitySchema }), postAvailabilityCheck);
router.get('/availability/timeline', permit(P.RESERVATIONS_VIEW, P.APPOINTMENTS_VIEW), validate({ query: timelineQuery }), getTimeline);
router.get('/availability/now', permit(P.ROOMS_VIEW, P.APPOINTMENTS_VIEW), getOccupancyNow);

export default router;
