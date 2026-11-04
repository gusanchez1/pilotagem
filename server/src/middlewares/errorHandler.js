import mongoose from 'mongoose';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

/** Tratamento centralizado de erros — sempre responde { error: { message, code, details } }. */
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    error = AppError.badRequest('Dados inválidos.', { fields });
  } else if (err instanceof mongoose.Error.CastError) {
    error = AppError.badRequest('Identificador inválido.');
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    error = AppError.conflict(`Já existe um registro com este valor${field ? ` (${field})` : ''}.`);
  } else if (err instanceof multer.MulterError) {
    error = AppError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande (máximo 5 MB).' : 'Falha no envio do arquivo.',
    );
  } else if (err?.type === 'entity.parse.failed') {
    error = AppError.badRequest('JSON inválido no corpo da requisição.');
  } else if (!(err instanceof AppError)) {
    console.error('[erro]', err);
    error = new AppError(500, 'Erro interno do servidor. Tente novamente.');
    if (!env.isProduction) error.details = { cause: err?.message };
  }

  res.status(error.status).json({
    error: { message: error.message, code: error.code, details: error.details },
  });
}
