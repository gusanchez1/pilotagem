import { APPOINTMENT_NON_BLOCKING, LABELS, RESERVATION_NON_BLOCKING } from '../config/constants.js';
import { PERMISSIONS, hasPermission } from '../config/permissions.js';
import { Appointment, Client, Expense, Installment, Reservation, Resource, Room, Sale } from '../models/index.js';
import {
  addDaysKey,
  addMonthsKey,
  endOfDayExclusive,
  firstDayOfMonthKey,
  monthsBetween,
  resolvePeriod,
  startOfDay,
  toDateKey,
} from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';
import { env } from '../config/env.js';
import { financialSummary } from './finance.service.js';
import { APPOINTMENT_POPULATE, presentAppointment } from './presenters.js';
import { clientDisplayName } from './privacy.service.js';

const TZ = env.timezone;

/** Série mensal (AAAA-MM → soma) via $dateToString no fuso do negócio. */
async function monthlySum(Model, match, dateField, valueField = '$amount') {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${dateField}`, timezone: TZ } }, total: { $sum: valueField } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.total]));
}

/** Agrupa por dia (ou semana, se o período for longo). */
async function bucketSum(Model, match, dateField, valueField, longPeriod) {
  const format = longPeriod ? '%G-W%V' : '%Y-%m-%d';
  const rows = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format, date: `$${dateField}`, timezone: TZ } },
        total: { $sum: valueField },
        first: { $min: `$${dateField}` },
      },
    },
    { $sort: { first: 1 } },
  ]);
  return rows;
}

function chartMonths(fromKey, toKey) {
  const months = monthsBetween(fromKey, toKey);
  if (months.length >= 3) return months.slice(-12);
  return monthsBetween(addMonthsKey(firstDayOfMonthKey(toKey), -5), toKey);
}

/* ───────────────────────────── Operacional ───────────────────────────────── */

async function operationalBlock(user, period) {
  const today = toDateKey();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDayExclusive(today);
  const weekEnd = endOfDayExclusive(addDaysKey(today, 7));
  const now = new Date();
  const blocking = { $nin: APPOINTMENT_NON_BLOCKING };

  const [todayCount, completed, upcomingCount, clients, rooms, occupiedNow, upcoming, todayList, requested, maintenance] =
    await Promise.all([
      Appointment.countDocuments({ start: { $gte: dayStart, $lt: dayEnd }, status: blocking }),
      Appointment.countDocuments({ start: { $gte: period.start, $lt: period.end }, status: 'concluido' }),
      Appointment.countDocuments({ start: { $gte: now, $lt: weekEnd }, status: blocking }),
      Client.countDocuments({ active: true }),
      Room.find().lean(),
      Reservation.find({ start: { $lte: now }, end: { $gt: now }, status: { $nin: RESERVATION_NON_BLOCKING } }).select('rooms').lean(),
      Appointment.find({ start: { $gte: now }, status: blocking }).sort({ start: 1 }).limit(8).populate(APPOINTMENT_POPULATE).lean(),
      Appointment.find({ start: { $gte: dayStart, $lt: dayEnd } }).sort({ start: 1 }).populate(APPOINTMENT_POPULATE).lean(),
      Appointment.countDocuments({ status: 'solicitado', start: { $gte: dayStart } }),
      Resource.find({ status: 'manutencao' }).select('name code').lean(),
    ]);

  const activeRooms = rooms.filter((r) => r.status === 'ativa');
  const occupiedIds = new Set(occupiedNow.flatMap((r) => r.rooms.map(String)));
  const roomsOccupied = activeRooms.filter((r) => occupiedIds.has(String(r._id))).length;

  // Treinamentos concluídos por período (dia ou semana)
  const long = (period.end - period.start) / 86_400_000 > 45;
  const trainingRows = await bucketSum(
    Appointment,
    { start: { $gte: period.start, $lt: period.end }, status: 'concluido' },
    'start',
    1,
    long,
  );

  const opts = { context: 'report' }; // dashboards gerais: confidenciais sempre por nome de exibição
  return {
    kpis: {
      appointmentsToday: todayCount,
      completedInPeriod: completed,
      upcomingWeek: upcomingCount,
      roomsOccupied,
      roomsAvailable: activeRooms.length - roomsOccupied,
      roomsUnavailable: rooms.length - activeRooms.length,
      clients,
    },
    upcoming: upcoming.map((a) => presentAppointment(a, user, opts)),
    today: todayList.map((a) => presentAppointment(a, user, opts)),
    trainingsSeries: trainingRows.map((r) => ({ bucket: r._id, start: r.first, count: r.total })),
    trainingsBucket: long ? 'semana' : 'dia',
    rooms: rooms.map((r) => ({ _id: r._id, name: r.name, code: r.code, status: r.status, occupied: occupiedIds.has(String(r._id)) })),
    requestedPending: requested,
    maintenance,
  };
}

/* ────────────────────────────── Financeiro ───────────────────────────────── */

async function financialBlock(period) {
  const summary = await financialSummary(period);
  const months = chartMonths(period.fromKey, period.toKey);
  const chartStart = startOfDay(`${months[0]}-01`);
  const chartEnd = endOfDayExclusive(period.toKey);

  const [receivedByMonth, expensesByMonth, soldByMonth] = await Promise.all([
    monthlySum(Installment, { status: 'recebida', receivedAt: { $gte: chartStart, $lt: chartEnd } }, 'receivedAt'),
    monthlySum(Expense, { status: 'paga', paidAt: { $gte: chartStart, $lt: chartEnd } }, 'paidAt'),
    monthlySum(Sale, { status: 'ativa', saleDate: { $gte: chartStart, $lt: chartEnd } }, 'saleDate', '$total'),
  ]);
  const monthly = months.map((m) => ({
    month: m,
    received: receivedByMonth[m] ?? 0,
    expenses: expensesByMonth[m] ?? 0,
    sold: soldByMonth[m] ?? 0,
    result: (receivedByMonth[m] ?? 0) - (expensesByMonth[m] ?? 0),
  }));

  // Faturamento por modalidade (desconto geral rateado proporcionalmente entre os itens)
  const sales = await Sale.find({ status: 'ativa', saleDate: { $gte: period.start, $lt: period.end } })
    .select('items subtotal total')
    .lean();
  const byModality = {};
  for (const s of sales) {
    const factor = s.subtotal > 0 ? s.total / s.subtotal : 0;
    for (const it of s.items) byModality[it.modality] = (byModality[it.modality] ?? 0) + Math.round(it.total * factor);
  }
  const revenueByModality = Object.entries(byModality)
    .map(([modality, total]) => ({ modality, total }))
    .sort((a, b) => b.total - a.total);

  const expenseCats = await Expense.aggregate([
    { $match: { status: 'paga', paidAt: { $gte: period.start, $lt: period.end } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $lookup: { from: 'financialcategories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $project: { _id: 0, category: '$cat.name', color: '$cat.color', total: 1 } },
    { $sort: { total: -1 } },
  ]);

  // Evolução dos recebimentos no período (acumulado)
  const long = (period.end - period.start) / 86_400_000 > 45;
  const receiptRows = await bucketSum(
    Installment,
    { status: 'recebida', receivedAt: { $gte: period.start, $lt: period.end } },
    'receivedAt',
    '$amount',
    long,
  );
  let acc = 0;
  const receiptsEvolution = receiptRows.map((r) => {
    acc += r.total;
    return { bucket: r._id, start: r.first, amount: r.total, cumulative: acc };
  });

  // Últimas movimentações (entradas recebidas + despesas pagas)
  const [lastIn, lastOut] = await Promise.all([
    Installment.find({ status: 'recebida' }).sort({ receivedAt: -1 }).limit(8).populate('client').populate('sale', 'code description').lean(),
    Expense.find({ status: 'paga' }).sort({ paidAt: -1 }).limit(8).populate('category', 'name').lean(),
  ]);
  const recentTransactions = [
    ...lastIn.map((i) => ({
      _id: i._id,
      type: 'entrada',
      date: i.receivedAt,
      description: `${i.sale?.description || 'Venda'}${i.totalInstallments > 1 ? ` (${i.number}/${i.totalInstallments})` : ''}`,
      reference: i.sale?.code,
      saleId: i.sale?._id,
      counterpart: clientDisplayName(i.client),
      method: i.method,
      amount: i.amount,
    })),
    ...lastOut.map((e) => ({
      _id: e._id,
      type: 'saida',
      date: e.paidAt,
      description: e.description,
      reference: e.code,
      counterpart: e.category?.name,
      method: e.method,
      amount: e.amount,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  // Pagamentos pendentes (próximos vencimentos e vencidos)
  const pendingInst = await Installment.find({ status: 'pendente' })
    .sort({ dueDate: 1 })
    .limit(8)
    .populate('client')
    .populate('sale', 'code description')
    .lean();
  const todayStart = startOfDay(toDateKey());
  const pendingPayments = pendingInst.map((i) => ({
    _id: i._id,
    dueDate: i.dueDate,
    overdue: i.dueDate < todayStart,
    amount: i.amount,
    method: i.method,
    number: i.number,
    totalInstallments: i.totalInstallments,
    saleId: i.sale?._id,
    saleCode: i.sale?.code,
    description: i.sale?.description,
    client: clientDisplayName(i.client),
  }));

  return { summary, monthly, revenueByModality, expensesByCategory: expenseCats, receiptsEvolution, recentTransactions, pendingPayments };
}

/* ──────────────────────────────── Alertas ────────────────────────────────── */

async function buildAlerts(user, ops, fin) {
  const alerts = [];
  if (fin) {
    const s = fin.summary;
    if (s.overdueCount > 0) {
      alerts.push({
        level: 'danger',
        title: `${s.overdueCount} recebimento${s.overdueCount > 1 ? 's' : ''} em atraso`,
        description: `${formatBRL(s.overdue)} vencidos e não recebidos.`,
        link: '/financeiro/contas-a-receber?filtro=vencidas',
      });
    }
    if (s.expensesOverdueCount > 0) {
      alerts.push({
        level: 'danger',
        title: `${s.expensesOverdueCount} despesa${s.expensesOverdueCount > 1 ? 's' : ''} vencida${s.expensesOverdueCount > 1 ? 's' : ''}`,
        description: `${formatBRL(s.expensesOverdue)} em contas a pagar vencidas.`,
        link: '/financeiro/despesas?filtro=vencidas',
      });
    }
    const today = toDateKey();
    const soon = await Expense.find({
      status: 'pendente',
      dueDate: { $gte: startOfDay(today), $lt: endOfDayExclusive(addDaysKey(today, 3)) },
    }).lean();
    if (soon.length) {
      alerts.push({
        level: 'warning',
        title: `${soon.length} despesa${soon.length > 1 ? 's vencem' : ' vence'} nos próximos 3 dias`,
        description: soon.map((e) => e.description).slice(0, 3).join(', '),
        link: '/financeiro/despesas',
      });
    }
  }
  if (ops) {
    if (ops.requestedPending > 0) {
      alerts.push({
        level: 'warning',
        title: `${ops.requestedPending} agendamento${ops.requestedPending > 1 ? 's' : ''} aguardando confirmação`,
        description: 'Solicitações recebidas pelos sites, telefone ou WhatsApp.',
        link: '/agenda?status=solicitado&view=lista',
      });
    }
    if (hasPermission(user, PERMISSIONS.SALES_VIEW)) {
      const withoutSale = ops.today.filter((a) => !a.sale && !a.package && !APPOINTMENT_NON_BLOCKING.includes(a.status)).length;
      if (withoutSale > 0) {
        alerts.push({
          level: 'info',
          title: `${withoutSale} treinamento${withoutSale > 1 ? 's' : ''} de hoje sem venda vinculada`,
          description: 'Verifique se o pagamento foi combinado com o cliente.',
          link: '/agenda?view=dia',
        });
      }
    }
    if (ops.maintenance.length) {
      alerts.push({
        level: 'info',
        title: `${ops.maintenance.length} equipamento${ops.maintenance.length > 1 ? 's' : ''} em manutenção`,
        description: ops.maintenance.map((m) => m.name).join(', '),
        link: '/salas?aba=equipamentos',
      });
    }
  }
  return alerts;
}

export async function buildDashboard(user, { from, to }) {
  const period = resolvePeriod(from, to);
  const canOps = hasPermission(user, PERMISSIONS.APPOINTMENTS_VIEW);
  const canFin = hasPermission(user, PERMISSIONS.FINANCE_VIEW);
  const [ops, fin] = await Promise.all([canOps ? operationalBlock(user, period) : null, canFin ? financialBlock(period) : null]);
  return {
    period: { from: period.fromKey, to: period.toKey },
    operational: ops,
    financial: fin,
    alerts: await buildAlerts(user, ops, fin),
    labels: { origin: LABELS.origin },
  };
}
