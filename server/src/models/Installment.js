import mongoose from 'mongoose';
import { INSTALLMENT_STATUS, PAYMENT_METHODS } from '../config/constants.js';

/** Parcela — unidade de recebimento efetivo. "recebida" é o único estado que conta como caixa. */
const installmentSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    number: { type: Number, required: true, min: 1 },
    totalInstallments: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: INSTALLMENT_STATUS, default: 'pendente' },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

installmentSchema.index({ status: 1, dueDate: 1 });
installmentSchema.index({ status: 1, receivedAt: 1 });

export const Installment = mongoose.model('Installment', installmentSchema);
