import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PERMISSIONS as P, getPermissions } from '../config/permissions.js';
import { Appointment, AuditLog, Instructor } from '../models/index.js';
import { api, auth, setupDatabase, teardownDatabase, tokens } from './helpers/index.js';

let t;

before(async () => {
  await setupDatabase();
  t = await tokens();
});
after(teardownDatabase);

describe('Permissões por perfil (RBAC)', () => {
  it('define permissões coerentes para cada perfil', () => {
    const instrutor = getPermissions('instrutor', {});
    assert.ok(instrutor.includes(P.PORTAL_VIEW));
    assert.ok(!instrutor.includes(P.FINANCE_VIEW));
    assert.ok(!instrutor.includes(P.CLIENTS_VIEW));

    const financeiro = getPermissions('financeiro', {});
    assert.ok(financeiro.includes(P.EXPENSES_MANAGE));
    assert.ok(!financeiro.includes(P.CLIENTS_CONFIDENTIAL));
    assert.ok(!financeiro.includes(P.USERS_MANAGE));

    assert.ok(getPermissions('recepcao', { receptionCanManageSales: true }).includes(P.PAYMENTS_MANAGE));
    assert.ok(!getPermissions('recepcao', { receptionCanManageSales: false }).includes(P.PAYMENTS_MANAGE));
  });

  it('exige autenticação e rejeita token inválido', async () => {
    assert.equal((await api().get('/api/clients')).status, 401);
    assert.equal((await api().get('/api/clients').set(auth('token.invalido.x'))).status, 401);
  });

  it('não informa se o e-mail existe em tentativas de login', async () => {
    const wrongPwd = await api().post('/api/auth/login').send({ email: 'admin@pilotagem.local', password: 'errada123' });
    const noUser = await api().post('/api/auth/login').send({ email: 'ninguem@pilotagem.local', password: 'errada123' });
    assert.equal(wrongPwd.status, 401);
    assert.equal(wrongPwd.body.error.message, noUser.body.error.message);
  });

  const cases = [
    ['instrutor', 'get', '/api/sales', 403],
    ['instrutor', 'get', '/api/clients', 403],
    ['instrutor', 'get', '/api/dashboard', 403],
    ['instrutor', 'get', '/api/portal/summary', 200],
    ['recepcao', 'get', '/api/expenses', 403],
    ['recepcao', 'get', '/api/audit', 403],
    ['recepcao', 'get', '/api/users', 403],
    ['recepcao', 'get', '/api/reports/vendas', 403],
    ['recepcao', 'get', '/api/reports/agendamentos', 200],
    ['financeiro', 'get', '/api/reports/vendas', 200],
    ['financeiro', 'get', '/api/finance/summary', 200],
    ['financeiro', 'get', '/api/audit', 403],
    ['admin', 'get', '/api/audit', 200],
    ['admin', 'get', '/api/users', 200],
  ];
  for (const [profile, method, url, expected] of cases) {
    it(`${profile} ${method.toUpperCase()} ${url} → ${expected}`, async () => {
      const res = await api()[method](url).set(auth(t[profile]));
      assert.equal(res.status, expected, JSON.stringify(res.body).slice(0, 200));
    });
  }

  it('financeiro não pode criar agendamentos (validação no backend)', async () => {
    const res = await api().post('/api/appointments').set(auth(t.financeiro)).send({});
    assert.equal(res.status, 403);
  });

  it('recepção perde acesso a vendas quando o administrador revoga a autorização', async () => {
    const off = await api().patch('/api/settings').set(auth(t.admin)).send({ receptionCanManageSales: false });
    assert.equal(off.status, 200);
    const denied = await api().post('/api/sales').set(auth(t.recepcao)).send({ items: [] });
    assert.equal(denied.status, 403);
    await api().patch('/api/settings').set(auth(t.admin)).send({ receptionCanManageSales: true });
    const allowed = await api().post('/api/sales').set(auth(t.recepcao)).send({ items: [] });
    assert.equal(allowed.status, 400, 'com permissão, a requisição chega à validação');
    assert.ok(await AuditLog.exists({ action: 'settings.update' }));
  });

  it('instrutor só atualiza o status dos próprios treinamentos', async () => {
    const camila = await Instructor.findOne({ name: 'Camila Rocha' }).lean();
    const thiago = await Instructor.findOne({ name: 'Thiago Ventura' }).lean();
    const other = await Appointment.findOne({ instructor: camila._id, status: { $in: ['agendado', 'confirmado'] } }).lean();
    const own = await Appointment.findOne({ instructor: thiago._id, status: { $in: ['agendado', 'confirmado'] } }).lean();

    const denied = await api().post(`/api/portal/appointments/${other._id}/status`).set(auth(t.instrutor)).send({ status: 'em_andamento' });
    assert.equal(denied.status, 403);

    const ok = await api().post(`/api/portal/appointments/${own._id}/status`).set(auth(t.instrutor)).send({ status: 'em_andamento' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.contractedAmount, undefined, 'instrutor não recebe valores financeiros');

    const cancel = await api().post(`/api/portal/appointments/${own._id}/status`).set(auth(t.instrutor)).send({ status: 'cancelado', reason: 'x' });
    assert.equal(cancel.status, 403, 'instrutor não cancela agendamentos');

    const note = await api().post(`/api/portal/appointments/${own._id}/notes`).set(auth(t.instrutor)).send({ text: 'Ótima sessão.' });
    assert.equal(note.status, 200);
    assert.equal(note.body.sessionNotes.at(-1).text, 'Ótima sessão.');
  });
});
