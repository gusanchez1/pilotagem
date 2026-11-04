import bcrypt from 'bcryptjs';
import { LABELS, ROLES } from '../config/constants.js';
import { Instructor, User } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { AppError } from '../utils/AppError.js';

async function assertInstructorLink(role, instructor) {
  if (role === ROLES.INSTRUTOR) {
    if (!instructor) throw AppError.badRequest('Vincule o usuário a um instrutor cadastrado.');
    if (!(await Instructor.exists({ _id: instructor }))) throw AppError.badRequest('Instrutor não encontrado.');
  }
}

export async function listUsers(_req, res) {
  const users = await User.find().populate('instructor', 'name').sort({ role: 1, name: 1 }).lean();
  res.json(users);
}

export async function createUser(req, res) {
  const { password, ...data } = req.body;
  await assertInstructorLink(data.role, data.instructor);
  const user = await User.create({
    ...data,
    instructor: data.role === ROLES.INSTRUTOR ? data.instructor : null,
    passwordHash: await bcrypt.hash(password, 10),
  });
  await audit(req, {
    action: 'user.create',
    entity: 'User',
    entityId: user._id,
    entityLabel: user.email,
    summary: `Usuário ${user.name} criado com perfil ${LABELS.role[user.role]}`,
  });
  const safe = user.toObject();
  delete safe.passwordHash;
  res.status(201).json(safe);
}

export async function updateUser(req, res) {
  const user = await User.findById(req.validParams.id);
  if (!user) throw AppError.notFound('Usuário não encontrado.');
  const data = req.body;

  if (String(user._id) === String(req.user._id) && (data.active === false || (data.role && data.role !== user.role))) {
    throw AppError.badRequest('Você não pode desativar ou alterar o perfil da sua própria conta.');
  }
  const role = data.role ?? user.role;
  await assertInstructorLink(role, data.instructor ?? user.instructor);

  const before = { role: user.role, active: user.active };
  Object.assign(user, data);
  if (role !== ROLES.INSTRUTOR) user.instructor = null;
  if (before.role !== user.role || (before.active && !user.active)) user.tokenVersion += 1; // encerra sessões
  await user.save();

  if (before.role !== user.role) {
    await audit(req, {
      action: 'user.role_change',
      entity: 'User',
      entityId: user._id,
      entityLabel: user.email,
      summary: `Permissões de ${user.name} alteradas: ${LABELS.role[before.role]} → ${LABELS.role[user.role]}`,
      details: { de: before.role, para: user.role },
    });
  }
  if (before.active !== user.active) {
    await audit(req, {
      action: user.active ? 'user.activate' : 'user.deactivate',
      entity: 'User',
      entityId: user._id,
      entityLabel: user.email,
      summary: `Usuário ${user.name} ${user.active ? 'reativado' : 'desativado'}`,
    });
  }
  res.json(await User.findById(user._id).populate('instructor', 'name').lean());
}

export async function resetPassword(req, res) {
  const user = await User.findById(req.validParams.id);
  if (!user) throw AppError.notFound('Usuário não encontrado.');
  user.passwordHash = await bcrypt.hash(req.body.password, 10);
  user.tokenVersion += 1;
  await user.save();
  await audit(req, {
    action: 'user.password_reset',
    entity: 'User',
    entityId: user._id,
    entityLabel: user.email,
    summary: `Senha de ${user.name} redefinida pelo administrador`,
  });
  res.json({ message: 'Senha redefinida.' });
}
