import mongoose from 'mongoose';
import { RESERVATION_STATUS, USAGE_TYPES } from '../config/constants.js';

/**
 * Reserva — livro-razão de ocupação de salas e recursos.
 * Agendamentos que usam sala/equipamentos geram uma reserva vinculada (usageType "treinamento").
 */
const reservationSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    responsible: { type: String, default: '', trim: true, maxlength: 120 },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
    resources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    usageType: { type: String, enum: USAGE_TYPES, required: true },
    amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: RESERVATION_STATUS, default: 'confirmada' },
    notes: { type: String, default: '', maxlength: 2000 },
    cancelReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

reservationSchema.index({ rooms: 1, start: 1, end: 1 });
reservationSchema.index({ resources: 1, start: 1, end: 1 });
reservationSchema.index({ start: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);
