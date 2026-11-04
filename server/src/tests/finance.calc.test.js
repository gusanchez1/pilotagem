import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertPaymentFits,
  buildInstallmentSchedule,
  computePackagePricing,
  computeSaleTotals,
  servicePrice,
  splitAmount,
  summarizeSale,
} from '../services/finance.calc.js';
import { addMonthsKey, zonedToUtc, toDateKey } from '../utils/dates.js';

describe('Cálculos financeiros (unitários)', () => {
  it('divide parcelas em centavos sem perder valor (resto na 1ª parcela)', () => {
    assert.deepEqual(splitAmount(100000, 2), [50000, 50000]);
    assert.deepEqual(splitAmount(100001, 3), [33335, 33333, 33333]);
    const parts = splitAmount(43000, 7);
    assert.equal(parts.reduce((a, b) => a + b, 0), 43000);
  });

  it('rejeita parcelamento inválido', () => {
    assert.throws(() => splitAmount(0, 2));
    assert.throws(() => splitAmount(1000, 0));
  });

  it('gera cronograma mensal respeitando o fim do mês', () => {
    const schedule = buildInstallmentSchedule({ amount: 90000, count: 3, firstDueKey: '2026-01-31' });
    assert.deepEqual(
      schedule.map((s) => s.dueKey),
      ['2026-01-31', '2026-02-28', '2026-03-31'],
    );
    assert.equal(addMonthsKey('2026-12-15', 1), '2027-01-15');
  });

  it('calcula totais da venda e impede desconto maior que o subtotal', () => {
    const items = [{ total: 43000 }, { total: 25000 }];
    assert.deepEqual(computeSaleTotals(items, 8000), { subtotal: 68000, discount: 8000, total: 60000 });
    assert.throws(() => computeSaleTotals(items, 70000), /desconto/i);
  });

  it('exemplo do enunciado: R$ 2.000 = R$ 1.000 Pix recebido + R$ 1.000 crédito em 2x pendente', () => {
    const installments = [
      { amount: 100000, status: 'recebida' },
      { amount: 50000, status: 'pendente' },
      { amount: 50000, status: 'pendente' },
    ];
    const s = summarizeSale(200000, installments);
    assert.equal(s.amountReceived, 100000, 'somente o Pix conta como recebido');
    assert.equal(s.amountScheduled, 100000, 'cartão parcelado fica como programado');
    assert.equal(s.amountOutstanding, 100000, 'saldo pendente = contratado − recebido');
    assert.equal(s.amountUnallocated, 0);
    assert.equal(s.paymentStatus, 'parcial');
  });

  it('parcelas canceladas (estorno) não contam como recebidas nem programadas', () => {
    const s = summarizeSale(43000, [{ amount: 43000, status: 'cancelada' }]);
    assert.equal(s.amountReceived, 0);
    assert.equal(s.amountScheduled, 0);
    assert.equal(s.paymentStatus, 'em_aberto');
  });

  it('venda quitada quando o recebido alcança o contratado', () => {
    const s = summarizeSale(43000, [{ amount: 43000, status: 'recebida' }]);
    assert.equal(s.paymentStatus, 'quitada');
    assert.equal(s.amountOutstanding, 0);
  });

  it('impede pagamento acima do saldo sem forma de pagamento', () => {
    const summary = summarizeSale(100000, [{ amount: 60000, status: 'pendente' }]);
    assert.doesNotThrow(() => assertPaymentFits(40000, summary));
    assert.throws(() => assertPaymentFits(40001, summary), /excede/);
  });

  it('preço por quantidade usa o preço TOTAL da faixa (sem multiplicar)', () => {
    const rr = {
      name: 'Sessão Racing Room',
      pricingMode: 'por_quantidade',
      quantityLabel: 'simulador',
      priceTiers: [
        { quantity: 1, price: 25000 },
        { quantity: 2, price: 45000 },
        { quantity: 3, price: 60000 },
        { quantity: 4, price: 70000 },
      ],
    };
    assert.equal(servicePrice(rr, 2), 45000);
    assert.equal(servicePrice(rr, 4), 70000);
    assert.throws(() => servicePrice(rr, 5), /faixa/);
    assert.equal(servicePrice({ pricingMode: 'fixo', basePrice: 43000 }, 2), 86000);
  });

  it('calcula preço de referência, desconto e duração de pacotes', () => {
    const p = computePackagePricing(
      [
        { quantity: 4, unitPrice: 43000, durationMinutes: 60 },
        { quantity: 4, unitPrice: 43000, durationMinutes: 60 },
      ],
      310000,
    );
    assert.equal(p.referencePrice, 344000);
    assert.equal(p.discount, 34000);
    assert.equal(p.totalDurationMinutes, 480);
  });

  it('converte horário de São Paulo para UTC corretamente', () => {
    assert.equal(zonedToUtc('2026-11-03', '14:00').toISOString(), '2026-11-03T17:00:00.000Z');
    assert.equal(toDateKey(new Date('2026-11-04T02:30:00Z')), '2026-11-03');
  });
});
