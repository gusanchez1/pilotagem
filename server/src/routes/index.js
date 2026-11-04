import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS as P } from '../config/permissions.js';
import { exportReport, getDashboard, getReport, listReports } from '../controllers/reports.controller.js';
import { authenticate, permit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { dashboardQuery, reportQuery } from '../validators/schemas.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import financeRoutes from './finance.routes.js';
import operationsRoutes from './operations.routes.js';
import registryRoutes from './registry.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ status: 'ok', app: 'PILOTAGEM', time: new Date().toISOString() }));
api.use('/auth', authRoutes);

// Todas as rotas abaixo exigem autenticação
api.use(authenticate);

api.get('/dashboard', permit(P.DASHBOARD_VIEW), validate({ query: dashboardQuery }), getDashboard);

const reportParams = z.object({ key: z.string().regex(/^[a-z-]{3,40}$/) });
api.get('/reports', permit(P.REPORTS_FINANCIAL, P.REPORTS_OPERATIONAL), listReports);
api.get('/reports/:key', validate({ params: reportParams, query: reportQuery }), getReport);
api.get('/reports/:key/export', validate({ params: reportParams, query: reportQuery }), exportReport);

api.use(registryRoutes);
api.use(operationsRoutes);
api.use(financeRoutes);
api.use(adminRoutes);

export default api;
