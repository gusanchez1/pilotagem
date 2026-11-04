import { env } from '../config/env.js';
import { AuditLog } from '../models/index.js';
import { audit, diffFields } from '../services/audit.service.js';
import { getSettings, updateSettings, clearSettingsCache } from '../services/settings.service.js';
import { seedDatabase } from '../seed/seed.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/text.js';
import { resolvePeriod } from '../utils/dates.js';
import { pageResult, paginate } from '../utils/pagination.js';

/* ── Configurações ───────────────────────────────────────── */
export async function getSettingsHandler(_req, res) {
  res.json({ ...(await getSettings()), allowDemoReset: env.allowDemoReset });
}

export async function updateSettingsHandler(req, res) {
  const before = await getSettings();
  const after = await updateSettings(req.body);
  const changes = diffFields(before, after, Object.keys(req.body));
  if (Object.keys(changes).length) {
    await audit(req, {
      action: 'settings.update',
      entity: 'Settings',
      summary: 'Configurações de permissões/sistema alteradas',
      details: changes,
    });
  }
  res.json(after);
}

/* ── Auditoria ───────────────────────────────────────────── */
export async function listAudit(req, res) {
  const q = req.validQuery;
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.createdAt = { $gte: start, $lt: end };
  }
  if (q.entity) filter.entity = q.entity;
  if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
  if (q.user) filter.user = q.user;
  if (q.q) filter.$or = [{ summary: new RegExp(escapeRegex(q.q), 'i') }, { userName: new RegExp(escapeRegex(q.q), 'i') }];

  const page = paginate(q, { defaultLimit: 50 });
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, page));
}

/* ── Restauração dos dados de demonstração ───────────────── */
export async function demoReset(req, res) {
  if (!env.allowDemoReset) throw AppError.forbidden('A restauração pela interface está desativada (ALLOW_DEMO_RESET=false).');
  if (req.body?.confirm !== 'RESTAURAR') throw AppError.badRequest('Digite RESTAURAR para confirmar.');
  const by = req.user.name;
  const summary = await seedDatabase({ quiet: true });
  clearSettingsCache();
  await audit(null, {
    action: 'demo.reset',
    entity: 'System',
    summary: `Dados de demonstração restaurados por ${by}`,
  });
  res.json({ message: 'Dados de demonstração restaurados. Faça login novamente.', summary });
}
