/**
 * Formatação pt-BR. Valores monetários chegam da API em CENTAVOS.
 * Datas são exibidas sempre no fuso America/Sao_Paulo, independente do fuso do computador.
 */
export const TZ = 'America/Sao_Paulo';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const num = new Intl.NumberFormat('pt-BR');
const dec1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const money = (cents) => (cents === null || cents === undefined ? '—' : brl.format(cents / 100));
export const moneyCompact = (cents) => brlCompact.format((cents || 0) / 100);
export const number = (n) => num.format(n ?? 0);
export const decimal = (n) => dec1.format(n ?? 0);
export const percent = (n) => `${dec1.format(n ?? 0)}%`;

const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts });
const dateF = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const timeF = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayMonthF = fmt({ day: '2-digit', month: 'short' });
const weekdayF = fmt({ weekday: 'short' });
const longF = fmt({ weekday: 'long', day: '2-digit', month: 'long' });
const monthYearF = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShortF = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

export const date = (d) => (d ? dateF.format(new Date(d)) : '—');
export const time = (d) => (d ? timeF.format(new Date(d)) : '—');
export const dateTime = (d) => (d ? `${dateF.format(new Date(d))} ${timeF.format(new Date(d))}` : '—');
export const dayMonth = (d) => dayMonthF.format(new Date(d)).replace('.', '');
export const weekday = (d) => weekdayF.format(new Date(d)).replace('.', '');
export const longDate = (d) => longF.format(new Date(d));
export const timeRange = (a, b) => `${time(a)}–${time(b)}`;

export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

/** 'AAAA-MM' → 'Novembro de 2026' / 'nov' */
export const monthLabel = (ym) => capitalize(monthYearF.format(new Date(`${ym}-15T12:00:00Z`)));
export const monthShort = (ym) => capitalize(monthShortF.format(new Date(`${ym}-15T12:00:00Z`)).replace('.', ''));

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export const dateKeyLabel = (key) => (key ? key.split('-').reverse().join('/') : '—');

export function phoneMask(value = '') {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function minutesLabel(min) {
  if (min === null || min === undefined) return 'Não informada';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
