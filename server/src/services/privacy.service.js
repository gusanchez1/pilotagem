import { PERMISSIONS, hasPermission } from '../config/permissions.js';
import { ROLES } from '../config/constants.js';
import { escapeRegex, normalizeText, onlyDigits } from '../utils/text.js';

/**
 * Camada de privacidade — TODA resposta da API que contém um cliente passa por aqui.
 *
 * Regras:
 *  - Cliente comum: dados completos para quem pode ver clientes; instrutores veem apenas o nome.
 *  - Cliente confidencial: nome de exibição (alias) e telefone mascarado/omitido.
 *    Os dados reais só são devolvidos com reveal=true (rota auditada) e permissão
 *    clients:confidential.
 *  - Contexto "report" (dashboards, relatórios, exportações): confidenciais SEMPRE por alias.
 */

export function canSeeConfidential(user) {
  return hasPermission(user, PERMISSIONS.CLIENTS_CONFIDENTIAL);
}

export function maskPhone(phone = '') {
  const digits = onlyDigits(phone);
  if (digits.length < 4) return '•••••';
  return `(••) •••••-••${digits.slice(-2)}`;
}

function confidentialAlias(client) {
  return client.alias || `Cliente reservado ${client.code || ''}`.trim();
}

/** Nome para exibição (respeita confidencialidade). */
export function clientDisplayName(client) {
  if (!client) return '—';
  if (client.confidential) return confidentialAlias(client);
  return `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim();
}

/**
 * @param {object} client  documento (lean ou mongoose)
 * @param {object} user    req.user (com permissions)
 * @param {object} opts    { reveal?: boolean, context?: 'default' | 'report' }
 */
export function presentClient(client, user, { reveal = false, context = 'default' } = {}) {
  if (!client) return null;
  if (typeof client !== 'object' || !('firstName' in client || 'confidential' in client)) {
    return client; // ObjectId não populado
  }
  const c = typeof client.toObject === 'function' ? client.toObject() : client;

  const base = {
    _id: c._id,
    code: c.code,
    confidential: Boolean(c.confidential),
    active: c.active !== false,
    createdAt: c.createdAt,
  };

  const isInstructor = user?.role === ROLES.INSTRUTOR;
  const canViewDetails = hasPermission(user, PERMISSIONS.CLIENTS_VIEW);

  if (c.confidential) {
    const mayReveal = reveal && canSeeConfidential(user) && context !== 'report';
    if (mayReveal) {
      return {
        ...base,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        alias: c.alias,
        notes: c.notes,
        displayName: confidentialAlias(c),
        realName: `${c.firstName} ${c.lastName}`,
        revealed: true,
      };
    }
    return {
      ...base,
      alias: c.alias,
      displayName: confidentialAlias(c),
      firstName: null,
      lastName: null,
      phone: null,
      phoneMasked: canSeeConfidential(user) && context !== 'report' ? maskPhone(c.phone) : null,
      notes: canSeeConfidential(user) && context !== 'report' ? c.notes : null,
      revealed: false,
    };
  }

  if (isInstructor || !canViewDetails) {
    return { ...base, displayName: `${c.firstName} ${c.lastName}`, firstName: c.firstName, lastName: c.lastName };
  }

  return {
    ...base,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    notes: c.notes,
    alias: c.alias,
    displayName: `${c.firstName} ${c.lastName}`,
  };
}

/** Aplica presentClient no campo `client` de cada documento. */
export function presentWithClient(docs, user, opts) {
  const apply = (doc) => {
    if (!doc) return doc;
    const d = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return { ...d, client: presentClient(d.client, user, opts) };
  };
  return Array.isArray(docs) ? docs.map(apply) : apply(docs);
}

/**
 * Filtro de busca de clientes que não vaza a existência de confidenciais:
 * quem não pode ver confidenciais só encontra o cliente confidencial pelo nome de exibição.
 */
export function clientSearchFilter(q, user) {
  if (!q) return {};
  const term = normalizeText(q);
  const digits = onlyDigits(q);
  const rx = new RegExp(escapeRegex(term), 'i');
  const publicMatch = [{ searchText: rx }];
  if (digits.length >= 3) publicMatch.push({ phoneDigits: new RegExp(escapeRegex(digits)) });

  if (canSeeConfidential(user)) {
    return { $or: [...publicMatch, { aliasSearch: rx }, { code: new RegExp(escapeRegex(q), 'i') }] };
  }
  return {
    $or: [
      { confidential: false, $or: publicMatch },
      { confidential: true, aliasSearch: rx },
      { code: new RegExp(escapeRegex(q), 'i') },
    ],
  };
}
