import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = mongoose.model('Counter', counterSchema);

/** Próximo número de uma sequência — atômico ($inc com upsert). */
export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.seq;
}

/** Gera códigos legíveis, ex.: V-2026-0042, CL-0007. */
export async function nextCode(prefix, { yearly = false, pad = 4 } = {}) {
  const year = new Date().getFullYear();
  const key = yearly ? `${prefix}-${year}` : prefix;
  const seq = await nextSequence(key);
  return `${key}-${String(seq).padStart(pad, '0')}`;
}
