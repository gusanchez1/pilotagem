import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS as P } from '../config/permissions.js';
import {
  clientAppointments,
  clientFinance,
  createClient,
  getClient,
  listClients,
  revealClient,
  updateClient,
} from '../controllers/clients.controller.js';
import { instructorAgenda, instructors, packages, resources, rooms, services } from '../controllers/catalog.controller.js';
import { permit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParams, periodQuery } from '../validators/common.js';
import {
  clientCreateSchema,
  clientListQuery,
  clientUpdateSchema,
  instructorSchema,
  packageSchema,
  resourceSchema,
  roomSchema,
  serviceSchema,
} from '../validators/schemas.js';

/** Cadastros: clientes, instrutores, serviços, pacotes, salas e equipamentos. */
const router = Router();

/* Clientes */
router.get('/clients', permit(P.CLIENTS_VIEW), validate({ query: clientListQuery }), listClients);
router.post('/clients', permit(P.CLIENTS_MANAGE), validate({ body: clientCreateSchema }), createClient);
router.get('/clients/:id', permit(P.CLIENTS_VIEW), validate({ params: idParams }), getClient);
router.post('/clients/:id/reveal', permit(P.CLIENTS_CONFIDENTIAL), validate({ params: idParams }), revealClient);
router.patch('/clients/:id', permit(P.CLIENTS_MANAGE), validate({ params: idParams, body: clientUpdateSchema }), updateClient);
router.get('/clients/:id/appointments', permit(P.APPOINTMENTS_VIEW), validate({ params: idParams }), clientAppointments);
router.get('/clients/:id/finance', permit(P.SALES_VIEW), validate({ params: idParams }), clientFinance);

/* Fábrica de rotas CRUD com permissões de leitura e escrita */
const statusSchema = z.object({ active: z.boolean().optional(), status: z.string().trim().max(30).optional() });

function crudRoutes(path, handlers, schema, { view, manage }) {
  router.get(path, permit(...view), handlers.list);
  router.get(`${path}/:id`, permit(...view), validate({ params: idParams }), handlers.get);
  router.post(path, permit(manage), validate({ body: schema }), handlers.create);
  router.put(`${path}/:id`, permit(manage), validate({ params: idParams, body: schema }), handlers.update);
  router.patch(`${path}/:id/status`, permit(manage), validate({ params: idParams, body: statusSchema }), handlers.setStatus);
}

crudRoutes('/instructors', instructors, instructorSchema, {
  view: [P.INSTRUCTORS_VIEW, P.APPOINTMENTS_VIEW],
  manage: P.INSTRUCTORS_MANAGE,
});
router.get(
  '/instructors/:id/agenda',
  permit(P.INSTRUCTORS_VIEW, P.APPOINTMENTS_VIEW),
  validate({ params: idParams, query: periodQuery }),
  instructorAgenda,
);

crudRoutes('/services', services, serviceSchema, { view: [P.CATALOG_VIEW, P.APPOINTMENTS_VIEW], manage: P.CATALOG_MANAGE });
crudRoutes('/packages', packages, packageSchema, { view: [P.CATALOG_VIEW, P.APPOINTMENTS_VIEW], manage: P.CATALOG_MANAGE });
crudRoutes('/rooms', rooms, roomSchema, { view: [P.ROOMS_VIEW], manage: P.ROOMS_MANAGE });
crudRoutes('/resources', resources, resourceSchema, { view: [P.ROOMS_VIEW], manage: P.ROOMS_MANAGE });

export default router;
