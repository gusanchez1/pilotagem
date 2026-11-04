import mongoose from 'mongoose';
import { EXPENSE_STATUS, PAYMENT_METHODS } from '../config/constants.js';

const expenseSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialCategory', required: true },
    amount: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    method: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
    status: { type: String, enum: EXPENSE_STATUS, default: 'pendente' },
    supplier: { type: String, default: '', trim: true, maxlength: 120 },
    notes: { type: String, default: '', maxlength: 2000 },
    receiptReference: { type: String, default: '', maxlength: 500 },
    cancelReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

expenseSchema.index({ dueDate: 1, status: 1 });
expenseSchema.index({ paidAt: 1, status: 1 });

export const Expense = mongoose.model('Expense', expenseSchema);
