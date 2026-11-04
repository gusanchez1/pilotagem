import bcrypt from 'bcryptjs';
import { getPermissions } from '../config/permissions.js';
import { signToken } from '../middlewares/auth.js';
import { Instructor, User } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { getSettings } from '../services/settings.service.js';
import { AppError } from '../utils/AppError.js';

async function sessionPayload(user) {
  const settings = await getSettings();
  const instructor = user.instructor ? await Instructor.findById(user.instructor).select('name color specialty').lean() : null;
  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instructor,
      lastLoginAt: user.lastLoginAt,
    },
    permissions: getPermissions(user.role, settings),
    settings: { companyName: settings.companyName, businessHoursStart: settings.businessHoursStart, businessHoursEnd: settings.businessHoursEnd },
  };
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem)
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    await audit(req, {
      action: 'auth.login_failed',
      entity: 'User',
      entityId: user?._id ?? null,
      entityLabel: email,
      summary: `Tentativa de login sem sucesso para ${email}`,
    });
    throw AppError.unauthorized('E-mail ou senha incorretos.');
  }

  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, {
    action: 'auth.login',
    entity: 'User',
    entityId: user._id,
    entityLabel: user.email,
    summary: `${user.name} entrou no sistema`,
  });

  res.json({ token: signToken(user), ...(await sessionPayload(user)) });
}

export async function me(req, res) {
  res.json(await sessionPayload(req.user));
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw AppError.badRequest('A senha atual está incorreta.');
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  user.tokenVersion += 1;
  await user.save();
  await audit(req, { action: 'auth.password_change', entity: 'User', entityId: user._id, entityLabel: user.email, summary: `${user.name} alterou a própria senha` });
  res.json({ token: signToken(user), message: 'Senha alterada com sucesso.' });
}
