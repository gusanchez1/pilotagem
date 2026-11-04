/**
 * Cálculos financeiros PUROS (sem banco de dados) — cobertos por testes unitários.
 * Todos os valores em centavos (inteiros).
 */
import { AppError } from '../utils/AppError.js';
import { addMonthsKey } from '../utils/dates.js';

/** Divide um valor em n parcelas inteiras; a diferença de arredondamento vai para a 1ª parcela. */
export function splitAmount(total, n) {
  if (!Number.isInteger(total) || total <= 0) throw AppError.badRequest('Valor inválido para parcelamento.');
  if (!Number.isInteger(n) || n < 1) throw AppError.badRequest('Quantidade de parcelas inválida.');
  if (n > total) throw AppError.badRequest('Quantidade de parcelas maior que o valor em centavos.');
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? remainder : 0));
}

/** Cronograma mensal de parcelas a partir da 1ª data de vencimento ('AAAA-MM-DD'). */
export function buildInstallmentSchedule({ amount, count, firstDueKey, intervalMonths = 1 }) {
  return splitAmount(amount, count).map((value, i) => ({
    number: i + 1,
    amount: value,
    dueKey: addMonthsKey(firstDueKey, i * intervalMonths),
  }));
}

export function computeItemTotal({ quantity = 1, unitPrice, discount = 0 }) {
  const gross = quantity * unitPrice;
  if (discount > gross) throw AppError.badRequest('O desconto do item não pode ser maior que o valor do item.');
  return gross - discount;
}

/** Subtotal (soma dos itens já com desconto de item), desconto geral e total contratado. */
export function computeSaleTotals(items, discount = 0) {
  const subtotal = items.reduce((acc, it) => acc + it.total, 0);
  if (discount > subtotal) throw AppError.badRequest('O desconto não pode ser maior que o subtotal da venda.');
  return { subtotal, discount, total: subtotal - discount };
}

/**
 * Situação financeira de uma venda a partir das parcelas de pagamentos ATIVOS.
 *  - recebido:   parcelas "recebida" (dinheiro efetivamente recebido)
 *  - programado: parcelas "pendente" (ex.: cartão parcelado ainda não repassado, boleto a vencer)
 *  - pendente:   contratado − recebido
 *  - sem forma:  contratado − recebido − programado (nenhum pagamento combinado ainda)
 */
export function summarizeSale(total, installments = []) {
  let amountReceived = 0;
  let amountScheduled = 0;
  for (const inst of installments) {
    if (inst.status === 'recebida') amountReceived += inst.amount;
    else if (inst.status === 'pendente') amountScheduled += inst.amount;
  }
  const amountOutstanding = Math.max(0, total - amountReceived);
  const amountUnallocated = Math.max(0, total - amountReceived - amountScheduled);
  let paymentStatus = 'em_aberto';
  if (total === 0 || amountReceived >= total) paymentStatus = 'quitada';
  else if (amountReceived > 0) paymentStatus = 'parcial';
  return { amountReceived, amountScheduled, amountOutstanding, amountUnallocated, paymentStatus };
}

/** Garante que um novo pagamento não ultrapasse o saldo ainda sem forma de pagamento. */
export function assertPaymentFits(amount, summary) {
  if (amount > summary.amountUnallocated) {
    const fmt = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    throw AppError.badRequest(
      summary.amountUnallocated === 0
        ? 'Esta venda já possui pagamentos registrados para todo o valor contratado.'
        : `O valor informado excede o saldo disponível para pagamento (${fmt(summary.amountUnallocated)}).`,
    );
  }
}

/**
 * Preço de um serviço para uma quantidade.
 * - fixo: preço base × quantidade
 * - por_quantidade: preço TOTAL da faixa correspondente (sem multiplicar)
 */
export function servicePrice(service, quantity = 1) {
  if (service.pricingMode === 'por_quantidade') {
    const tier = (service.priceTiers || []).find((t) => t.quantity === quantity);
    if (!tier) {
      throw AppError.badRequest(
        `Não há faixa de preço configurada para ${quantity} ${service.quantityLabel || 'unidade'}(s) em "${service.name}".`,
      );
    }
    return tier.price;
  }
  return service.basePrice * quantity;
}

/** Preço de referência (soma dos itens), desconto e duração total de um pacote. */
export function computePackagePricing(items, price) {
  const referencePrice = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const durations = items.map((it) => (it.durationMinutes ? it.durationMinutes * it.quantity : null));
  const totalDurationMinutes = durations.every((d) => d === null) ? null : durations.reduce((a, d) => a + (d || 0), 0);
  return { referencePrice, discount: referencePrice - price, totalDurationMinutes };
}
