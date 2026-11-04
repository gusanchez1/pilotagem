import mongoose from 'mongoose';
import { ROOM_STATUS, ROOM_TYPES } from '../config/constants.js';

/**
 * Sala/espaço. O campo status descreve a condição física (ativa, manutenção, inativa).
 * Ocupação (reservada, alugada, ocupada) é derivada das reservas no horário consultado.
 */
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 30 },
    description: { type: String, default: '', maxlength: 2000 },
    type: { type: String, enum: ROOM_TYPES, required: true },
    capacity: { type: Number, default: null, min: 0 },
    amenities: { type: [String], default: [] },
    status: { type: String, enum: ROOM_STATUS, default: 'ativa' },
    /**
     * Uso compartilhado: vários TREINAMENTOS podem ocorrer ao mesmo tempo (a disponibilidade é
     * controlada por equipamento, ex.: simuladores). Locação, evento, manutenção e uso interno
     * ocupam a sala inteira. Salas exclusivas aceitam apenas uma reserva por horário.
     */
    shared: { type: Boolean, default: false },
    hourlyRate: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);

export const Room = mongoose.model('Room', roomSchema);
