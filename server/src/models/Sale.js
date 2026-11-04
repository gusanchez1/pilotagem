import mongoose from 'mongoose';
import { PAYMENT_TERMS, SALE_ITEM_TYPES, SALE_PAYMENT_STATUS, SALE_STATUS } from '../config/constants.js';

/**
 * SaleItem: embutido na venda como SNAPSHOT — guarda descrição, modalidade e preço no momento
 * da venda. Alterações futuras no catálogo não alteram o histórico.
 */
const saleItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SALE_ITEM_TYPES, required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
    description: { type: String, required: true, maxlength: 200 },
    modality: { type: String, default: 'Outros' },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const saleSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    items: { type: [saleItemSchema], validate: (v) => v.length > 0 },
    appointments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }],
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
    saleDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    description: { type: String, default: '', maxlength: 300 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialCategory', default: null },
    paymentTerms: { type: String, enum: PAYMENT_TERMS, default: 'antecipado' },
    notes: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: SALE_STATUS, default: 'ativa' },
    cancelReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Campos derivados — recalculados por finance.service#recalcSale a partir das parcelas
    amountReceived: { type: Number, default: 0 },
    amountScheduled: { type: Number, default: 0 },
    amountOutstanding: { type: Number, default: 0 },
    amountUnallocated: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: SALE_PAYMENT_STATUS, default: 'em_aberto' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

saleSchema.index({ saleDate: -1 });
saleSchema.index({ client: 1, saleDate: -1 });
saleSchema.index({ status: 1, paymentStatus: 1 });

export const Sale = mongoose.model('Sale', saleSchema);
