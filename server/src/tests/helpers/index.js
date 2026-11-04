import './test-env.js';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../app.js';
import { connectDatabase } from '../../config/db.js';
import { env } from '../../config/env.js';
import { Client, Instructor, Resource, Room, Service } from '../../models/index.js';
import { seedDatabase } from '../../seed/seed.js';
import { clearSettingsCache } from '../../services/settings.service.js';
import { addDaysKey, toDateKey, zonedToUtc } from '../../utils/dates.js';

export const app = createApp();
export const api = () => request(app);

/** Conecta no banco de TESTES (MONGODB_URI_TEST) e carrega os dados de demonstração. */
export async function setupDatabase() {
  if (!env.mongoUri.includes('test')) throw new Error('Os testes só podem rodar em um banco com "test" no nome.');
  await connectDatabase();
  await seedDatabase({ quiet: true });
  clearSettingsCache();
}

export async function teardownDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export const CREDENTIALS = {
  admin: ['admin@pilotagem.local', 'Admin@123'],
  recepcao: ['recepcao1@pilotagem.local', 'Recepcao@123'],
  financeiro: ['financeiro@pilotagem.local', 'Financeiro@123'],
  instrutor: ['instrutor1@pilotagem.local', 'Instrutor@123'],
  instrutor2: ['instrutor2@pilotagem.local', 'Instrutor@123'],
};

export async function login(profile) {
  const [email, password] = CREDENTIALS[profile];
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Falha no login de ${profile}: ${res.status}`);
  return res.body.token;
}

export async function tokens() {
  const entries = await Promise.all(Object.keys(CREDENTIALS).map(async (p) => [p, await login(p)]));
  return Object.fromEntries(entries);
}

/** Horário em um dia bem no futuro (sem dados do seed), no fuso America/Sao_Paulo. */
export function futureSlot(daysAhead, from, to) {
  const day = addDaysKey(toDateKey(), daysAhead);
  return { start: zonedToUtc(day, from).toISOString(), end: zonedToUtc(day, to).toISOString() };
}

export async function fixtures() {
  const [rooms, resources, services, instructors, clients] = await Promise.all([
    Room.find().lean(),
    Resource.find().lean(),
    Service.find().lean(),
    Instructor.find().lean(),
    Client.find().lean(),
  ]);
  const byCode = (list) => Object.fromEntries(list.map((x) => [x.code, String(x._id)]));
  return {
    room: byCode(rooms),
    resource: byCode(resources),
    service: Object.fromEntries(services.map((s) => [s.name, String(s._id)])),
    instructor: Object.fromEntries(instructors.map((i) => [i.name.split(' ')[0], String(i._id)])),
    client: String(clients.find((c) => !c.confidential)._id),
    confidentialClient: clients.find((c) => c.confidential),
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
