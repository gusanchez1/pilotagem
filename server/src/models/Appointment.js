import mongoose from 'mongoose';
import { APPOINTMENT_ORIGINS, APPOINTMENT_STATUS } from '../config/constants.js';

const sessionNoteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    action: String,
    description: String,
  },
  { _id: false },
);

const appointmentSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor', default: null },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    resources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    quantity: { type: Number, default: 1, min: 1 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    contractedAmount: { type: Number, default: 0, min: 0 },
    origin: { type: String, enum: APPOINTMENT_ORIGINS, default: 'recepcao' },
    status: { type: String, enum: APPOINTMENT_STATUS, default: 'agendado' },
    notes: { type: String, default: '', maxlength: 2000 },
    sessionNotes: { type: [sessionNoteSchema], default: [] },
    history: { type: [historySchema], default: [] },
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
    cancelReason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

appointmentSchema.index({ instructor: 1, start: 1, end: 1 });
appointmentSchema.index({ client: 1, start: -1 });
appointmentSchema.index({ start: 1, status: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
