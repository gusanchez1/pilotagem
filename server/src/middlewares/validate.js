import { AppError } from '../utils/AppError.js';

/**
 * Valida body/query/params com Zod. O resultado validado (com coerções e valores padrão)
 * fica em req.body / req.validQuery / req.validParams.
 * (No Express 5, req.query é somente leitura — por isso usamos req.validQuery.)
 */
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    if (params) req.validParams = parse(params, req.params);
    if (query) req.validQuery = parse(query, req.query);
    if (body) req.body = parse(body, req.body ?? {});
    next();
  };
}

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    const first = Object.values(fields)[0];
    throw AppError.badRequest(`Dados inválidos: ${first}`, { fields });
  }
  return result.data;
}
