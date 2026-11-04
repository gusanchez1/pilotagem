import './helpers/test-env.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { api, auth, fixtures, futureSlot, setupDatabase, teardownDatabase, tokens } from './helpers/index.js';

let t;
let fx;

before(async () => {
  await setupDatabase();
  t = await tokens();
  fx = await fixtures();
});
after(teardownDatabase);

const reserve = (body, token = t.recepcao) => api().post('/api/reservations').set(auth(token)).send(body);
const schedule = (body, token = t.recepcao) => api().post('/api/appointments').set(auth(token)).send(body);

describe('Reservas de salas e equipamentos', () => {
  it('bloqueia reserva sobreposta na mesma sala e aceita horários adjacentes', async () => {
    const first = await reserve({ title: 'Locação teste', rooms: [fx.room['BRF-01']], usageType: 'locacao', ...futureSlot(60, '10:00', '11:00') });
    assert.equal(first.status, 201, JSON.stringify(first.body));

    const overlap = await reserve({ title: 'Conflito', rooms: [fx.room['BRF-01']], usageType: 'evento', ...futureSlot(60, '10:30', '11:30') });
    assert.equal(overlap.status, 409);
    assert.equal(overlap.body.error.details.conflicts[0].type, 'room');

    const adjacent = await reserve({ title: 'Logo depois', rooms: [fx.room['BRF-01']], usageType: 'locacao', ...futureSlot(60, '11:00', '12:00') });
    assert.equal(adjacent.status, 201, 'encostar no horário (11h–12h) não é conflito');

    // Reserva cancelada não bloqueia o horário
    const cancel = await api().post(`/api/reservations/${first.body._id}/cancel`).set(auth(t.recepcao)).send({ reason: 'Cliente desistiu' });
    assert.equal(cancel.status, 200);
    const again = await reserve({ title: 'Nova locação', rooms: [fx.room['BRF-01']], usageType: 'locacao', ...futureSlot(60, '10:00', '11:00') });
    assert.equal(again.status, 201);
  });

  it('não permite reservar equipamento em manutenção', async () => {
    const res = await reserve({ title: 'Uso do Pro 04', resources: [fx.resource['SIM-P04']], usageType: 'locacao', ...futureSlot(61, '10:00', '11:00') });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.conflicts[0].reason, 'manutencao');
  });

  it('valida cada recurso individualmente em reservas com várias salas e equipamentos', async () => {
    const slot = futureSlot(62, '18:00', '22:00');
    const event = await reserve({
      title: 'Evento com várias salas',
      rooms: [fx.room['EVT-01'], fx.room['BRF-01']],
      resources: [fx.resource['AV-PRJ1'], fx.resource['AV-SOM1']],
      usageType: 'evento',
      ...slot,
    });
    assert.equal(event.status, 201);

    const clash = await reserve({
      title: 'Outro evento',
      rooms: [fx.room['PSI-01']],
      resources: [fx.resource['AV-SOM1'], fx.resource['EQ-COG1']],
      usageType: 'evento',
      ...futureSlot(62, '20:00', '21:00'),
    });
    assert.equal(clash.status, 409);
    const conflicts = clash.body.error.details.conflicts;
    assert.equal(conflicts.length, 1, 'somente o sistema de som está ocupado');
    assert.equal(conflicts[0].id, fx.resource['AV-SOM1']);
  });

  it('impede reservas simultâneas concorrentes (apenas uma é aceita)', async () => {
    const body = { title: 'Corrida de requisições', rooms: [fx.room['BRF-01']], usageType: 'locacao', ...futureSlot(63, '15:00', '16:00') };
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve(body)));
    const statuses = results.map((r) => r.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1, `esperado 1 sucesso, obtido: ${statuses}`);
    assert.equal(statuses.filter((s) => s === 409).length, 5);
  });
});

describe('Agendamentos: instrutor, sala e simuladores', () => {
  const base = () => ({
    client: fx.client,
    service: fx.service['Sessão de simulador'],
    room: fx.room['SIM-01'],
    origin: 'recepcao',
  });

  it('sala compartilhada aceita treinamentos simultâneos com simuladores e instrutores diferentes', async () => {
    const slot = futureSlot(70, '14:00', '15:00');
    const a = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    const b = await schedule({ ...base(), instructor: fx.instructor.Eduardo, resources: [fx.resource['SIM-P02']], ...slot });
    assert.equal(b.status, 201, JSON.stringify(b.body));
  });

  it('bloqueia o mesmo simulador e o mesmo instrutor no mesmo horário', async () => {
    const slot = futureSlot(71, '09:00', '10:00');
    const ok = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(ok.status, 201);

    const sameSim = await schedule({ ...base(), instructor: fx.instructor.Eduardo, resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(sameSim.status, 409);
    assert.ok(sameSim.body.error.details.conflicts.some((c) => c.type === 'resource'));

    const sameInstructor = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P02']], ...futureSlot(71, '09:30', '10:30') });
    assert.equal(sameInstructor.status, 409);
    assert.ok(sameInstructor.body.error.details.conflicts.some((c) => c.type === 'instructor'));
  });

  it('locação da sala compartilhada conflita com treinamentos no mesmo horário', async () => {
    const slot = futureSlot(72, '16:00', '17:00');
    const training = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P03']], ...slot });
    assert.equal(training.status, 201);
    const rental = await reserve({ title: 'Locação da sala inteira', rooms: [fx.room['SIM-01']], usageType: 'locacao', ...slot });
    assert.equal(rental.status, 409);
  });

  it('exige instrutor e a quantidade de simuladores do serviço', async () => {
    const noInstructor = await schedule({ ...base(), resources: [fx.resource['SIM-P01']], ...futureSlot(73, '10:00', '11:00') });
    assert.equal(noInstructor.status, 400);

    const racing = await schedule({
      client: fx.client,
      service: fx.service['Sessão Racing Room'],
      room: fx.room['RR-01'],
      quantity: 3,
      resources: [fx.resource['SIM-R01'], fx.resource['SIM-R02']],
      ...futureSlot(73, '10:00', '11:00'),
    });
    assert.equal(racing.status, 400, 'pediu 3 simuladores e selecionou 2');
  });

  it('cancelamento libera o horário e remanejamento verifica disponibilidade', async () => {
    const slot = futureSlot(74, '11:00', '12:00');
    const a = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(a.status, 201);
    assert.equal(a.body.contractedAmount, 43000, 'preço do catálogo aplicado');

    const cancel = await api().post(`/api/appointments/${a.body._id}/status`).set(auth(t.recepcao)).send({ status: 'cancelado', reason: 'Cliente remarcou' });
    assert.equal(cancel.status, 200);

    const b = await schedule({ ...base(), instructor: fx.instructor.Thiago, resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(b.status, 201, 'horário liberado após cancelamento');

    const c = await schedule({ ...base(), instructor: fx.instructor.Eduardo, resources: [fx.resource['SIM-P02']], ...futureSlot(74, '13:00', '14:00') });
    assert.equal(c.status, 201);
    const move = await api().patch(`/api/appointments/${c.body._id}`).set(auth(t.recepcao)).send({ resources: [fx.resource['SIM-P01']], ...slot });
    assert.equal(move.status, 409, 'remanejar para simulador ocupado é bloqueado');

    const moveOk = await api().patch(`/api/appointments/${c.body._id}`).set(auth(t.recepcao)).send(futureSlot(74, '15:00', '16:00'));
    assert.equal(moveOk.status, 200);
    assert.ok(moveOk.body.history.some((h) => h.action === 'remanejado'));
  });
});
