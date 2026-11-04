import mongoose from 'mongoose';
import { CATEGORY_TYPES } from '../config/constants.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: CATEGORY_TYPES, required: true },
    color: { type: String, default: '#71717A' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1, type: 1 }, { unique: true });

export const FinancialCategory = mongoose.model('FinancialCategory', categorySchema);
