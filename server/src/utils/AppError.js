/**
 * Erro de aplicação com status HTTP e mensagem pronta para o usuário (pt-BR).
 */
export class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Sessão expirada ou inválida. Faça login novamente.') {
    return new AppError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Você não tem permissão para realizar esta ação.') {
    return new AppError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Registro não encontrado.') {
    return new AppError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message, details) {
    return new AppError(409, message, { code: 'CONFLICT', details });
  }
}
