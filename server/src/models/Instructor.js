import mongoose from 'mongoose';

const instructorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    specialty: { type: String, default: '', trim: true, maxlength: 120 },
    bio: { type: String, default: '', maxlength: 2000 },
    notes: { type: String, default: '', maxlength: 2000 },
    color: { type: String, default: '#3F3F46' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Instructor = mongoose.model('Instructor', instructorSchema);
