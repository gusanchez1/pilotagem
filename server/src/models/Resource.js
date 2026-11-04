import mongoose from 'mongoose';
import { RESOURCE_CATEGORIES, RESOURCE_STATUS } from '../config/constants.js';

const resourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: RESOURCE_CATEGORIES, required: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 30 },
    description: { type: String, default: '', maxlength: 2000 },
    location: { type: String, default: '', maxlength: 120 },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    status: { type: String, enum: RESOURCE_STATUS, default: 'disponivel' },
    notes: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true },
);

export const Resource = mongoose.model('Resource', resourceSchema);
