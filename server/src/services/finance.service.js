import { LABELS } from '../config/constants.js';
import {
  Appointment,
  Client,
  Expense,
  FinancialCategory,
  Installment,
  Package,
  Payment,
  Sale,
  Service,
  nextCode,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { startOfDay, toDateKey, zonedToUtc } from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';
import { audit } from './audit.service.js';
import {
  assertPaymentFits,
  buildInstallmentSchedule,
  computeItemTotal,
  computeSaleTotals,
  summarizeSale,
} from './finance.calc.js';
import { withLocks } from './lock.service.js';

/* ────────────────────────────────────────────────────────────────────────────
 * Recalcula os campos derivados da venda a partir das parcelas — idempotente.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function recalcSale(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) return null;
  const installments = await Installment.find({ sale: sale._id, status: { $ne: 'cancelada' } }).lean();
  Object.assign(sale, summarizeSale(sale.total, installments));
  await sale.save();
  return sale;
}

/* ──────────────────────────────── Vendas ─────────────────────────────────── */

const MODALITY_BY_TYPE = { pacote: 'Pacotes', locacao: 'Locação', personalizado: 'Outros' };

/** Monta os itens da venda com SNAPSHOT de descrição, modalidade e preço. */
export async function buildSaleItems(rawItems) {
  const items = [];
  for (const raw of rawItems) {
    const item = {
      type: raw.type,
      quantity: raw.quantity ?? 1,
      unitPrice: raw.unitPrice,
      discount: raw.discount ?? 0,
      description: raw.description?.trim() || '',
      modality: raw.modality || MODALITY_BY_TYPE[raw.type] || 'Outros',
      service: null,
      package: null,
    };
    if (raw.service) {
      const service = await Service.findById(raw.service).lean();
      if (!service) throw AppError.badRequest('Serviço informado não existe.');
      item.service = service._id;
      item.description ||= service.name;
      if (raw.type === 'servico') item.modality = service.category;
      if (raw.type === 'locacao') item.modality = 'Locação';
    }
    if (raw.package) {
      const pkg = await Package.findById(raw.package).lean();
      if (!pkg) throw AppError.badRequest('Pacote informado não existe.');
      item.package = pkg._id;
      item.description ||= pkg.name;
      item.modality = 'Pacotes';
    }
    if (!item.description) throw AppError.badRequest('Informe a descrição do item da venda.');
    item.total = computeItemTotal(item);
    items.push(item);
  }
  return items;
}

async function defaultRevenueCategory(items) {
  const typeToCategory = { pacote: 'Pacotes e programas', locacao: 'Locações', personalizado: 'Outras receitas' };
  let name = typeToCategory[items[0]?.type];
  if (!name) {
    const modality = items[0]?.modality;
    name = modality === 'Racing Room' ? 'Racing Room' : 'Treinamentos';
  }
  const cat = await FinancialCategory.findOne({ type: 'receita', name }).lean();
  return cat?._id ?? null;
}

/**
 * Cria uma venda. Pode receber pagamentos iniciais (ex.: Pix na hora).
 * @param data  { client, items[], discount, saleDate, dueDate, category, paymentTerms, notes,
 *               description, appointments[], reservation, payments[] }
 */
export async function createSale(data, req) {
  if (data.client) {
    const exists = await Client.exists({ _id: data.client });
    if (!exists) throw AppError.badRequest('Cliente não encontrado.');
  }
  const items = await buildSaleItems(data.items);
  const totals = computeSaleTotals(items, data.discount ?? 0);
  if (totals.total <= 0) throw AppError.badRequest('O valor total da venda deve ser maior que zero.');

  const todayKey = toDateKey();
  const saleDateKey = data.saleDate || todayKey;
  const sale = await Sale.create({
    code: await nextCode('V', { yearly: true }),
    client: data.client || null,
    items,
    ...totals,
    appointments: data.appointments || [],
    reservation: data.reservation || null,
    saleDate: zonedToUtc(saleDateKey, '12:00'),
    dueDate: zonedToUtc(data.dueDate || saleDateKey, '12:00'),
    description: data.description || items.map((i) => i.description).join(' + '),
    category: data.category || (await defaultRevenueCategory(items)),
    paymentTerms: data.paymentTerms || 'antecipado',
    notes: data.notes || '',
    amountOutstanding: totals.total,
    amountUnallocated: totals.total,
    createdBy: req?.user?._id,
  });

  if (data.appointments?.length) {
    await Appointment.updateMany({ _id: { $in: data.appointments } }, { $set: { sale: sale._id } });
  }

  await audit(req, {
    action: 'sale.create',
    entity: 'Sale',
    entityId: sale._id,
    entityLabel: sale.code,
    summary: `Venda ${sale.code} registrada — ${formatBRL(sale.total)}`,
    details: { total: sale.total, itens: items.map((i) => i.description) },
  });

  for (const p of data.payments || []) {
    await addPayment(sale._id, p, req);
  }

  return recalcSale(sale._id);
}

/** Edição de venda: dados descritivos sempre; valores apenas sem pagamentos ativos. */
export async function updateSale(id, patch, req) {
  const sale = await Sale.findById(id);
  if (!sale) throw AppError.notFound('Venda não encontrada.');
  if (sale.status === 'cancelada') throw AppError.badRequest('Vendas canceladas não podem ser editadas.');

  const before = sale.toObject();
  for (const f of ['description', 'notes', 'paymentTerms', 'category']) {
    if (patch[f] !== undefined) sale[f] = patch[f];
  }
  if (patch.dueDate) sale.dueDate = zonedToUtc(patch.dueDate, '12:00');
  if (patch.saleDate) sale.saleDate = zonedToUtc(patch.saleDate, '12:00');

  if (patch.items || patch.discount !== undefined) {
    const activePayments = await Payment.countDocuments({ sale: sale._id, status: 'ativo' });
    if (activePayments > 0) {
      throw AppError.badRequest('Os valores não podem ser alterados porque a venda já possui pagamentos. Estorne-os antes.');
    }
    const items = patch.items ? await buildSaleItems(patch.items) : sale.items.map((i) => i.toObject());
    Object.assign(sale, { items }, computeSaleTotals(items, patch.discount ?? sale.discount));
  }
  await sale.save();

  await audit(req, {
    action: 'sale.update',
    entity: 'Sale',
    entityId: sale._id,
    entityLabel: sale.code,
    summary: `Venda ${sale.code} alterada`,
    details: before.total !== sale.total ? { total: { de: before.total, para: sale.total } } : null,
  });
  return recalcSale(sale._id);
}

export async function cancelSale(id, reason, req) {
  return withLocks([`sale:${id}`], async () => {
    const sale = await Sale.findById(id);
    if (!sale) throw AppError.notFound('Venda não encontrada.');
    if (sale.status === 'cancelada') throw AppError.badRequest('Esta venda já está cancelada.');

    const received = await Installment.countDocuments({ sale: sale._id, status: 'recebida' });
    if (received > 0) {
      throw AppError.conflict(
        'Esta venda possui valores já recebidos. Estorne os pagamentos recebidos antes de cancelar a venda.',
      );
    }

    const payments = await Payment.find({ sale: sale._id, status: 'ativo' });
    for (const p of payments) {
      p.status = 'estornado';
      p.reversedAt = new Date();
      p.reversedBy = req?.user?._id;
      p.reverseReason = `Venda cancelada: ${reason}`;
      await p.save();
    }
    await Installment.updateMany(
      { sale: sale._id, status: 'pendente' },
      { $set: { status: 'cancelada', cancelledAt: new Date() } },
    );

    sale.status = 'cancelada';
    sale.cancelReason = reason;
    sale.cancelledAt = new Date();
    sale.cancelledBy = req?.user?._id;
    await sale.save();

    await audit(req, {
      action: 'sale.cancel',
      entity: 'Sale',
      entityId: sale._id,
      entityLabel: sale.code,
      summary: `Venda ${sale.code} cancelada — ${reason}`,
      details: { total: sale.total, pagamentosEstornados: payments.length },
    });
    return recalcSale(sale._id);
  });
}

/* ─────────────────────────────── Pagamentos ──────────────────────────────── */

/**
 * Registra um pagamento (integral, parcial ou parcelado).
 * @param p { method, amount, installmentsCount, firstDueDate, receiveNow, receivedAt, notes, receiptReference }
 *   receiveNow: marca a 1ª parcela como recebida (ex.: Pix/dinheiro na hora, entrada).
 */
export async function addPayment(saleId, p, req) {
  return withLocks([`sale:${saleId}`], async () => {
    const sale = await recalcSale(saleId);
    if (!sale) throw AppError.notFound('Venda não encontrada.');
    if (sale.status === 'cancelada') throw AppError.badRequest('Não é possível registrar pagamento em venda cancelada.');

    const amount = p.amount;
    const count = p.installmentsCount || 1;
    assertPaymentFits(amount, sale);

    const firstDueKey = p.firstDueDate || toDateKey();
    const schedule = buildInstallmentSchedule({ amount, count, firstDueKey });

    const payment = await Payment.create({
      sale: sale._id,
      client: sale.client,
      method: p.method,
      amount,
      installmentsCount: count,
      notes: p.notes || '',
      receiptReference: p.receiptReference || '',
      createdBy: req?.user?._id,
    });

    try {
      const receivedAt = p.receivedAt ? zonedToUtc(p.receivedAt, '12:00') : new Date();
      await Installment.insertMany(
        schedule.map((s) => {
          const receiveThis = Boolean(p.receiveNow) && s.number === 1;
          return {
            sale: sale._id,
            payment: payment._id,
            client: sale.client,
            number: s.number,
            totalInstallments: count,
            amount: s.amount,
            dueDate: zonedToUtc(s.dueKey, '12:00'),
            method: p.method,
            status: receiveThis ? 'recebida' : 'pendente',
            receivedAt: receiveThis ? receivedAt : null,
            receivedBy: receiveThis ? req?.user?._id : null,
          };
        }),
      );
    } catch (err) {
      // Compensação (sem transação): desfaz o pagamento se as parcelas não forem gravadas
      await Installment.deleteMany({ payment: payment._id });
      await Payment.deleteOne({ _id: payment._id });
      throw err;
    }

    const method = LABELS.paymentMethod[p.method];
    await audit(req, {
      action: 'payment.create',
      entity: 'Payment',
      entityId: payment._id,
      entityLabel: sale.code,
      summary: `Pagamento de ${formatBRL(amount)} (${method}${count > 1 ? ` em ${count}x` : ''}) registrado na venda ${sale.code}`,
      details: { venda: sale.code, valor: amount, metodo: p.method, parcelas: count, recebidoNaHora: Boolean(p.receiveNow) },
    });

    await recalcSale(sale._id);
    return payment;
  });
}

export async function reversePayment(paymentId, reason, req) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw AppError.notFound('Pagamento não encontrado.');
  return withLocks([`sale:${payment.sale}`], async () => {
    const fresh = await Payment.findById(paymentId);
    if (fresh.status === 'estornado') throw AppError.badRequest('Este pagamento já foi estornado.');
    fresh.status = 'estornado';
    fresh.reversedAt = new Date();
    fresh.reversedBy = req?.user?._id;
    fresh.reverseReason = reason;
    await fresh.save();
    await Installment.updateMany(
      { payment: fresh._id, status: { $ne: 'cancelada' } },
      { $set: { status: 'cancelada', cancelledAt: new Date() } },
    );
    const sale = await recalcSale(fresh.sale);
    await audit(req, {
      action: 'payment.reverse',
      entity: 'Payment',
      entityId: fresh._id,
      entityLabel: sale?.code,
      summary: `Pagamento de ${formatBRL(fresh.amount)} estornado na venda ${sale?.code} — ${reason}`,
      details: { valor: fresh.amount, metodo: fresh.method, motivo: reason },
    });
    return fresh;
  });
}

