import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../config/constants.js';

const receiptSchema = new mongoose.Schema(
  {
    originalName: String,
    storedName: String,
    mimeType: String,
    size: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * Pagamento: acordo de pagamento de parte (ou todo) o valor de uma venda, em uma forma de
 * pagamento. É dividido em uma ou mais parcelas (Installment), que são a unidade de
 * recebimento efetivo. Nunca é apagado: estornos mudam o status para "estornado".
 */
const paymentSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 1 },
    installmentsCount: { type: Number, default: 1, min: 1, max: 24 },
    notes: { type: String, default: '', maxlength: 1000 },
    receiptReference: { type: String, default: '', maxlength: 500 },
    receipts: { type: [receiptSchema], default: [] },
    status: { type: String, enum: PAYMENT_STATUS, default: 'ativo' },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reverseReason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
