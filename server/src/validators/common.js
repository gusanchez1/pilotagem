import { z } from 'zod';

/** Helpers Zod reutilizados pelos schemas de cada módulo. Mensagens em pt-BR. */

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
export const optionalObjectId = z.preprocess((v) => (v === '' ? null : v), objectId.nullable().optional());
export const idParams = z.object({ id: objectId });

export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');
export const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:mm)');
export const isoDate = z.coerce.date({ error: 'Data/hora inválida' });

/** Valor monetário em CENTAVOS (inteiro, não negativo). */
export const cents = z.coerce.number({ error: 'Valor inválido' }).int('Valor deve estar em centavos').min(0, 'Valor não pode ser negativo');
export const positiveCents = cents.refine((v) => v > 0, 'Valor deve ser maior que zero');

export const text = (max = 2000) => z.string().trim().max(max, `Máximo de ${max} caracteres`);
export const requiredText = (label, max = 200) =>
  z.string({ error: `${label} é obrigatório` }).trim().min(1, `${label} é obrigatório`).max(max, `Máximo de ${max} caracteres`);

export const boolish = z.preprocess((v) => {
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return v;
}, z.boolean());

export const periodQuery = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
});

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  q: z.string().trim().max(100).optional(),
});

/** Lista de ids em query string: "a,b,c" */
export const idList = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
  z.array(objectId).optional(),
);
