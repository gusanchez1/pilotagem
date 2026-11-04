import { AuditLog } from '../models/index.js';

/**
 * Registra uma operação relevante na trilha de auditoria.
 * Nunca deve interromper a operação principal: falhas são apenas logadas no console.
 *
 * @param {object} req      requisição Express (para usuário e IP) — pode ser null (sistema)
 * @param {object} entry    { action, entity, entityId, entityLabel, summary, details }
 */
export async function audit(req, entry) {
  try {
    const user = req?.user;
    await AuditLog.create({
      user: user?._id ?? null,
      userName: user?.name ?? 'Sistema',
      userRole: user?.role ?? '',
      ip: req?.ip ?? '',
      ...entry,
    });
  } catch (err) {
    console.error('[audit] falha ao registrar auditoria:', err.message);
  }
}

/** Lista os campos alterados entre dois objetos simples (para detalhes da auditoria). */
export function diffFields(before, after, fields, { redact = [] } = {}) {
  const changes = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same && b !== undefined) {
      changes[f] = redact.includes(f) ? { de: '•••', para: '•••' } : { de: a ?? null, para: b ?? null };
    }
  }
  return changes;
}
