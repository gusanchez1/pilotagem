import mongoose from 'mongoose';
import { PRICING_MODES, RESOURCE_CATEGORIES } from '../config/constants.js';

/**
 * Serviço / modalidade do catálogo. Preços em centavos.
 * pricingMode "por_quantidade" usa priceTiers: cada faixa é o PREÇO TOTAL da opção
 * (ex.: 2 simuladores → R$ 450), sem presumir cobrança por hora ou por unidade.
 */
const priceTierSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    label: { type: String, default: '' },
  },
  { _id: false },
);

const requiredResourceSchema = new mongoose.Schema(
  {
    category: { type: String, enum: RESOURCE_CATEGORIES, required: true },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    durationMinutes: { type: Number, default: null, min: 0 },
    basePrice: { type: Number, required: true, min: 0 },
    pricingMode: { type: String, enum: PRICING_MODES, default: 'fixo' },
    priceTiers: { type: [priceTierSchema], default: [] },
    quantityLabel: { type: String, default: 'simulador', trim: true },
    requiresInstructor: { type: Boolean, default: false },
    requiresRoom: { type: Boolean, default: true },
    requiredResources: { type: [requiredResourceSchema], default: [] },
    compatibleRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
    priceNote: { type: String, default: '', maxlength: 300 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Service = mongoose.model('Service', serviceSchema);
