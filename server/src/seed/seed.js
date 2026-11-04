import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../config/env.js';
import {
  Appointment,
  AuditLog,
  Client,
  Counter,
  Expense,
  FinancialCategory,
  Installment,
  Instructor,
  Package,
  Payment,
  Reservation,
  Resource,
  Room,
  Sale,
  Service,
  Settings,
  User,
} from '../models/index.js';
import { computePackagePricing, splitAmount, summarizeSale } from '../services/finance.calc.js';
import { addDaysKey, addMonthsKey, firstDayOfMonthKey, toDateKey, zonedToUtc } from '../utils/dates.js';
import {
  CATEGORIES,
  DEMO_PASSWORDS,
  INSTRUCTORS,
  PACKAGES,
  RECURRING_EXPENSES,
  RESOURCES,
  ROOMS,
  SERVICES,
  SESSION_NOTES,
  USERS,
  buildClients,
} from './data.js';

/**
 * Popula o banco com dados demonstrativos coerentes.
 *
 * ATENÇÃO: apaga TODOS os dados do banco configurado. Nunca é executado automaticamente na
 * inicialização — apenas por `npm run seed` ou pelo botão "Restaurar dados de demonstração".
 *
 * As datas são relativas ao dia da execução (≈5 meses de histórico + 3 semanas de agenda futura),
 * para que a demonstração sempre tenha "agendamentos de hoje" e gráficos preenchidos.
 * O gerador é determinístico (semente fixa): a mesma data produz os mesmos dados.
 */
