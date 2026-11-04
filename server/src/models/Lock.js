import mongoose from 'mongoose';

/**
 * Lock distribuído simples — exclusão mútua para reservas de recursos.
 * _id é a chave do recurso (ex.: "room:<id>"); por ser único, só uma operação consegue inseri-lo.
 * expiresAt + índice TTL garantem que locks órfãos (processo encerrado) expirem sozinhos.
 */
const lockSchema = new mongoose.Schema(
  {
    _id: String,
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Lock = mongoose.model('Lock', lockSchema);