/* ──────────────────────────────── Parcelas ───────────────────────────────── */

export async function receiveInstallment(id, { receivedAt } = {}, req) {
  const inst = await Installment.findById(id);
  if (!inst) throw AppError.notFound('Parcela não encontrada.');
  return withLocks([`sale:${inst.sale}`], async () => {
    const fresh = await Installment.findById(id);
    if (fresh.status !== 'pendente') throw AppError.badRequest('Somente parcelas pendentes podem ser marcadas como recebidas.');
    fresh.status = 'recebida';
    fresh.receivedAt = receivedAt ? zonedToUtc(receivedAt, '12:00') : new Date();
    fresh.receivedBy = req?.user?._id;
    await fresh.save();
    const sale = await recalcSale(fresh.sale);
    await audit(req, {
      action: 'installment.receive',
      entity: 'Installment',
      entityId: fresh._id,
      entityLabel: sale?.code,
      summary: `Recebimento confirmado: parcela ${fresh.number}/${fresh.totalInstallments} de ${formatBRL(fresh.amount)} (venda ${sale?.code})`,
      details: { valor: fresh.amount, metodo: fresh.method },
    });
    return fresh;
  });
}

/** Correção de lançamento: volta uma parcela recebida para pendente (auditado). */
export async function undoReceiveInstallment(id, reason, req) {
  const inst = await Installment.findById(id);
  if (!inst) throw AppError.notFound('Parcela não encontrada.');
  return withLocks([`sale:${inst.sale}`], async () => {
    const fresh = await Installment.findById(id);
    if (fresh.status !== 'recebida') throw AppError.badRequest('Somente parcelas recebidas podem ter o recebimento desfeito.');
    const previous = fresh.receivedAt;
    fresh.status = 'pendente';
    fresh.receivedAt = null;
    fresh.receivedBy = null;
    await fresh.save();
    const sale = await recalcSale(fresh.sale);
    await audit(req, {
      action: 'installment.undo_receive',
      entity: 'Installment',
      entityId: fresh._id,
      entityLabel: sale?.code,
      summary: `Recebimento desfeito: parcela ${fresh.number}/${fresh.totalInstallments} de ${formatBRL(fresh.amount)} (venda ${sale?.code}) — ${reason}`,
      details: { recebidaEm: previous, motivo: reason },
    });
    return fresh;
  });
}

