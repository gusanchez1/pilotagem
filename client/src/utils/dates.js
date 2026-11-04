/**
 * Datas no fuso do negócio (America/Sao_Paulo) usando "chaves de data" 'AAAA-MM-DD'.
 * Assim a agenda mostra o mesmo dia/horário em qualquer computador.
 */
import { TZ } from './format.js';

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zoned(date) {
  const o = {};
  for (const p of parts.formatToParts(date)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
}

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(d = new Date()) {
  const p = zoned(new Date(d));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeKey(d) {
  const p = zoned(new Date(d));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Minutos desde 00:00 (no fuso do negócio). */
export function minutesOfDay(d) {
  const p = zoned(new Date(d));
  return p.hour * 60 + p.minute;
}

function offsetMs(date) {
  const p = zoned(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Data + hora de São Paulo → ISO UTC (para enviar à API). */
export function zonedISO(dateKey, timeKey = '00:00') {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeKey.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(new Date(guess));
  t = guess - offsetMs(new Date(t));
  return new Date(t).toISOString();
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** 0 = domingo */
export function weekdayOf(key) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeek(key) {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export const startOfMonth = (key) => `${key.slice(0, 7)}-01`;
export const endOfMonth = (key) => addDays(addMonths(startOfMonth(key), 1), -1);

/** Grade do mês (semanas de segunda a domingo). */
export function monthGrid(key) {
  const first = startOfWeek(startOfMonth(key));
  const last = endOfMonth(key);
  const days = [];
  for (let d = first; d <= last || weekdayOf(d) !== 1; d = addDays(d, 1)) days.push(d);
  return days;
}

export function keyToDate(key) {
  return new Date(`${key}T12:00:00Z`);
}

export function diffMinutes(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 60000);
}

export function addMinutesToTime(timeKey, minutes) {
  const [h, m] = timeKey.split(':').map(Number);
  const total = Math.min(24 * 60 - 1, h * 60 + m + minutes);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Presets de período usados nos filtros. */
export function periodPresets(today = toDateKey()) {
  const thisMonth = { from: startOfMonth(today), to: endOfMonth(today) };
  const prev = addMonths(startOfMonth(today), -1);
  return [
    { id: 'mes', label: 'Este mês', ...thisMonth },
    { id: 'anterior', label: 'Mês anterior', from: prev, to: endOfMonth(prev) },
    { id: '30d', label: 'Últimos 30 dias', from: addDays(today, -29), to: today },
    { id: '90d', label: 'Últimos 90 dias', from: addDays(today, -89), to: today },
    { id: '6m', label: 'Últimos 6 meses', from: addMonths(startOfMonth(today), -5), to: endOfMonth(today) },
    { id: 'ano', label: 'Este ano', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];
}
