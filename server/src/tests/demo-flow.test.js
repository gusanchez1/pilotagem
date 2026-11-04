import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, auth, fixtures, futureSlot, setupDatabase, teardownDatabase, tokens } from './helpers/index.js';
import { addDaysKey, toDateKey } from '../utils/dates.js';

/**
 * Fluxo principal da demonstração (seção 15 do enunciado), ponta a ponta via API.
 */
let t;
let fx;
before(async () => {
  await setupDatabase();
  t = await tokens();
  fx = await fixtures();
});
after(teardownDatabase);

describe('Fluxo completo da demonstração', () => {
  const ctx = {};

  it('1–2. recepção cadastra um cliente fictício', async () => {
    const res = await api().post('/api/clients').set(auth(t.recepcao)).send({ firstName: 'Bruna', lastName: 'Demonstração', phone: '(11) 95555-0101' });
    assert.equal(res.status, 201);
    ctx.client = res.body._id;
  });

  it('3–4. consulta pacotes e registra a venda de um pacote', async () => {
    const pkgs = await api().get('/api/packages').set(auth(t.recepcao));
    assert.equal(pkgs.status, 200);
    const pkg = pkgs.body.find((p) => p.name.startsWith('Pacote Evolução'));
    ctx.pkg = pkg._id;
    const sale = await api()
      .post('/api/sales')
      .set(auth(t.recepcao))
      .send({ client: ctx.client, items: [{ type: 'pacote', package: pkg._id, unitPrice: pkg.price }] });
    assert.equal(sale.status, 201);
    assert.equal(sale.body.total, pkg.price);
    assert.equal(sale.body.items[0].modality, 'Pacotes');
    ctx.sale = sale.body._id;
  });

  it('5–10. agenda a sessão com instrutor, sala e simulador, verificando disponibilidade', async () => {
    const slot = futureSlot(1, '21:00', '22:00');
    const check = await api()
      .post('/api/availability/check')
      .set(auth(t.recepcao))
      .send({ ...slot, instructor: fx.instructor.Thiago, rooms: [fx.room['SIM-01']], resources: [fx.resource['SIM-P02']] });
    assert.equal(check.status, 200);
    assert.equal(check.body.available, true, JSON.stringify(check.body.conflicts));

    const appt = await api()
      .post('/api/appointments')
      .set(auth(t.recepcao))
      .send({
        client: ctx.client,
        service: fx.service['Sessão de simulador'],
        package: ctx.pkg,
        sale: ctx.sale,
        instructor: fx.instructor.Thiago,
        room: fx.room['SIM-01'],
        resources: [fx.resource['SIM-P02']],
        status: 'confirmado',
        ...slot,
      });
    assert.equal(appt.status, 201, JSON.stringify(appt.body));
    assert.equal(appt.body.status, 'confirmado');
    assert.equal(appt.body.sale._id, ctx.sale);
    ctx.appt = appt.body._id;

    const sale = await api().get(`/api/sales/${ctx.sale}`).set(auth(t.financeiro));
    assert.ok(sale.body.appointments.some((a) => a._id === ctx.appt), 'agendamento vinculado à venda do pacote');
  });

  it('11–12. registra pagamento via Pix e atualiza recebido e saldo', async () => {
    const res = await api().post(`/api/sales/${ctx.sale}/payments`).set(auth(t.recepcao)).send({ method: 'pix', amount: 100000, receiveNow: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.amountReceived, 100000);
    assert.equal(res.body.amountOutstanding, res.body.total - 100000);
    assert.equal(res.body.paymentStatus, 'parcial');
  });

  it('13–14. instrutor consulta o treinamento e atualiza o status', async () => {
    const day = addDaysKey(toDateKey(), 1);
    const agenda = await api().get(`/api/portal/agenda?from=${day}&to=${day}`).set(auth(t.instrutor));
    const mine = agenda.body.find((a) => a._id === ctx.appt);
    assert.ok(mine, 'treinamento aparece no portal do instrutor');
    assert.equal(mine.client.displayName, 'Bruna Demonstração');
    assert.equal(mine.client.phone, undefined, 'instrutor não vê telefone');
    assert.equal(mine.sale, undefined, 'instrutor não vê dados financeiros');

    for (const status of ['em_andamento', 'concluido']) {
      const r = await api().post(`/api/portal/appointments/${ctx.appt}/status`).set(auth(t.instrutor)).send({ status });
      assert.equal(r.status, 200);
      assert.equal(r.body.status, status);
    }
  });

  it('15–16. administrador vê o dashboard com as informações financeiras atualizadas', async () => {
    const today = toDateKey();
    const dash = await api().get(`/api/dashboard?from=${today}&to=${today}`).set(auth(t.admin));
    assert.equal(dash.status, 200);
    assert.ok(dash.body.financial.summary.received >= 100000, 'Pix de hoje aparece como recebido');
    assert.ok(dash.body.financial.recentTransactions.some((m) => m.amount === 100000 && m.type === 'entrada'));
  });

  it('17. administrador gera o relatório do período (tela, CSV e PDF)', async () => {
    const today = toDateKey();
    const rep = await api().get(`/api/reports/vendas?from=${today}&to=${today}`).set(auth(t.admin));
    assert.equal(rep.status, 200);
    assert.ok(rep.body.rows.some((r) => r.client === 'Bruna Demonstração'));
    const csv = await api().get(`/api/reports/vendas/export?format=csv&from=${today}&to=${today}`).set(auth(t.admin));
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-type'], /text\/csv/);
    const pdf = await api().get(`/api/reports/resultado/export?format=pdf&from=${today}&to=${today}`).set(auth(t.admin)).buffer(true);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /application\/pdf/);
  });
});
