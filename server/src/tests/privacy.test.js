import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AuditLog, Client } from '../models/index.js';
import { api, auth, setupDatabase, teardownDatabase, tokens } from './helpers/index.js';

let t;
let vip;

before(async () => {
  await setupDatabase();
  t = await tokens();
  vip = await Client.findOne({ confidential: true }).lean();
});
after(teardownDatabase);

const realName = () => `${vip.firstName} ${vip.lastName}`;

describe('Clientes confidenciais', () => {
  it('listagem mostra apenas o nome de exibição e oculta telefone', async () => {
    for (const profile of ['admin', 'recepcao', 'financeiro']) {
      const res = await api().get('/api/clients?confidential=true').set(auth(t[profile]));
      assert.equal(res.status, 200);
      const item = res.body.items.find((c) => c._id === String(vip._id));
      assert.equal(item.displayName, vip.alias);
      assert.equal(item.firstName, null);
      assert.equal(item.phone, null);
      assert.ok(!JSON.stringify(res.body).includes(vip.lastName), `${profile} não deve ver o sobrenome real`);
    }
  });

  it('busca pelo nome real só encontra o cliente para quem tem permissão', async () => {
    const rec = await api().get(`/api/clients?q=${encodeURIComponent(vip.firstName)}`).set(auth(t.recepcao));
    assert.ok(rec.body.items.some((c) => c._id === String(vip._id)));
    const fin = await api().get(`/api/clients?q=${encodeURIComponent(vip.firstName)}`).set(auth(t.financeiro));
    assert.ok(!fin.body.items.some((c) => c._id === String(vip._id)), 'financeiro não descobre o cliente pelo nome real');
  });

  it('revelar dados exige permissão e gera auditoria', async () => {
    const denied = await api().post(`/api/clients/${vip._id}/reveal`).set(auth(t.financeiro));
    assert.equal(denied.status, 403);

    const ok = await api().post(`/api/clients/${vip._id}/reveal`).set(auth(t.recepcao));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.realName, realName());
    assert.ok(ok.body.phone);
    const log = await AuditLog.findOne({ action: 'client.reveal', entityId: vip._id }).lean();
    assert.ok(log, 'acesso aos dados confidenciais foi auditado');
    assert.equal(log.userName, 'Larissa Mendes');
  });

  it('dashboards, agenda e relatórios nunca exibem o nome real', async () => {
    const dash = await api().get('/api/dashboard').set(auth(t.admin));
    assert.ok(!JSON.stringify(dash.body).includes(vip.lastName));

    const agenda = await api().get('/api/appointments?from=2020-01-01&to=2030-12-31').set(auth(t.recepcao));
    assert.ok(!JSON.stringify(agenda.body).includes(vip.lastName));

    for (const key of ['agendamentos', 'vendas']) {
      const rep = await api().get(`/api/reports/${key}?from=2020-01-01&to=2030-12-31`).set(auth(t.admin));
      assert.equal(rep.status, 200);
      assert.ok(!JSON.stringify(rep.body).includes(vip.lastName), `relatório ${key} sem dados identificáveis`);
    }
    const csv = await api().get('/api/reports/vendas/export?format=csv&from=2020-01-01&to=2030-12-31').set(auth(t.admin));
    assert.ok(!csv.text.includes(vip.lastName));
  });

  it('cadastra cliente com apenas nome, sobrenome e telefone', async () => {
    const res = await api().post('/api/clients').set(auth(t.recepcao)).send({ firstName: 'Teste', lastName: 'Minimo', phone: '11912345678' });
    assert.equal(res.status, 201);
    assert.equal(res.body.phone, '(11) 91234-5678');
    const bad = await api().post('/api/clients').set(auth(t.recepcao)).send({ firstName: 'Sem', lastName: 'Telefone' });
    assert.equal(bad.status, 400);
  });
});
