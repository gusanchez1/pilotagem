import { Router } from 'express';
import { PERMISSIONS as P } from '../config/permissions.js';
import { demoReset, getSettingsHandler, listAudit, updateSettingsHandler } from '../controllers/admin.controller.js';
import { createUser, listUsers, resetPassword, updateUser } from '../controllers/users.controller.js';
import { permit } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { auditListQuery, resetPasswordSchema, settingsSchema, userCreateSchema, userUpdateSchema } from '../validators/schemas.js';

const router = Router();

router.get('/users', permit(P.USERS_MANAGE), listUsers);
router.post('/users', permit(P.USERS_MANAGE), validate({ body: userCreateSchema }), createUser);
router.patch('/users/:id', permit(P.USERS_MANAGE), validate({ params: idParams, body: userUpdateSchema }), updateUser);
router.post('/users/:id/reset-password', permit(P.USERS_MANAGE), validate({ params: idParams, body: resetPasswordSchema }), resetPassword);

router.get('/settings', permit(P.SETTINGS_MANAGE), getSettingsHandler);
router.patch('/settings', permit(P.SETTINGS_MANAGE), validate({ body: settingsSchema }), updateSettingsHandler);

router.get('/audit', permit(P.AUDIT_VIEW), validate({ query: auditListQuery }), listAudit);

router.post('/admin/demo-reset', permit(P.DEMO_RESET), demoReset);

export default router;
