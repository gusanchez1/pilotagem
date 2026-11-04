import mongoose from 'mongoose';
import { APPOINTMENT_STATUS, LABELS } from '../../config/constants.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { Appointment, Expense, Installment, Reservation, Resource, Room, Sale } from '../../models/index.js';
import { monthsBetween, startOfDay, toDateKey } from '../../utils/dates.js';
import { env } from '../../config/env.js';
import { clientDisplayName } from '../privacy.service.js';

/**
 * Registro de relatórios. Cada relatório declara colunas, filtros aceitos, a permissão exigida
 * e uma função `run` que consulta o MongoDB. Clientes confidenciais aparecem SEMPRE pelo nome
 * de exibição (relatórios gerais não exibem informação identificável).
 *
 * Tipos de coluna: text | date | datetime | money | number | percent | hours
 */

const P = PERMISSIONS;
const TZ = env.timezone;
const oid = (v) => new mongoose.Types.ObjectId(v);
const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);
const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3_600_000;
const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);

const statusFilter = (value, allowed, fallback) => {
  if (!value || value === 'todos') return fallback;
  const list = value.split(',').filter((v) => allowed.includes(v));
  return list.length ? { $in: list } : fallback;
};

export const REPORTS = [
  /* ───────────────────────────── Financeiros ─────────────────────────────── */
  {
    key: 'vendas',
    title: 'Vendas por período',
    description: 'Vendas registradas no período, com valores contratados, recebidos e pendentes.',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'category', 'service', 'status'],
    statusOptions: [
      { value: 'ativa', label: 'Ativas' },
      { value: 'cancelada', label: 'Canceladas' },
      { value: 'todos', label: 'Todas' },
    ],
    columns: [
      { key: 'code', label: 'Venda', type: 'text', width: 1 },
      { key: 'saleDate', label: 'Data', type: 'date', width: 1 },
      { key: 'client', label: 'Cliente', type: 'text', width: 2 },
      { key: 'description', label: 'Descrição', type: 'text', width: 3 },
      { key: 'category', label: 'Categoria', type: 'text', width: 1.5 },
      { key: 'situation', label: 'Situação', type: 'text', width: 1 },
      { key: 'total', label: 'Contratado', type: 'money', width: 1.2, total: true },
      { key: 'received', label: 'Recebido', type: 'money', width: 1.2, total: true },
      { key: 'outstanding', label: 'Pendente', type: 'money', width: 1.2, total: true },
    ],
    async run(f) {
      const match = { saleDate: { $gte: f.start, $lt: f.end }, status: statusFilter(f.status, ['ativa', 'cancelada'], 'ativa') };
      if (f.category) match.category = f.category;
      if (f.service) match['items.service'] = f.service;
      const sales = await Sale.find(match).sort({ saleDate: 1 }).populate('client').populate('category', 'name').lean();
      return sales.map((s) => ({
        code: s.code,
        saleDate: s.saleDate,
        client: clientDisplayName(s.client),
        description: s.description,
        category: s.category?.name ?? '—',
        situation: s.status === 'cancelada' ? 'Cancelada' : LABELS.salePaymentStatus[s.paymentStatus],
        total: s.total,
        received: s.status === 'cancelada' ? 0 : s.amountReceived,
        outstanding: s.status === 'cancelada' ? 0 : s.amountOutstanding,
      }));
    },
  },
  {
    key: 'recebimentos',
    title: 'Receitas recebidas',
    description: 'Valores efetivamente recebidos no período (regime de caixa).',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'status'],
    statusLabel: 'Forma de pagamento',
    statusOptions: [{ value: 'todos', label: 'Todas' }, ...Object.entries(LABELS.paymentMethod).map(([value, label]) => ({ value, label }))],
    columns: [
      { key: 'receivedAt', label: 'Recebido em', type: 'date', width: 1 },
      { key: 'sale', label: 'Venda', type: 'text', width: 1 },
      { key: 'client', label: 'Cliente', type: 'text', width: 2 },
      { key: 'description', label: 'Descrição', type: 'text', width: 3 },
      { key: 'method', label: 'Forma', type: 'text', width: 1.3 },
      { key: 'installment', label: 'Parcela', type: 'text', width: 0.8 },
      { key: 'amount', label: 'Valor', type: 'money', width: 1.2, total: true },
    ],
    async run(f) {
      const match = { status: 'recebida', receivedAt: { $gte: f.start, $lt: f.end } };
      if (f.status && f.status !== 'todos') match.method = f.status;
      const rows = await Installment.find(match).sort({ receivedAt: 1 }).populate('client').populate('sale', 'code description').lean();
      return rows.map((i) => ({
        receivedAt: i.receivedAt,
        sale: i.sale?.code,
        client: clientDisplayName(i.client),
        description: i.sale?.description,
        method: LABELS.paymentMethod[i.method],
        installment: `${i.number}/${i.totalInstallments}`,
        amount: i.amount,
      }));
    },
  },
  {
    key: 'despesas',
    title: 'Despesas por período',
    description: 'Despesas com vencimento no período, por categoria e situação.',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'category', 'status'],
    statusOptions: [
      { value: 'todos', label: 'Pagas e pendentes' },
      { value: 'paga', label: 'Pagas' },
      { value: 'pendente', label: 'Pendentes' },
      { value: 'cancelada', label: 'Canceladas' },
    ],
    columns: [
      { key: 'code', label: 'Código', type: 'text', width: 1 },
      { key: 'dueDate', label: 'Vencimento', type: 'date', width: 1 },
      { key: 'description', label: 'Descrição', type: 'text', width: 3 },
      { key: 'category', label: 'Categoria', type: 'text', width: 1.6 },
      { key: 'supplier', label: 'Fornecedor', type: 'text', width: 1.6 },
      { key: 'status', label: 'Situação', type: 'text', width: 1 },
      { key: 'paidAt', label: 'Pago em', type: 'date', width: 1 },
      { key: 'amount', label: 'Valor', type: 'money', width: 1.2, total: true },
    ],
    async run(f) {
      const match = { dueDate: { $gte: f.start, $lt: f.end }, status: statusFilter(f.status, ['paga', 'pendente', 'cancelada'], { $ne: 'cancelada' }) };
      if (f.category) match.category = f.category;
      const rows = await Expense.find(match).sort({ dueDate: 1 }).populate('category', 'name').lean();
      return rows.map((e) => ({
        code: e.code,
        dueDate: e.dueDate,
        description: e.description,
        category: e.category?.name,
        supplier: e.supplier || '—',
        status: LABELS.expenseStatus[e.status],
        paidAt: e.paidAt,
        amount: e.amount,
      }));
    },
  },
  {
    key: 'resultado',
    title: 'Resultado operacional',
    description: 'Mês a mês: vendido, recebido, despesas pagas e resultado (regime de caixa).',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period'],
    columns: [
      { key: 'month', label: 'Mês', type: 'text', width: 1.4 },
      { key: 'sold', label: 'Vendido', type: 'money', width: 1.3, total: true },
      { key: 'received', label: 'Recebido', type: 'money', width: 1.3, total: true },
      { key: 'expenses', label: 'Despesas pagas', type: 'money', width: 1.3, total: true },
      { key: 'result', label: 'Resultado', type: 'money', width: 1.3, total: true },
      { key: 'margin', label: 'Margem', type: 'percent', width: 1 },
    ],
    async run(f) {
      const group = (Model, match, field, value = '$amount') =>
        Model.aggregate([
          { $match: match },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${field}`, timezone: TZ } }, total: { $sum: value } } },
        ]).then((rows) => Object.fromEntries(rows.map((r) => [r._id, r.total])));
      const [sold, received, expenses] = await Promise.all([
        group(Sale, { status: 'ativa', saleDate: { $gte: f.start, $lt: f.end } }, 'saleDate', '$total'),
        group(Installment, { status: 'recebida', receivedAt: { $gte: f.start, $lt: f.end } }, 'receivedAt'),
        group(Expense, { status: 'paga', paidAt: { $gte: f.start, $lt: f.end } }, 'paidAt'),
      ]);
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return monthsBetween(f.fromKey, f.toKey).map((m) => {
        const r = received[m] ?? 0;
        const e = expenses[m] ?? 0;
        const label = monthName.format(new Date(`${m}-15T12:00:00Z`));
        return {
          month: label.charAt(0).toUpperCase() + label.slice(1),
          sold: sold[m] ?? 0,
          received: r,
          expenses: e,
          result: r - e,
          margin: pct(r - e, r),
        };
      });
    },
    totalsExtra: (rows) => ({ margin: pct(sum(rows, 'result'), sum(rows, 'received')) }),
  },
  {
    key: 'contas-a-receber',
    title: 'Contas a receber',
    description: 'Vendas ativas com saldo pendente (vendas realizadas no período).',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'category'],
    columns: [
      { key: 'code', label: 'Venda', type: 'text', width: 1 },
      { key: 'client', label: 'Cliente', type: 'text', width: 2 },
      { key: 'saleDate', label: 'Data da venda', type: 'date', width: 1 },
      { key: 'dueDate', label: 'Vencimento', type: 'date', width: 1 },
      { key: 'situation', label: 'Situação', type: 'text', width: 1 },
      { key: 'total', label: 'Contratado', type: 'money', width: 1.2, total: true },
      { key: 'received', label: 'Recebido', type: 'money', width: 1.2, total: true },
      { key: 'scheduled', label: 'Programado', type: 'money', width: 1.2, total: true },
      { key: 'outstanding', label: 'Saldo', type: 'money', width: 1.2, total: true },
    ],
    async run(f) {
      const match = { status: 'ativa', amountOutstanding: { $gt: 0 }, saleDate: { $gte: f.start, $lt: f.end } };
      if (f.category) match.category = f.category;
      const today = startOfDay(toDateKey());
      const rows = await Sale.find(match).sort({ dueDate: 1 }).populate('client').lean();
      return rows.map((s) => ({
        code: s.code,
        client: clientDisplayName(s.client),
        saleDate: s.saleDate,
        dueDate: s.dueDate,
        situation: s.dueDate < today && s.amountUnallocated > 0 ? 'Vencida' : LABELS.salePaymentStatus[s.paymentStatus],
        total: s.total,
        received: s.amountReceived,
        scheduled: s.amountScheduled,
        outstanding: s.amountOutstanding,
      }));
    },
  },
  {
    key: 'parcelas-pendentes',
    title: 'Parcelas pendentes',
    description: 'Parcelas a receber com vencimento no período.',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'status'],
    statusLabel: 'Forma de pagamento',
    statusOptions: [{ value: 'todos', label: 'Todas' }, ...Object.entries(LABELS.paymentMethod).map(([value, label]) => ({ value, label }))],
    columns: [
      { key: 'dueDate', label: 'Vencimento', type: 'date', width: 1 },
      { key: 'sale', label: 'Venda', type: 'text', width: 1 },
      { key: 'client', label: 'Cliente', type: 'text', width: 2 },
      { key: 'method', label: 'Forma', type: 'text', width: 1.3 },
      { key: 'installment', label: 'Parcela', type: 'text', width: 0.8 },
      { key: 'situation', label: 'Situação', type: 'text', width: 1 },
      { key: 'amount', label: 'Valor', type: 'money', width: 1.2, total: true },
    ],
    async run(f) {
      const match = { status: 'pendente', dueDate: { $gte: f.start, $lt: f.end } };
      if (f.status && f.status !== 'todos') match.method = f.status;
      const today = startOfDay(toDateKey());
      const rows = await Installment.find(match).sort({ dueDate: 1 }).populate('client').populate('sale', 'code').lean();
      return rows.map((i) => ({
        dueDate: i.dueDate,
        sale: i.sale?.code,
        client: clientDisplayName(i.client),
        method: LABELS.paymentMethod[i.method],
        installment: `${i.number}/${i.totalInstallments}`,
        situation: i.dueDate < today ? 'Vencida' : 'A vencer',
        amount: i.amount,
      }));
    },
  },
  {
    key: 'pagamentos-atrasados',
    title: 'Pagamentos atrasados',
    description: 'Parcelas vencidas e vendas vencidas sem forma de pagamento definida (posição atual).',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: [],
    columns: [
      { key: 'dueDate', label: 'Vencimento', type: 'date', width: 1 },
      { key: 'days', label: 'Dias em atraso', type: 'number', width: 1 },
      { key: 'sale', label: 'Venda', type: 'text', width: 1 },
      { key: 'client', label: 'Cliente', type: 'text', width: 2 },
      { key: 'origin', label: 'Origem', type: 'text', width: 2 },
      { key: 'amount', label: 'Valor', type: 'money', width: 1.2, total: true },
    ],
    async run() {
      const today = startOfDay(toDateKey());
      const days = (d) => Math.floor((today - new Date(d)) / 86_400_000) + 1;
      const [inst, sales] = await Promise.all([
        Installment.find({ status: 'pendente', dueDate: { $lt: today } }).populate('client').populate('sale', 'code').lean(),
        Sale.find({ status: 'ativa', dueDate: { $lt: today }, amountUnallocated: { $gt: 0 } }).populate('client').lean(),
      ]);
      return [
        ...inst.map((i) => ({
          dueDate: i.dueDate,
          days: days(i.dueDate),
          sale: i.sale?.code,
          client: clientDisplayName(i.client),
          origin: `Parcela ${i.number}/${i.totalInstallments} · ${LABELS.paymentMethod[i.method]}`,
          amount: i.amount,
        })),
        ...sales.map((s) => ({
          dueDate: s.dueDate,
          days: days(s.dueDate),
          sale: s.code,
          client: clientDisplayName(s.client),
          origin: 'Saldo sem pagamento registrado',
          amount: s.amountUnallocated,
        })),
      ].sort((a, b) => b.days - a.days);
    },
  },
  {
    key: 'vendas-modalidade',
    title: 'Vendas por modalidade',
    description: 'Faturamento agrupado pela modalidade do serviço vendido.',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period', 'category'],
    columns: [
      { key: 'modality', label: 'Modalidade', type: 'text', width: 2.5 },
      { key: 'items', label: 'Itens vendidos', type: 'number', width: 1, total: true },
      { key: 'sales', label: 'Vendas', type: 'number', width: 1, total: true },
      { key: 'total', label: 'Faturamento', type: 'money', width: 1.4, total: true },
      { key: 'share', label: '% do total', type: 'percent', width: 1 },
    ],
    async run(f) {
      const match = { status: 'ativa', saleDate: { $gte: f.start, $lt: f.end } };
      if (f.category) match.category = f.category;
      const sales = await Sale.find(match).select('items subtotal total').lean();
      const map = new Map();
      for (const s of sales) {
        const factor = s.subtotal > 0 ? s.total / s.subtotal : 0;
        const seen = new Set();
        for (const it of s.items) {
          const row = map.get(it.modality) ?? { modality: it.modality, items: 0, sales: 0, total: 0 };
          row.items += it.quantity;
          row.total += Math.round(it.total * factor);
          if (!seen.has(it.modality)) row.sales += 1;
          seen.add(it.modality);
          map.set(it.modality, row);
        }
      }
      const rows = [...map.values()].sort((a, b) => b.total - a.total);
      const total = sum(rows, 'total');
      return rows.map((r) => ({ ...r, share: pct(r.total, total) }));
    },
    totalsExtra: () => ({ share: 100 }),
  },
  {
    key: 'vendas-pacote',
    title: 'Vendas por pacote',
    description: 'Quantidade e faturamento de cada pacote comercial vendido.',
    group: 'financeiro',
    permission: P.REPORTS_FINANCIAL,
    filters: ['period'],
    columns: [
      { key: 'package', label: 'Pacote', type: 'text', width: 3 },
      { key: 'quantity', label: 'Quantidade', type: 'number', width: 1, total: true },
      { key: 'total', label: 'Faturamento', type: 'money', width: 1.4, total: true },
      { key: 'average', label: 'Ticket médio', type: 'money', width: 1.4 },
    ],
    async run(f) {
      const rows = await Sale.aggregate([
        { $match: { status: 'ativa', saleDate: { $gte: f.start, $lt: f.end } } },
        { $unwind: '$items' },
        { $match: { 'items.type': 'pacote' } },
        { $group: { _id: '$items.description', quantity: { $sum: '$items.quantity' }, total: { $sum: '$items.total' } } },
        { $sort: { total: -1 } },
      ]);
      return rows.map((r) => ({ package: r._id, quantity: r.quantity, total: r.total, average: Math.round(r.total / r.quantity) }));
    },
  },

  /* ──────────────────────────── Operacionais ─────────────────────────────── */
  {
    key: 'treinamentos',
    title: 'Treinamentos realizados',
    description: 'Sessões concluídas no período por serviço, instrutor e sala.',
    group: 'operacional',
    permission: P.REPORTS_OPERATIONAL,
    filters: ['period', 'service', 'instructor'],
    columns: [
      { key: 'date', label: 'Data', type: 'date', width: 1 },
      { key: 'time', label: 'Horário', type: 'text', width: 1 },
      { key: 'code', label: 'Código', type: 'text', width: 1 },
      { key: 'service', label: 'Serviço', type: 'text', width: 2.2 },
      { key: 'instructor', label: 'Instrutor', type: 'text', width: 1.6 },
      { key: 'client', label: 'Cliente', type: 'text', width: 1.8 },
      { key: 'room', label: 'Sala', type: 'text', width: 1.6 },
      { key: 'hours', label: 'Duração', type: 'hours', width: 0.9, total: true },
    ],
    async run(f) {
      const match = { status: 'concluido', start: { $gte: f.start, $lt: f.end } };
      if (f.service) match.service = f.service;
      if (f.instructor) match.instructor = f.instructor;
      return timetable(match);
    },
  },
  {
    key: 'agendamentos',
    title: 'Histórico de agendamentos',
    description: 'Todos os agendamentos do período, com origem e status.',
    group: 'operacional',
    permission: P.REPORTS_OPERATIONAL,
    filters: ['period', 'service', 'instructor', 'status'],
    statusOptions: [{ value: 'todos', label: 'Todos' }, ...APPOINTMENT_STATUS.map((s) => ({ value: s, label: LABELS.appointmentStatus[s] }))],
    columns: [
      { key: 'date', label: 'Data', type: 'date', width: 1 },
      { key: 'time', label: 'Horário', type: 'text', width: 1 },
      { key: 'code', label: 'Código', type: 'text', width: 0.9 },
      { key: 'service', label: 'Serviço', type: 'text', width: 2 },
      { key: 'instructor', label: 'Instrutor', type: 'text', width: 1.5 },
      { key: 'client', label: 'Cliente', type: 'text', width: 1.7 },
      { key: 'origin', label: 'Origem', type: 'text', width: 1.3 },
      { key: 'status', label: 'Status', type: 'text', width: 1.2 },
    ],
    async run(f) {
      const match = { start: { $gte: f.start, $lt: f.end } };
      if (f.service) match.service = f.service;
      if (f.instructor) match.instructor = f.instructor;
      if (f.status && f.status !== 'todos') match.status = { $in: f.status.split(',') };
      return timetable(match);
    },
  },
  {
    key: 'ocupacao-salas',
    title: 'Ocupação de salas',
    description: 'Horas reservadas por sala e tipo de utilização, comparadas ao horário de funcionamento.',
    group: 'operacional',
    permission: P.REPORTS_OPERATIONAL,
    filters: ['period'],
    columns: [
      { key: 'room', label: 'Sala', type: 'text', width: 2.2 },
      { key: 'reservations', label: 'Reservas', type: 'number', width: 0.9, total: true },
      { key: 'treinamento', label: 'Treinamento', type: 'hours', width: 1, total: true },
      { key: 'locacao', label: 'Locação', type: 'hours', width: 1, total: true },
      { key: 'evento', label: 'Evento', type: 'hours', width: 1, total: true },
      { key: 'outros', label: 'Interno/manut.', type: 'hours', width: 1, total: true },
      { key: 'hours', label: 'Total', type: 'hours', width: 1, total: true },
      { key: 'occupancy', label: 'Ocupação', type: 'percent', width: 1 },
    ],
    async run(f, ctx) {
      const [rooms, reservations] = await Promise.all([
        Room.find().sort({ code: 1 }).lean(),
        Reservation.find({ status: { $ne: 'cancelada' }, start: { $lt: f.end }, end: { $gt: f.start }, rooms: { $ne: [] } }).lean(),
      ]);
      const openHours = businessHours(f, ctx.settings);
      return rooms.map((room) => {
        const row = { room: `${room.name} (${room.code})`, reservations: 0, treinamento: 0, locacao: 0, evento: 0, outros: 0, hours: 0 };
        for (const r of reservations.filter((x) => x.rooms.some((id) => String(id) === String(room._id)))) {
          const h = hoursBetween(r.start, r.end);
          row.reservations += 1;
          const bucket = ['treinamento', 'locacao', 'evento'].includes(r.usageType) ? r.usageType : 'outros';
          row[bucket] += h;
          row.hours += h;
        }
        row.occupancy = pct(row.hours, openHours);
        return row;
      });
    },
  },
  {
    key: 'locacao-equipamentos',
    title: 'Utilização e locação de equipamentos',
    description: 'Horas de uso, locação e manutenção de cada simulador/equipamento.',
    group: 'operacional',
    permission: P.REPORTS_OPERATIONAL,
    filters: ['period'],
    columns: [
      { key: 'resource', label: 'Equipamento', type: 'text', width: 2.4 },
      { key: 'category', label: 'Categoria', type: 'text', width: 1.3 },
      { key: 'status', label: 'Status atual', type: 'text', width: 1.1 },
      { key: 'reservations', label: 'Reservas', type: 'number', width: 0.9, total: true },
      { key: 'training', label: 'Treinamento', type: 'hours', width: 1, total: true },
      { key: 'rental', label: 'Locação/evento', type: 'hours', width: 1, total: true },
      { key: 'maintenance', label: 'Manutenção', type: 'hours', width: 1, total: true },
      { key: 'occupancy', label: 'Ocupação', type: 'percent', width: 1 },
    ],
    async run(f, ctx) {
      const [resources, reservations] = await Promise.all([
        Resource.find().sort({ category: 1, code: 1 }).lean(),
        Reservation.find({ status: { $ne: 'cancelada' }, start: { $lt: f.end }, end: { $gt: f.start }, resources: { $ne: [] } }).lean(),
      ]);
      const openHours = businessHours(f, ctx.settings);
      const statusLabel = { disponivel: 'Disponível', manutencao: 'Em manutenção', inativo: 'Inativo' };
      return resources.map((res) => {
        const row = {
          resource: `${res.name} (${res.code})`,
          category: LABELS.resourceCategory[res.category],
          status: statusLabel[res.status],
          reservations: 0,
          training: 0,
          rental: 0,
          maintenance: 0,
        };
        for (const r of reservations.filter((x) => x.resources.some((id) => String(id) === String(res._id)))) {
          const h = hoursBetween(r.start, r.end);
          row.reservations += 1;
          if (r.usageType === 'manutencao') row.maintenance += h;
          else if (['locacao', 'evento'].includes(r.usageType)) row.rental += h;
          else row.training += h;
        }
        row.occupancy = pct(row.training + row.rental, openHours);
        return row;
      });
    },
  },
];

async function timetable(match) {
  const rows = await Appointment.find(match)
    .sort({ start: 1 })
    .populate('client')
    .populate('service', 'name')
    .populate('instructor', 'name')
    .populate('room', 'name')
    .lean();
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return rows.map((a) => ({
    date: a.start,
    time: `${time.format(a.start)}–${time.format(a.end)}`,
    code: a.code,
    service: a.service?.name,
    instructor: a.instructor?.name ?? '—',
    client: clientDisplayName(a.client),
    room: a.room?.name ?? '—',
    origin: LABELS.origin[a.origin],
    status: LABELS.appointmentStatus[a.status],
    hours: hoursBetween(a.start, a.end),
  }));
}

function businessHours(f, settings) {
  const [sh, sm] = (settings?.businessHoursStart || '08:00').split(':').map(Number);
  const [eh, em] = (settings?.businessHoursEnd || '22:00').split(':').map(Number);
  const perDay = eh + em / 60 - (sh + sm / 60);
  const days = Math.round((f.end - f.start) / 86_400_000);
  return perDay * days;
}

export function findReport(key) {
  return REPORTS.find((r) => r.key === key);
}

export function computeTotals(report, rows) {
  const totals = {};
  for (const col of report.columns) if (col.total) totals[col.key] = sum(rows, col.key);
  return { ...totals, ...(report.totalsExtra ? report.totalsExtra(rows) : {}) };
}

export { oid };