/* ───────────────────────────── Indicadores ───────────────────────────────── */

async function sumField(model, match, field = '$amount') {
  const [row] = await model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: field }, count: { $sum: 1 } } }]);
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

/**
 * Indicadores financeiros do período (regime de caixa para recebido/pago) + posição atual
 * de contas a receber/pagar.
 */
export async function financialSummary({ start, end }) {
  const todayStart = startOfDay(toDateKey());

  const [sold, received, expensesPaid, expensesPending, expensesOverdue, receivable, scheduled, overdueInst, overdueUnalloc] =
    await Promise.all([
      sumField(Sale, { status: 'ativa', saleDate: { $gte: start, $lt: end } }, '$total'),
      sumField(Installment, { status: 'recebida', receivedAt: { $gte: start, $lt: end } }),
      sumField(Expense, { status: 'paga', paidAt: { $gte: start, $lt: end } }),
      sumField(Expense, { status: 'pendente' }),
      sumField(Expense, { status: 'pendente', dueDate: { $lt: todayStart } }),
      sumField(Sale, { status: 'ativa', amountOutstanding: { $gt: 0 } }, '$amountOutstanding'),
      sumField(Installment, { status: 'pendente' }),
      sumField(Installment, { status: 'pendente', dueDate: { $lt: todayStart } }),
      sumField(Sale, { status: 'ativa', dueDate: { $lt: todayStart }, amountUnallocated: { $gt: 0 } }, '$amountUnallocated'),
    ]);

  return {
    sold: sold.total,
    salesCount: sold.count,
    received: received.total,
    expensesPaid: expensesPaid.total,
    operatingResult: received.total - expensesPaid.total,
    receivable: receivable.total,
    receivableCount: receivable.count,
    scheduled: scheduled.total,
    overdue: overdueInst.total + overdueUnalloc.total,
    overdueCount: overdueInst.count + overdueUnalloc.count,
    expensesPending: expensesPending.total,
    expensesPendingCount: expensesPending.count,
    expensesOverdue: expensesOverdue.total,
    expensesOverdueCount: expensesOverdue.count,
  };
}
