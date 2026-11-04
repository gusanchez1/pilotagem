import { randomUUID } from 'node:crypto';
import { Lock } from '../models/index.js';
import { AppError } from '../utils/AppError.js';

const LOCK_TTL_MS = 15_000;
const WAIT_TIMEOUT_MS = 6_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquire(key, owner, deadline) {
  for (;;) {
    try {
      await Lock.create({ _id: key, owner, expiresAt: new Date(Date.now() + LOCK_TTL_MS) });
      return;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Lock ocupado: remove se estiver expirado (o monitor TTL do MongoDB roda a cada ~60s)
      await Lock.deleteOne({ _id: key, expiresAt: { $lt: new Date() } });
      if (Date.now() > deadline) {
        throw AppError.conflict('Este horário está sendo reservado por outra pessoa neste momento. Tente novamente.');
      }
      await sleep(20 + Math.random() * 60);
    }
  }
}

/**
 * Executa `fn` com exclusão mútua sobre as chaves informadas.
 * As chaves são ordenadas para evitar deadlock entre operações concorrentes.
 *
 * Substitui transações em instalações standalone do MongoDB: duas requisições que tentam
 * reservar o mesmo recurso ao mesmo tempo são serializadas; a segunda só verifica
 * disponibilidade depois que a primeira gravou (ou desistiu).
 */
export async function withLocks(keys, fn) {
  const unique = [...new Set(keys.filter(Boolean))].sort();
  const owner = randomUUID();
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  const acquired = [];
  try {
    for (const key of unique) {
      await acquire(key, owner, deadline);
      acquired.push(key);
    }
    return await fn();
  } finally {
    if (acquired.length) await Lock.deleteMany({ _id: { $in: acquired }, owner });
  }
}
