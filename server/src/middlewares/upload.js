import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const receiptsDir = join(env.uploadsDir, 'receipts');
mkdirSync(receiptsDir, { recursive: true });

const ALLOWED = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/**
 * Comprovantes: gravados em server/uploads/receipts com nome aleatório (não adivinhável).
 * A pasta NÃO é servida estaticamente — o download exige autenticação e permissão.
 */
export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: receiptsDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED[file.mimetype] || extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true);
    else cb(AppError.badRequest('Formato não suportado. Envie PDF, PNG, JPG ou WEBP.'));
  },
});
