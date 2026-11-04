import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Installment, Payment } from '../models/index.js';
import { api, auth, fixtures, setupDatabase, teardownDatabase, tokens } from './helpers/index.js';

let t;
let fx;

before(async () => {
  await setupDatabase();
  t = await tokens();
  fx = await fixtures();
});
after(teardownDatabase);

const newSale = (total, token = t.financeiro) =>
  api()
    .post('/api/sales')
    .set(auth(token))
    .send({
      client: fx.client,
      items: [{ type: 'personalizado', description: 'Treinamento personalizado', unitPrice: total }],
    });

describe('Vendas, pagamentos parciais e parcelamentos', () => {
  let saleId;

  it('registra o exemplo do enunciado: R$ 2.000 com R$ 1.000 Pix + R$ 1.000 crédito em 2x', async () => {
    const sale = await newSale(200000);
    assert.equal(sale.status, 201);
    saleId = sale.body._id;
    assert.equal(sale.body.total, 200000);
    assert.equal(sale.body.amountReceived, 0);
    assert.equal(sale.body.paymentStatus, 'em_aberto');

    const pix = await api().post(`/api/sales/${saleId}/payments`).set(auth(t.financeiro)).send({ method: 'pix', amount: 100000, receiveNow: true });
    assert.equal(pix.status, 201);
    assert.equal(pix.body.amountReceived, 100000);
    assert.equal(pix.body.amountOutstanding, 100000);
    assert.equal(pix.body.paymentStatus, 'parcial');

    const card = await api()
      .post(`/api/sales/${saleId}/payments`)
      .set(auth(t.financeiro))
      .send({ method: 'cartao_credito', amount: 100000, installmentsCount: 2, firstDueDate: '2026-12-10' });
    assert.equal(card.status, 201);
    assert.equal(card.body.amountReceived, 100000, 'cartão parcelado NÃO conta como recebido');
    assert.equal(card.body.amountScheduled, 100000);
    assert.equal(card.body.amountUnallocated, 0);

    const cardPayment = card.body.payments.find((p) => p.method === 'cartao_credito');
    assert.deepEqual(cardPayment.installments.map((i) => i.amount), [50000, 50000]);
    assert.equal(cardPayment.installments[1].dueDate.slice(0, 10), '2027-01-10');
  });

  it('impede registrar pagamentos acima do valor contratado', async () => {
    const extra = await api().post(`/api/sales/${saleId}/payments`).set(auth(t.financeiro)).send({ method: 'pix', amount: 100 });
    assert.equal(extra.status, 400);
  });

  it('confirma o recebimento das parcelas e quita a venda', async () => {
    const pending = await Installment.find({ sale: saleId, status: 'pendente' }).sort({ number: 1 }).lean();
    assert.equal(pending.length, 2);
    for (const inst of pending) {
      const r = await api().post(`/api/installments/${inst._id}/receive`).set(auth(t.financeiro)).send({});
      assert.equal(r.status, 200);
    }
    const sale = await api().get(`/api/sales/${saleId}`).set(auth(t.financeiro));
    assert.equal(sale.body.amountReceived, 200000);
    assert.equal(sale.body.paymentStatus, 'quitada');
  });

  it('estorno mantém o histórico (não apaga) e reduz o recebido', async () => {
    const pix = await Payment.findOne({ sale: saleId, method: 'pix' }).lean();
    const r = await api().post(`/api/payments/${pix._id}/reverse`).set(auth(t.financeiro)).send({ reason: 'Pix devolvido' });
    assert.equal(r.status, 200);
    assert.equal(r.body.amountReceived, 100000);
    assert.equal(r.body.paymentStatus, 'parcial');
    const stored = await Payment.findById(pix._id).lean();
    assert.equal(stored.status, 'estornado', 'pagamento continua registrado como estornado');
    assert.equal(stored.reverseReason, 'Pix devolvido');
  });

  it('não cancela venda com valores recebidos; após estornos o cancelamento é permitido', async () => {
    const blocked = await api().post(`/api/sales/${saleId}/cancel`).set(auth(t.financeiro)).send({ reason: 'Teste' });
    assert.equal(blocked.status, 409);

    const card = await Payment.findOne({ sale: saleId, method: 'cartao_credito' }).lean();
    await api().post(`/api/payments/${card._id}/reverse`).set(auth(t.financeiro)).send({ reason: 'Chargeback' });
    const ok = await api().post(`/api/sales/${saleId}/cancel`).set(auth(t.financeiro)).send({ reason: 'Desistência' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'cancelada');
  });

  it('vendas canceladas e parcelas pendentes não entram como receita recebida', async () => {
    const before = (await api().get('/api/finance/summary').set(auth(t.financeiro))).body;
    const sale = await newSale(50000);
    await api()
      .post(`/api/sales/${sale.body._id}/payments`)
      .set(auth(t.financeiro))
      .send({ method: 'boleto', amount: 50000, firstDueDate: '2027-02-01' });
    const after = (await api().get('/api/finance/summary').set(auth(t.financeiro))).body;
    assert.equal(after.sold - before.sold, 50000, 'venda conta como vendido');
    assert.equal(after.received, before.received, 'boleto pendente não conta como recebido');
    assert.equal(after.scheduled - before.scheduled, 50000);

    await api().post(`/api/sales/${sale.body._id}/cancel`).set(auth(t.financeiro)).send({ reason: 'Teste' });
    const cancelled = (await api().get('/api/finance/summary').set(auth(t.financeiro))).body;
    assert.equal(cancelled.sold, before.sold, 'venda cancelada sai do total vendido');
    assert.equal(cancelled.scheduled, before.scheduled, 'parcelas da venda cancelada são canceladas');
  });

  it('preserva o preço histórico mesmo após alterar o catálogo', async () => {
    const appt = await api()
      .post('/api/appointments')
      .set(auth(t.recepcao))
      .send({
        client: fx.client,
        service: fx.service['Treinamento psicofísico'],
        instructor: fx.instructor.Camila,
        room: fx.room['PSI-01'],
        start: '2027-03-10T13:00:00.000Z',
        end: '2027-03-10T14:00:00.000Z',
        createSale: true,
      });
    assert.equal(appt.status, 201, JSON.stringify(appt.body));
    const saleId2 = appt.body.sale._id;

    const service = await api().get(`/api/services/${fx.service['Treinamento psicofísico']}`).set(auth(t.admin));
    const { _id, __v, createdAt, updatedAt, compatibleRooms, ...data } = service.body;
    const upd = await api()
      .put(`/api/services/${_id}`)
      .set(auth(t.admin))
      .send({ ...data, compatibleRooms: compatibleRooms.map((r) => r._id), basePrice: 99000 });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));

    const sale = await api().get(`/api/sales/${saleId2}`).set(auth(t.financeiro));
    assert.equal(sale.body.total, 43000, 'venda mantém o preço do momento da contratação');
    assert.equal(sale.body.items[0].unitPrice, 43000);
  });
});
