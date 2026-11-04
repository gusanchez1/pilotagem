import { Settings } from '../models/index.js';

let cache = null;

/** Configurações globais com cache em memória (invalidado a cada atualização). */
export async function getSettings() {
  if (cache) return cache;
  let doc = await Settings.findById('global').lean();
  if (!doc) doc = (await Settings.create({ _id: 'global' })).toObject();
  cache = doc;
  return doc;
}

export async function updateSettings(patch) {
  const doc = await Settings.findByIdAndUpdate('global', { $set: patch }, { upsert: true, returnDocument: 'after' }).lean();
  cache = doc;
  return doc;
}

export function clearSettingsCache() {
  cache = null;
}
