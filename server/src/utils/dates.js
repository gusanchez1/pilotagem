/**
 * Utilitários de data no fuso do negócio (America/Sao_Paulo) usando apenas Intl.
 *
 * Datas são armazenadas em UTC. "Chaves de data" (dateKey) são strings 'AAAA-MM-DD'
 * interpretadas no fuso do negócio.
 */
import { env } from '../config/env.js';

const TZ = env.timezone;

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(date) {
  const out = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Diferença (ms) entre o horário local do fuso e UTC no instante informado. */
function tzOffsetMs(date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converte data/hora "de parede" no fuso do negócio para um Date UTC. */
export function zonedToUtc(dateKey, time = '00:00') {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let result = guess - tzOffsetMs(new Date(guess));
  // segunda passada corrige casos de transição de horário de verão
  result = guess - tzOffsetMs(new Date(result));
  return new Date(result);
}

/** 'AAAA-MM-DD' do instante informado, no fuso do negócio. */
export function toDateKey(date = new Date()) {
  const p = zonedParts(new Date(date));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function toTimeKey(date) {
  const p = zonedParts(new Date(date));
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonthsKey(dateKey, months) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function startOfDay(dateKey) {
  return zonedToUtc(dateKey, '00:00');
}

/** Início do dia seguinte (limite exclusivo). */
export function endOfDayExclusive(dateKey) {
  return zonedToUtc(addDaysKey(dateKey, 1), '00:00');
}

export function monthKey(date) {
  return toDateKey(date).slice(0, 7);
}

export function firstDayOfMonthKey(dateKey) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function lastDayOfMonthKey(dateKey) {
  return addDaysKey(addMonthsKey(firstDayOfMonthKey(dateKey), 1), -1);
}

/** Lista de 'AAAA-MM' entre duas chaves de data (inclusive). */
export function monthsBetween(fromKey, toKey) {
  const months = [];
  let cursor = firstDayOfMonthKey(fromKey);
  const last = toKey.slice(0, 7);
  while (cursor.slice(0, 7) <= last && months.length < 60) {
    months.push(cursor.slice(0, 7));
    cursor = addMonthsKey(cursor, 1);
  }
  return months;
}

/**
 * Normaliza um filtro de período { from, to } (chaves de data) para limites UTC.
 * Padrão: mês corrente.
 */
export function resolvePeriod(from, to) {
  const today = toDateKey();
  const fromKey = from || firstDayOfMonthKey(today);
  const toKey = to || lastDayOfMonthKey(today);
  return {
    fromKey,
    toKey,
    start: startOfDay(fromKey),
    end: endOfDayExclusive(toKey),
  };
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatDate(date) {
  return date ? dateFmt.format(new Date(date)) : '';
}

export function formatDateTime(date) {
  return date ? dateTimeFmt.format(new Date(date)).replace(',', '') : '';
}

export function formatDateKey(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}