export async function seedDatabase({ quiet = false } = {}) {
  const log = quiet ? () => {} : (msg) => console.log(`  • ${msg}`);
  const oid = () => new mongoose.Types.ObjectId();

  // Gerador pseudoaleatório determinístico (mulberry32)
  let s = 20261103;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const chance = (p) => rand() < p;
  const weighted = (pairs) => {
    const total = pairs.reduce((a, [, w]) => a + w, 0);
    let r = rand() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r <= 0) return v;
    }
    return pairs[0][0];
  };

  /* ── Limpeza ───────────────────────────────────────────── */
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  const receiptsDir = join(env.uploadsDir, 'receipts');
  if (existsSync(receiptsDir)) for (const f of readdirSync(receiptsDir)) unlinkSync(join(receiptsDir, f));
  log('Banco limpo');

  const today = toDateKey();
  const now = new Date();
  const at = (key, time) => zonedToUtc(key, time);
  const weekday = (key) => new Date(`${key}T12:00:00Z`).getUTCDay();

  /* ── Configurações e categorias ────────────────────────── */
  await Settings.create({ _id: 'global' });
  const categories = await FinancialCategory.insertMany(CATEGORIES);
  const cat = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  /* ── Instrutores e usuários ────────────────────────────── */
  const instructors = {};
  for (const i of INSTRUCTORS) {
    const { key, services: _services, ...doc } = i;
    instructors[key] = await Instructor.create(doc);
  }
  const hashes = {};
  for (const [role, pwd] of Object.entries(DEMO_PASSWORDS)) hashes[role] = await bcrypt.hash(pwd, 10);
  const users = {};
  for (const u of USERS) {
    users[u.key] = await User.create({
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash: hashes[u.role],
      instructor: u.instructor ? instructors[u.instructor]._id : null,
    });
  }
  const userByInstructor = Object.fromEntries(USERS.filter((u) => u.instructor).map((u) => [u.instructor, users[u.key]]));
  const reception = [users.rec1, users.rec2];
  log(`${USERS.length} usuários e ${INSTRUCTORS.length} instrutores`);

  /* ── Salas, equipamentos, serviços e pacotes ───────────── */
  const rooms = {};
  for (const r of ROOMS) {
    const { key, ...doc } = r;
    rooms[key] = await Room.create(doc);
  }
  const resources = {};
  for (const r of RESOURCES) {
    const { key, room, ...doc } = r;
    resources[key] = await Resource.create({ ...doc, room: rooms[room]._id, location: rooms[room].name });
  }
  const services = {};
  for (const sv of SERVICES) {
    const { key, rooms: compat, ...doc } = sv;
    services[key] = await Service.create({ ...doc, compatibleRooms: compat.map((k) => rooms[k]._id) });
  }
  const packages = {};
  for (const p of PACKAGES) {
    const items = p.items.map((it) => ({
      service: services[it.service]._id,
      quantity: it.quantity,
      durationMinutes: services[it.service].durationMinutes,
      unitPrice: it.unitPrice ?? services[it.service].basePrice,
    }));
    packages[p.key] = await Package.create({
      name: p.name,
      description: p.description,
      items,
      simulatorCount: p.simulatorCount,
      price: p.price,
      validityDays: p.validityDays,
      ...computePackagePricing(items, p.price),
    });
  }
  log(`${ROOMS.length} salas, ${RESOURCES.length} equipamentos, ${SERVICES.length} serviços, ${PACKAGES.length} pacotes`);

  /* ── Clientes ──────────────────────────────────────────── */
  const startKey = addDaysKey(today, -150);
  const clientDocs = buildClients().map((c, i) => ({
    ...c,
    code: `CL-${String(i + 1).padStart(4, '0')}`,
    createdBy: pick(reception)._id,
    createdAt: at(addDaysKey(startKey, Math.min(140, i * 4)), '10:00'),
  }));
  const clients = await Client.insertMany(clientDocs);
  const regularClients = clients.filter((c) => !c.confidential);
  const confidentialClients = clients.filter((c) => c.confidential);
  const randomClient = () => (chance(0.07) ? pick(confidentialClients) : pick(regularClients));
  log(`${clients.length} clientes (${confidentialClients.length} confidenciais)`);

  /* ── Estruturas em memória ─────────────────────────────── */
  const appointments = [];
  const reservations = [];
  const sales = [];
  const payments = [];
  const installments = [];
  const busy = new Map();
  const isFree = (keys, a, b) => keys.every((k) => !(busy.get(k) || []).some(([x, y]) => a < y && x < b));
  const occupy = (keys, a, b) => keys.forEach((k) => (busy.has(k) ? busy.get(k) : busy.set(k, []).get(k)).push([a, b]));

  const RES_STATUS = {
    solicitado: 'pendente',
    agendado: 'confirmada',
    confirmado: 'confirmada',
    em_andamento: 'em_uso',
    concluido: 'concluida',
    cancelado: 'cancelada',
    nao_compareceu: 'cancelada',
  };
  const categoryFor = (serviceKey) =>
    ({ sim: 'Treinamentos', psico: 'Treinamentos', rr: 'Racing Room', aluguel: 'Locações', selection: 'Pacotes e programas' })[serviceKey];

  function statusFor(start, end) {
    if (end <= now) return weighted([['concluido', 86], ['cancelado', 8], ['nao_compareceu', 6]]);
    if (start <= now) return 'em_andamento';
    return weighted([['confirmado', 50], ['agendado', 40], ['solicitado', 10]]);
  }

  function originFor(serviceKey) {
    if (serviceKey === 'rr') return weighted([['site_racing_room', 50], ['whatsapp', 20], ['recepcao', 15], ['telefone', 15]]);
    return weighted([['recepcao', 30], ['whatsapp', 25], ['site_pilotech', 25], ['telefone', 15], ['outro', 5]]);
  }

  /** Tenta alocar instrutor/sala/equipamentos sem conflito. Retorna o agendamento ou null. */
  function tryAppointment({ serviceKey, dayKey, hour, client, quantity = 1, pkg = null, forcedStatus = null }) {
    const svc = services[serviceKey];
    const duration = svc.durationMinutes ?? 120;
    const start = at(dayKey, `${String(hour).padStart(2, '0')}:00`);
    const end = new Date(start.getTime() + duration * 60_000);

    let instructorKey = null;
    if (svc.requiresInstructor) {
      const candidates = INSTRUCTORS.filter((i) => i.services.includes(serviceKey)).map((i) => i.key);
      instructorKey = candidates.sort(() => rand() - 0.5).find((k) => isFree([`ins:${k}`], start, end));
      if (!instructorKey) return null;
    }

    let room = null;
    let resKeys = [];
    const roomKeys = [];
    if (serviceKey === 'sim') {
      room = 'sim';
      const sim = ['simp1', 'simp2', 'simp3'].sort(() => rand() - 0.5).find((k) => isFree([`res:${k}`], start, end));
      if (!sim) return null;
      resKeys = [sim];
    } else if (serviceKey === 'rr') {
      room = 'rr';
      const freeSims = ['rr1', 'rr2', 'rr3', 'rr4'].filter((k) => isFree([`res:${k}`], start, end));
      if (freeSims.length < quantity) return null;
      resKeys = freeSims.slice(0, quantity);
    } else if (serviceKey === 'psico') {
      room = 'psi';
      roomKeys.push('room:psi');
      if (chance(0.5)) resKeys = [pick(['kit', 'react'])];
    } else if (serviceKey === 'aluguel') {
      const sim = ['simp1', 'simp2', 'simp3'].find((k) => isFree([`res:${k}`], start, end));
      if (!sim) return null;
      resKeys = [sim];
    } else if (serviceKey === 'selection') {
      room = 'brf';
      roomKeys.push('room:brf');
    }

    const keys = [...(instructorKey ? [`ins:${instructorKey}`] : []), ...roomKeys, ...resKeys.map((k) => `res:${k}`)];
    if (!isFree(keys, start, end)) return null;

    const status = forcedStatus || statusFor(start, end);
    if (!['cancelado', 'nao_compareceu'].includes(status)) occupy(keys, start, end);

    const creator = pick(reception);
    const appt = {
      _id: oid(),
      client: client._id,
      clientDoc: client,
      service: svc._id,
      serviceKey,
      package: pkg?._id ?? null,
      sale: null,
      instructor: instructorKey ? instructors[instructorKey]._id : null,
      instructorKey,
      room: room ? rooms[room]._id : null,
      resources: resKeys.map((k) => resources[k]._id),
      quantity,
      start,
      end,
      dayKey,
      contractedAmount: pkg ? 0 : serviceKey === 'rr' ? svc.priceTiers.find((t) => t.quantity === quantity).price : svc.basePrice,
      origin: originFor(serviceKey),
      status,
      notes: chance(0.12) ? pick(['Cliente pediu para chegar 15 min antes.', 'Trazer sapatilha própria.', 'Primeira sessão — fazer briefing de segurança.']) : '',
      sessionNotes: [],
      history: [{ at: start, by: creator._id, byName: creator.name, action: 'criado', description: 'Agendamento registrado' }],
      cancelReason: status === 'cancelado' ? pick(['Cliente remarcou para outra data', 'Imprevisto pessoal do cliente', 'Problema de saúde']) : '',
      createdBy: creator._id,
      reservation: null,
    };
    if (status === 'concluido' && instructorKey && chance(0.35)) {
      const author = userByInstructor[instructorKey];
      appt.sessionNotes.push({ _id: oid(), author: author._id, authorName: author.name, text: pick(SESSION_NOTES), createdAt: end });
    }
    if (room || resKeys.length) {
      const res = {
        _id: oid(),
        title: `${svc.name} — ${client.confidential ? client.alias : `${client.firstName} ${client.lastName}`}`,
        client: client._id,
        appointment: appt._id,
        rooms: room ? [rooms[room]._id] : [],
        resources: appt.resources,
        start,
        end,
        usageType: 'treinamento',
        status: RES_STATUS[status],
        createdBy: creator._id,
        cancelledAt: RES_STATUS[status] === 'cancelada' ? start : null,
        cancelReason: RES_STATUS[status] === 'cancelada' ? appt.cancelReason || 'Não compareceu' : '',
      };
      reservations.push(res);
      appt.reservation = res._id;
    }
    appointments.push(appt);
    return appt;
  }

  /* ── Vendas, pagamentos e parcelas ─────────────────────── */
  function addSale({ client, items, saleKey, dueKey, category, terms = 'antecipado', appts = [], reservation = null, status = 'ativa', cancelReason = '', createdBy, description }) {
    const fullItems = items.map((it) => ({ _id: oid(), quantity: 1, discount: 0, ...it, total: (it.quantity ?? 1) * it.unitPrice - (it.discount ?? 0) }));
    const subtotal = fullItems.reduce((a, it) => a + it.total, 0);
    const sale = {
      _id: oid(),
      client: client?._id ?? null,
      items: fullItems,
      appointments: appts.map((a) => a._id),
      reservation,
      saleDate: at(saleKey, '12:00'),
      dueDate: at(dueKey || saleKey, '12:00'),
      description: description || fullItems.map((i) => i.description).join(' + '),
      subtotal,
      discount: 0,
      total: subtotal,
      category: cat[category],
      paymentTerms: terms,
      notes: '',
      status,
      cancelReason,
      cancelledAt: status === 'cancelada' ? at(saleKey, '15:00') : null,
      cancelledBy: status === 'cancelada' ? users.admin._id : null,
      createdBy: createdBy?._id ?? pick(reception)._id,
      saleKey,
    };
    appts.forEach((a) => (a.sale = sale._id));
    sales.push(sale);
    return sale;
  }

  /**
   * @param receive (number, dueKey) => receivedKey | null
   */
  function addPayment(sale, { method, amount, count = 1, firstDueKey, receive, reversed = false, by }) {
    const pay = {
      _id: oid(),
      sale: sale._id,
      client: sale.client,
      method,
      amount,
      installmentsCount: count,
      notes: '',
      receiptReference: method === 'pix' && chance(0.5) ? `Comprovante Pix enviado no WhatsApp da recepção — E${int(10000000, 99999999)}` : '',
      status: reversed ? 'estornado' : 'ativo',
      reversedAt: reversed ? at(firstDueKey, '16:00') : null,
      reversedBy: reversed ? users.fin._id : null,
      reverseReason: reversed ? 'Valor devolvido ao cliente após cancelamento' : '',
      createdBy: (by ?? pick(reception))._id,
      createdAt: at(sale.saleKey <= firstDueKey ? sale.saleKey : firstDueKey, '11:00'),
    };
    payments.push(pay);
    splitAmount(amount, count).forEach((value, i) => {
      const dueKey = addMonthsKey(firstDueKey, i);
      const receivedKey = reversed ? null : receive(i + 1, dueKey);
      installments.push({
        _id: oid(),
        sale: sale._id,
        payment: pay._id,
        client: sale.client,
        number: i + 1,
        totalInstallments: count,
        amount: value,
        dueDate: at(dueKey, '12:00'),
        method,
        status: reversed ? 'cancelada' : receivedKey ? 'recebida' : 'pendente',
        receivedAt: receivedKey ? at(receivedKey, `${String(int(9, 18)).padStart(2, '0')}:${pick(['05', '20', '35', '50'])}`) : null,
        receivedBy: receivedKey ? users.fin._id : null,
        cancelledAt: reversed ? at(firstDueKey, '16:00') : null,
      });
    });
    return pay;
  }

  const receivedIfDue = (_n, dueKey) => (dueKey <= today ? dueKey : null);
  const instantMethod = () => weighted([['pix', 60], ['dinheiro', 12], ['cartao_debito', 28]]);

  /** Aplica um padrão de pagamento realista à venda. */
  function applyPayments(sale, apptKey, past) {
    const total = sale.total;
    const kind = past
      ? weighted([['avista', 62], ['cartao', 18], ['parcial', 10], ['posterior', 10]])
      : weighted([['avista', 45], ['cartao', 20], ['nenhum', 35]]);
    const saleKey = sale.saleKey;

    if (kind === 'avista') {
      addPayment(sale, { method: instantMethod(), amount: total, firstDueKey: saleKey, receive: receivedIfDue });
    } else if (kind === 'cartao') {
      const count = total >= 100000 ? int(2, 3) : int(1, 2);
      sale.paymentTerms = count > 1 ? 'parcelado' : 'antecipado';
      addPayment(sale, { method: 'cartao_credito', amount: total, count, firstDueKey: addDaysKey(saleKey, 30), receive: receivedIfDue });
    } else if (kind === 'parcial') {
      const first = Math.round(total / 2 / 100) * 100;
      sale.paymentTerms = 'posterior';
      addPayment(sale, { method: 'pix', amount: first, firstDueKey: saleKey, receive: receivedIfDue });
      const due = addDaysKey(apptKey, 10);
      const paid = chance(0.8);
      addPayment(sale, {
        method: 'boleto',
        amount: total - first,
        firstDueKey: due,
        receive: (_n, d) => (paid && d <= today ? d : null),
      });
    } else if (kind === 'posterior') {
      sale.paymentTerms = 'posterior';
      sale.dueDate = at(addDaysKey(apptKey, 7), '12:00');
      const due = addDaysKey(apptKey, 7);
      if (chance(0.8) && due <= today) {
        addPayment(sale, { method: 'pix', amount: total, firstDueKey: due, receive: receivedIfDue });
      }
    } else {
      sale.paymentTerms = 'no_dia';
      sale.dueDate = at(apptKey, '12:00');
    }
  }

  /* ── 1) Pacotes vendidos (geram sessões semanais) ──────── */
  const pkgStarts = Array.from({ length: 11 }, (_, i) => addDaysKey(startKey, 4 + i * 13 + int(0, 5))).filter((k) => k <= today);
  for (const purchaseKey of pkgStarts) {
    const pkgKey = weighted([['evolucao', 50], ['completo', 25], ['grupo', 25]]);
    const pkg = packages[pkgKey];
    const client = chance(0.12) ? pick(confidentialClients) : pick(regularClients);
    const sale = addSale({
      client,
      items: [{ type: 'pacote', package: pkg._id, description: pkg.name, modality: 'Pacotes', unitPrice: pkg.price }],
      saleKey: purchaseKey,
      category: 'Pacotes e programas',
      terms: 'parcelado',
    });
    if (chance(0.6)) {
      addPayment(sale, { method: 'cartao_credito', amount: pkg.price, count: 3, firstDueKey: addDaysKey(purchaseKey, 30), receive: receivedIfDue });
    } else {
      sale.paymentTerms = 'antecipado';
      addPayment(sale, { method: 'pix', amount: pkg.price, firstDueKey: purchaseKey, receive: receivedIfDue });
    }
    let session = 0;
    for (const item of PACKAGES.find((p) => p.key === pkgKey).items) {
      for (let q = 0; q < item.quantity; q += 1) {
        let created = null;
        for (let attempt = 0; attempt < 12 && !created; attempt += 1) {
          let day = addDaysKey(purchaseKey, 3 + session * 7 + attempt);
          if (weekday(day) === 0) day = addDaysKey(day, 1);
          if (day > addDaysKey(today, 21)) break;
          created = tryAppointment({
            serviceKey: item.service,
            dayKey: day,
            hour: int(9, 20),
            client,
            quantity: item.service === 'rr' ? 4 : 1,
            pkg,
          });
        }
        if (created) {
          created.sale = sale._id;
          sale.appointments.push(created._id);
        }
        session += 1;
      }
    }
  }

  /* ── 2) Agenda diária (passado, hoje e futuro) ─────────── */
  const endKey = addDaysKey(today, 21);
  for (let day = startKey; day <= endKey; day = addDaysKey(day, 1)) {
    const wd = weekday(day);
    if (wd === 0) continue;
    const isToday = day === today;
    const future = day > today;
    const target = isToday ? 7 : future ? int(1, 4) : wd === 6 ? int(4, 7) : int(2, 5);
    for (let n = 0, guard = 0; n < target && guard < 30; guard += 1) {
      const serviceKey = weighted([['sim', 42], ['rr', 27], ['psico', 22], ['selection', 3]]);
      const hours = serviceKey === 'selection' ? [9, 10, 14, 15, 16] : [9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
      const quantity = serviceKey === 'rr' ? weighted([[1, 30], [2, 35], [3, 20], [4, 15]]) : 1;
      const appt = tryAppointment({ serviceKey, dayKey: day, hour: pick(hours), client: randomClient(), quantity });
      if (!appt) continue;
      n += 1;

      const past = appt.end <= now;
      const saleKey = past ? (addDaysKey(day, -int(0, 6)) < startKey ? day : addDaysKey(day, -int(0, 6))) : (() => {
        const k = addDaysKey(today, -int(0, 10));
        return k > day ? day : k;
      })();

      if (appt.status === 'cancelado') {
        if (chance(0.3)) {
          const sale = addSale({
            client: appt.clientDoc,
            items: [{ type: 'servico', service: appt.service, description: services[serviceKey].name, modality: services[serviceKey].category, unitPrice: appt.contractedAmount }],
            saleKey,
            category: categoryFor(serviceKey),
            appts: [appt],
            status: 'cancelada',
            cancelReason: 'Agendamento cancelado pelo cliente',
          });
          if (chance(0.5)) addPayment(sale, { method: 'pix', amount: sale.total, firstDueKey: saleKey, receive: receivedIfDue, reversed: true });
        }
        continue;
      }
      if (appt.status === 'solicitado' && chance(0.6)) continue; // solicitações ainda sem venda

      const svc = services[serviceKey];
      const description = serviceKey === 'rr' ? `${svc.name} — ${quantity} simulador${quantity > 1 ? 'es' : ''}` : svc.name;
      const sale = addSale({
        client: appt.clientDoc,
        items: [{ type: 'servico', service: appt.service, description, modality: svc.category, unitPrice: appt.contractedAmount }],
        saleKey,
        category: categoryFor(serviceKey),
        appts: [appt],
      });
      applyPayments(sale, day, past);
    }
  }

  /* ── 3) Aluguel de simulador (12h) — cerca de 1 por mês ── */
  for (let k = addDaysKey(startKey, 9); k <= addDaysKey(today, 14); k = addDaysKey(k, int(26, 34))) {
    let day = k;
    while (weekday(day) !== 6) day = addDaysKey(day, 1);
    const client = pick(regularClients);
    const appt = tryAppointment({ serviceKey: 'aluguel', dayKey: day, hour: 9, client });
    if (!appt || appt.status === 'cancelado') continue;
    const saleKey = addDaysKey(day, -int(5, 12)) > today ? today : addDaysKey(day, -int(5, 12));
    const sale = addSale({
      client,
      items: [{ type: 'locacao', service: appt.service, description: 'Aluguel de simulador — 12 horas', modality: 'Locação', unitPrice: appt.contractedAmount }],
      saleKey,
      category: 'Locações',
      terms: 'parcelado',
      appts: [appt],
    });
    addPayment(sale, { method: 'pix', amount: 200000, firstDueKey: saleKey, receive: receivedIfDue });
    addPayment(sale, { method: 'cartao_credito', amount: 400000, count: 2, firstDueKey: addDaysKey(saleKey, 30), receive: receivedIfDue });
  }

  /* ── 4) Reservas avulsas: reuniões, locações, eventos, manutenção ── */
  function addReservation({ title, client = null, responsible = '', roomKeys = [], resKeys = [], dayKey, from, to, usageType, amount = 0, notes = '' }) {
    const start = at(dayKey, from);
    const end = to === '24:00' ? at(addDaysKey(dayKey, 1), '00:00') : at(dayKey, to);
    const keys = [...roomKeys.map((k) => `room:${k}`), ...resKeys.map((k) => `res:${k}`)];
    if (!isFree(keys, start, end)) return null;
    occupy(keys, start, end);
    const status = end <= now ? 'concluida' : start <= now ? 'em_uso' : 'confirmada';
    const r = {
      _id: oid(),
      title,
      client: client?._id ?? null,
      responsible,
      rooms: roomKeys.map((k) => rooms[k]._id),
      resources: resKeys.map((k) => resources[k]._id),
      start,
      end,
      usageType,
      amount,
      status,
      notes,
      createdBy: pick(reception)._id,
    };
    reservations.push(r);
    return r;
  }

  for (let day = startKey; day <= endKey; day = addDaysKey(day, 1)) {
    const wd = weekday(day);
    if (wd === 1) {
      addReservation({ title: 'Reunião semanal da equipe', responsible: 'Marina Duarte', roomKeys: ['brf'], dayKey: day, from: '08:00', to: '09:00', usageType: 'uso_interno' });
    }
    if (wd === 2 && Number(day.slice(8)) <= 7) {
      for (const sim of ['simp1', 'simp2', 'simp3']) {
        addReservation({ title: `Manutenção preventiva — ${resources[sim].name}`, responsible: 'Equipe técnica', resKeys: [sim], dayKey: day, from: '07:00', to: '09:00', usageType: 'manutencao' });
      }
    }
  }

  // Locações da sala de briefing (≈ a cada 3 semanas) e eventos corporativos (≈ a cada 5 semanas)
  for (let k = addDaysKey(startKey, 6); k <= addDaysKey(today, 12); k = addDaysKey(k, int(18, 24))) {
    let day = k;
    while (![3, 4].includes(weekday(day))) day = addDaysKey(day, 1);
    const client = pick(regularClients);
    const r = addReservation({
      title: 'Locação — workshop de equipe de kart',
      client,
      roomKeys: ['brf'],
      dayKey: day,
      from: '14:00',
      to: '17:00',
      usageType: 'locacao',
      amount: 45000,
    });
    if (!r) continue;
    const saleKey = addDaysKey(day, -int(2, 7)) > today ? today : addDaysKey(day, -int(2, 7));
    const sale = addSale({
      client,
      items: [{ type: 'locacao', description: 'Locação da Sala de Briefing — 3 horas', modality: 'Locação', unitPrice: 45000 }],
      saleKey,
      category: 'Locações',
      reservation: r._id,
    });
    r.sale = sale._id;
    addPayment(sale, { method: 'pix', amount: 45000, firstDueKey: saleKey, receive: receivedIfDue });
  }

  for (let k = addDaysKey(startKey, 15); k <= addDaysKey(today, 16); k = addDaysKey(k, int(32, 40))) {
    let day = k;
    while (weekday(day) !== 5) day = addDaysKey(day, 1);
    const client = pick(regularClients);
    const r = addReservation({
      title: 'Evento corporativo — disputa entre equipes',
      client,
      responsible: `${client.firstName} ${client.lastName}`,
      roomKeys: ['evt', 'rr'],
      resKeys: ['proj', 'som', 'rr1', 'rr2', 'rr3', 'rr4'],
      dayKey: day,
      from: '19:00',
      to: '23:00',
      usageType: 'evento',
      amount: 480000,
      notes: 'Inclui Espaço de Eventos, Racing Room completa, projetor e som. Coffee break por conta do cliente.',
    });
    if (!r) continue;
    const saleKey = addDaysKey(day, -int(10, 20)) > today ? today : addDaysKey(day, -int(10, 20));
    const sale = addSale({
      client,
      items: [{ type: 'personalizado', description: 'Evento corporativo — Espaço de Eventos + Racing Room (4h)', modality: 'Eventos', unitPrice: 480000 }],
      saleKey,
      category: 'Eventos',
      terms: 'parcelado',
      reservation: r._id,
    });
    r.sale = sale._id;
    addPayment(sale, { method: 'pix', amount: 240000, firstDueKey: saleKey, receive: receivedIfDue });
    addPayment(sale, { method: 'boleto', amount: 240000, firstDueKey: day, receive: receivedIfDue });
  }

  // Manutenção atual do Simulador Pro 04 (equipamento com status "manutenção")
  addReservation({
    title: 'Manutenção corretiva — Simulador Pro 04',
    responsible: 'Equipe técnica',
    resKeys: ['simp4'],
    dayKey: addDaysKey(today, -2),
    from: '08:00',
    to: '24:00',
    usageType: 'manutencao',
    notes: 'Troca da base de movimento. Previsão de retorno em 5 dias.',
  });

  /* ── 5) Exemplo do enunciado: R$ 2.000 = R$ 1.000 Pix + R$ 1.000 crédito em 2x ── */
  const exampleClient = regularClients.find((c) => c.firstName === 'Rafael');
  const exampleKey = addDaysKey(today, -5);
  const exampleSale = addSale({
    client: exampleClient,
    items: [{ type: 'personalizado', description: 'Programa personalizado de pilotagem — 4 sessões', modality: 'Programas', unitPrice: 200000 }],
    saleKey: exampleKey,
    category: 'Pacotes e programas',
    terms: 'parcelado',
    createdBy: users.rec1,
  });
  exampleSale.notes = 'Exemplo de fluxo financeiro: entrada via Pix e saldo no cartão de crédito em 2x.';
  addPayment(exampleSale, { method: 'pix', amount: 100000, firstDueKey: exampleKey, receive: () => exampleKey, by: users.rec1 });
  addPayment(exampleSale, { method: 'cartao_credito', amount: 100000, count: 2, firstDueKey: addDaysKey(exampleKey, 30), receive: () => null, by: users.rec1 });

  /* ── Totais derivados das vendas ───────────────────────── */
  const instBySale = new Map();
  for (const i of installments) (instBySale.get(String(i.sale)) ?? instBySale.set(String(i.sale), []).get(String(i.sale))).push(i);
  for (const sale of sales) {
    const list = (instBySale.get(String(sale._id)) || []).filter((i) => i.status !== 'cancelada');
    Object.assign(sale, summarizeSale(sale.total, list)); // mesma regra de finance.service#recalcSale
  }

  /* ── Códigos sequenciais em ordem cronológica ──────────── */
  const counters = {};
  const codeFor = (prefix, date, yearly = true) => {
    const key = yearly ? `${prefix}-${toDateKey(date).slice(0, 4)}` : prefix;
    counters[key] = (counters[key] ?? 0) + 1;
    return `${key}-${String(counters[key]).padStart(4, '0')}`;
  };
  sales.sort((a, b) => a.saleDate - b.saleDate).forEach((sale) => (sale.code = codeFor('V', sale.saleDate)));
  appointments.sort((a, b) => a.start - b.start).forEach((a) => (a.code = codeFor('AG', a.start, false)));
  reservations.sort((a, b) => a.start - b.start).forEach((r) => (r.code = codeFor('R', r.start, false)));

  /* ── 6) Despesas mensais ───────────────────────────────── */
  const expenses = [];
  const receivedByMonth = {};
  for (const i of installments) if (i.status === 'recebida') {
    const m = toDateKey(i.receivedAt).slice(0, 7);
    receivedByMonth[m] = (receivedByMonth[m] ?? 0) + i.amount;
  }
  const addExpense = (description, category, amount, dueKey, supplier = '', { forcePending = false } = {}) => {
    const paid = !forcePending && dueKey <= today;
    const paidKey = paid ? addDaysKey(dueKey, -int(0, 2)) : null;
    expenses.push({
      description,
      category: cat[category],
      amount,
      dueDate: at(dueKey, '12:00'),
      paidAt: paidKey ? at(paidKey, '10:00') : null,
      method: paid ? pick(['pix', 'boleto', 'boleto']) : null,
      status: paid ? 'paga' : 'pendente',
      supplier,
      createdBy: users.fin._id,
    });
  };
  for (let month = firstDayOfMonthKey(startKey); month <= addMonthsKey(firstDayOfMonthKey(today), 1); month = addMonthsKey(month, 1)) {
    for (const [description, category, base, variation, dueDay, supplier] of RECURRING_EXPENSES) {
      const dueKey = `${month.slice(0, 7)}-${String(dueDay).padStart(2, '0')}`;
      if (dueKey < startKey) continue;
      const amount = base + Math.round(int(0, variation) / 100) * 100;
      addExpense(description, category, amount, dueKey, supplier);
    }
    const prev = addMonthsKey(month, -1).slice(0, 7);
    if (receivedByMonth[prev]) {
      const dueKey = `${month.slice(0, 7)}-20`;
      if (dueKey >= startKey) addExpense(`Simples Nacional — competência ${prev.slice(5)}/${prev.slice(0, 4)}`, 'Impostos e taxas', Math.round(receivedByMonth[prev] * 0.06), dueKey, 'Receita Federal');
    }
    if (Number(month.slice(5, 7)) % 2 === 0) {
      addExpense('Revisão preventiva dos simuladores', 'Manutenção de equipamentos', int(12, 28) * 10000, `${month.slice(0, 7)}-25`, 'TecSim Manutenção (fictícia)');
    }
  }
  addExpense('Manutenção corretiva — base de movimento do Simulador Pro 04', 'Manutenção de equipamentos', 320000, addDaysKey(today, -3), 'TecSim Manutenção (fictícia)', { forcePending: true });
  expenses.sort((a, b) => a.dueDate - b.dueDate).forEach((e) => (e.code = codeFor('D', e.dueDate)));

  /* ── Gravação ──────────────────────────────────────────── */
  const strip = (list, fields) => list.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !fields.includes(k))));
  await Appointment.insertMany(strip(appointments, ['clientDoc', 'serviceKey', 'instructorKey', 'dayKey']));
  await Reservation.insertMany(reservations);
  await Sale.insertMany(strip(sales, ['saleKey']));
  await Payment.insertMany(payments);
  await Installment.insertMany(installments);
  await Expense.insertMany(expenses);
  await Counter.insertMany([
    ...Object.entries(counters).map(([_id, seq]) => ({ _id, seq })),
    { _id: 'CL', seq: clients.length },
  ]);
  await AuditLog.create({
    userName: 'Sistema',
    action: 'demo.seed',
    entity: 'System',
    summary: 'Dados de demonstração carregados',
  });

  const summary = {
    users: USERS.length,
    clients: clients.length,
    appointments: appointments.length,
    reservations: reservations.length,
    sales: sales.length,
    payments: payments.length,
    installments: installments.length,
    expenses: expenses.length,
  };
  log(
    `${summary.appointments} agendamentos, ${summary.reservations} reservas, ${summary.sales} vendas, ` +
      `${summary.payments} pagamentos, ${summary.installments} parcelas, ${summary.expenses} despesas`,
  );
  return summary;
}
