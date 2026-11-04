import mongoose from 'mongoose';

/** PackageItem: embutido no pacote (não possui ciclo de vida próprio). */
const packageItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    quantity: { type: Number, required: true, min: 1 },
    durationMinutes: { type: Number, default: null, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    items: { type: [packageItemSchema], validate: (v) => v.length > 0 },
    simulatorCount: { type: Number, default: 0, min: 0 },
    totalDurationMinutes: { type: Number, default: null, min: 0 },
    referencePrice: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    validityDays: { type: Number, default: null, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Package = mongoose.model('Package', packageSchema);
