import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getPermissions } from '../config/permissions.js';
import { User } from '../models/index.js';
import { getSettings } from '../services/settings.service.js';
import { AppError } from '../utils/AppError.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Autenticação JWT. O usuário é recarregado a cada requisição para que desativações,
 * trocas de senha e mudanças de perfil tenham efeito imediato.
 */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw AppError.unauthorized('Autenticação necessária.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw AppError.unauthorized();
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || !user.active || (user.tokenVersion ?? 0) !== payload.tv) {
    throw AppError.unauthorized();
  }

  const settings = await getSettings();
  req.user = { ...user, permissions: getPermissions(user.role, settings) };
  next();
}

/** Exige ao menos UMA das permissões informadas. */
export function permit(...permissions) {
  return (req, _res, next) => {
    const granted = req.user?.permissions || [];
    if (!permissions.some((p) => granted.includes(p))) throw AppError.forbidden();
    next();
  };
}
