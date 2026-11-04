/**
 * Sanitização contra injeção de operadores do MongoDB (NoSQL injection):
 * remove do corpo da requisição qualquer chave iniciada por "$" ou contendo ".".
 * A query string usa o parser "simple" do Express 5 (sem objetos aninhados) e é validada com Zod.
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}
