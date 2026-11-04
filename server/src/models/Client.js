import mongoose from 'mongoose';
import { normalizeText, onlyDigits, formatPhone } from '../utils/text.js';

/**
 * Cliente — cadastro mínimo (LGPD): nome, sobrenome e telefone.
 * Clientes confidenciais possuem um nome de exibição alternativo (alias), usado em toda a
 * interface, dashboards e relatórios. Os dados reais só são revelados sob demanda e auditados.
 */
const clientSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    phoneDigits: { type: String, index: true },
    notes: { type: String, default: '', maxlength: 2000 },
    confidential: { type: Boolean, default: false, index: true },
    alias: { type: String, default: '', trim: true, maxlength: 80 },
    searchText: { type: String, index: true },
    aliasSearch: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

clientSchema.pre('validate', function normalize() {
  this.phoneDigits = onlyDigits(this.phone);
  this.phone = formatPhone(this.phone);
  this.searchText = normalizeText(`${this.firstName} ${this.lastName}`);
  this.aliasSearch = normalizeText(this.alias || '');
});

clientSchema.index({ createdAt: -1 });

export const Client = mongoose.model('Client', clientSchema);
