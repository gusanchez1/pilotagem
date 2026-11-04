import { PERMISSIONS, hasPermission } from '../config/permissions.js';
import { ROLES } from '../config/constants.js';
import { presentClient } from './privacy.service.js';

/** Populates padrão — evita repetir a lista em cada controller. */
export const APPOINTMENT_POPULATE = [
  { path: 'client' },
  { path: 'service', select: 'name category durationMinutes pricingMode quantityLabel requiresInstructor requiresRoom' },
  { path: 'instructor', select: 'name color specialty' },
  { path: 'room', select: 'name code type' },
  { path: 'resources', select: 'name code category' },
  { path: 'package', select: 'name' },
  { path: 'sale', select: 'code total amountReceived amountOutstanding paymentStatus status' },
];

export const RESERVATION_POPULATE = [
  { path: 'client' },
  { path: 'rooms', select: 'name code type' },
  { path: 'resources', select: 'name code category' },
  { path: 'appointment', select: 'code status instructor service', populate: [{ path: 'instructor', select: 'name color' }, { path: 'service', select: 'name' }] },
  { path: 'sale', select: 'code total paymentStatus' },
];

export const SALE_POPULATE = [
  { path: 'client' },
  { path: 'category', select: 'name color' },
  { path: 'appointments', select: 'code start end status service', populate: { path: 'service', select: 'name' } },
];

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

/**
 * Agendamento como cada perfil pode ver:
 *  - cliente sempre passa pela camada de privacidade;
 *  - instrutores não recebem valores nem dados de venda.
 */
export function presentAppointment(doc, user, opts) {
  if (!doc) return doc;
  const a = plain(doc);
  const out = { ...a, client: presentClient(a.client, user, opts) };
  if (!hasPermission(user, PERMISSIONS.SALES_VIEW)) delete out.sale;
  if (user?.role === ROLES.INSTRUTOR) {
    delete out.contractedAmount;
    delete out.history;
  }
  return out;
}

export function presentReservation(doc, user, opts) {
  if (!doc) return doc;
  const r = plain(doc);
  const out = { ...r, client: presentClient(r.client, user, opts) };
  if (!hasPermission(user, PERMISSIONS.SALES_VIEW)) {
    delete out.sale;
    delete out.amount;
  }
  return out;
}

export function presentSale(doc, user, opts) {
  if (!doc) return doc;
  const s = plain(doc);
  return { ...s, client: presentClient(s.client, user, opts) };
}

export const presentMany = (fn) => (docs, user, opts) => docs.map((d) => fn(d, user, opts));
