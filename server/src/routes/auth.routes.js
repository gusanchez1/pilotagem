import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { changePassword, login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { changePasswordSchema, loginSchema } from '../validators/schemas.js';

const router = Router();

/** Limita tentativas de login (proteção contra força bruta). */
const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Muitas tentativas de login. Aguarde um minuto e tente novamente.', code: 'RATE_LIMIT' } },
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), changePassword);

export default router;
