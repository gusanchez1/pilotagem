import mongoose from 'mongoose';

/** Configurações gerais (documento único com _id "global"). */
const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    companyName: { type: String, default: 'Pilotech' },
    receptionCanManageSales: { type: Boolean, default: true },
    instructorsCanUpdateStatus: { type: Boolean, default: true },
    businessHoursStart: { type: String, default: '08:00' },
    businessHoursEnd: { type: String, default: '22:00' },
  },
  { timestamps: true },
);

export const Settings = mongoose.model('Settings', settingsSchema);
