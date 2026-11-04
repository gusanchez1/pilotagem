/**
 * Valores monetários são inteiros em CENTAVOS. Nunca some valores em reais com ponto flutuante.
 */

export function toCents(reais) {
  return Math.round(Number(reais) * 100);
}

export function sumCents(values) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBRL(cents) {
  return brl.format((cents || 0) / 100).replace(/\s/g, ' '); // Intl usa espaço não separável entre "R$" e o valor
}

/** "1.234,56" — usado em CSV (abre corretamente no Excel em português). */
export function formatDecimal(cents) {
  return plain.format((cents || 0) / 100);
}
