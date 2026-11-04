import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { LABELS } from '../config/constants.js';
import { receiptsDir } from '../middlewares/upload.js';
import { Expense, FinancialCategory, Installment, Payment, Sale, nextCode } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import {
  addPayment,
  cancelSale,
  createSale,
  financialSummary,
  receiveInstallment,
  reversePayment,
  undoReceiveInstallment,
  updateSale,
} from '../services/finance.service.js';
import { SALE_POPULATE, presentSale } from '../services/presenters.js';
import { presentClient } from '../services/privacy.service.js';
import { AppError } from '../utils/AppError.js';
import { resolvePeriod, startOfDay, toDateKey, zonedToUtc } from '../utils/dates.js';
import { formatBRL } from '../utils/money.js';
import { pageResult, paginate } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';

/* ──────────────────────────────── Vendas ─────────────────────────────────── */

export async function listSales(req, res) {
  const q = req.validQuery;
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.saleDate = { $gte: start, $lt: end };
  }
  if (q.status) filter.status = q.status;
  if (q.paymentStatus?.length) filter.paymentStatus = { $in: q.paymentStatus };
  if (q.client) filter.client = q.client;
  if (q.category) filter.category = q.category;
  if (q.overdue) {
    filter.status = 'ativa';
    filter.dueDate = { $lt: startOfDay(toDateKey()) };
    filter.amountOutstanding = { $gt: 0 };
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ code: rx }, { description: rx }];
  }
  const page = paginate(q);
  const [items, total, totals] = await Promise.all([
    Sale.find(filter).sort({ saleDate: -1, createdAt: -1 }).skip(page.skip).limit(page.limit).populate(SALE_POPULATE).lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: { ...filter, status: filter.status ?? 'ativa' } },
      { $group: { _id: null, total: { $sum: '$total' }, received: { $sum: '$amountReceived' }, outstanding: { $sum: '$amountOutstanding' } } },
    ]),
  ]);
  res.json({
    ...pageResult(items.map((s) => presentSale(s, req.user)), total, page),
    totals: totals[0] ?? { total: 0, received: 0, outstanding: 0 },
  });
}

async function loadSale(id, user) {
  const sale = await Sale.findById(id)
    .populate(SALE_POPULATE)
    .populate({ path: 'reservation', select: 'code title start end' })
    .populate({ path: 'createdBy', select: 'name' })
    .populate({ path: 'cancelledBy', select: 'name' })
    .lean();
  if (!sale) throw AppError.notFound('Venda não encontrada.');
  const [payments, installments] = await Promise.all([
    Payment.find({ sale: id }).sort({ createdAt: 1 }).populate('createdBy', 'name').populate('reversedBy', 'name').lean(),
    Installment.find({ sale: id }).sort({ dueDate: 1, number: 1 }).populate('receivedBy', 'name').lean(),
  ]);
  return {
    ...presentSale(sale, user),
    payments: payments.map((p) => ({
      ...p,
      receipts: p.receipts.map(({ storedName: _s, ...r }) => r), // nome físico do arquivo não é exposto
      installments: installments.filter((i) => String(i.payment) === String(p._id)),
    })),
  };
}

export async function getSale(req, res) {
  res.json(await loadSale(req.validParams.id, req.user));
}

export async function postSale(req, res) {
  const sale = await createSale(req.body, req);
  res.status(201).json(await loadSale(sale._id, req.user));
}

export async function patchSale(req, res) {
  const sale = await updateSale(req.validParams.id, req.body, req);
  res.json(await loadSale(sale._id, req.user));
}

export async function postSaleCancel(req, res) {
  const sale = await cancelSale(req.validParams.id, req.body.reason, req);
  res.json(await loadSale(sale._id, req.user));
}

export async function postSalePayment(req, res) {
  await addPayment(req.validParams.id, req.body, req);
  res.status(201).json(await loadSale(req.validParams.id, req.user));
}

/* ─────────────────────────────── Pagamentos ──────────────────────────────── */

export async function postPaymentReverse(req, res) {
  const payment = await reversePayment(req.validParams.id, req.body.reason, req);
  res.json(await loadSale(payment.sale, req.user));
}

export async function patchPayment(req, res) {
  const payment = await Payment.findById(req.validParams.id);
  if (!payment) throw AppError.notFound('Pagamento não encontrado.');
  Object.assign(payment, req.body);
  await payment.save();
  res.json(await loadSale(payment.sale, req.user));
}

export async function uploadReceipt(req, res) {
  if (!req.file) throw AppError.badRequest('Selecione um arquivo de comprovante.');
  const payment = await Payment.findById(req.validParams.id);
  if (!payment) {
    unlinkSync(req.file.path);
    throw AppError.notFound('Pagamento não encontrado.');
  }
  payment.receipts.push({
    originalName: req.file.originalname.slice(0, 200),
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id,
  });
  await payment.save();
  const sale = await Sale.findById(payment.sale).select('code').lean();
  await audit(req, {
    action: 'payment.receipt',
    entity: 'Payment',
    entityId: payment._id,
    entityLabel: sale?.code,
    summary: `Comprovante anexado ao pagamento de ${formatBRL(payment.amount)} (venda ${sale?.code})`,
  });
  res.status(201).json(await loadSale(payment.sale, req.user));
}

/** Download autenticado de comprovante — os arquivos nunca ficam em pasta pública. */
export async function downloadReceipt(req, res) {
  const payment = await Payment.findById(req.validParams.id).lean();
  const receipt = payment?.receipts.find((r) => String(r._id) === req.params.receiptId);
  if (!receipt) throw AppError.notFound('Comprovante não encontrado.');
  const filePath = join(receiptsDir, receipt.storedName);
  if (!existsSync(filePath)) throw AppError.notFound('Arquivo do comprovante não está mais disponível.');
  res.setHeader('Content-Type', receipt.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(receipt.originalName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  createReadStream(filePath).pipe(res);
}

/* ─────────────────────────── Contas a receber ────────────────────────────── */

export async function listInstallments(req, res) {
  const q = req.validQuery;
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.dueDate = { $gte: start, $lt: end };
  }
  filter.status = q.status?.length ? { $in: q.status } : { $ne: 'cancelada' };
  if (q.method) filter.method = q.method;
  if (q.client) filter.client = q.client;
  if (q.overdue) {
    filter.status = 'pendente';
    filter.dueDate = { ...(filter.dueDate || {}), $lt: startOfDay(toDateKey()) };
  }
  const page = paginate(q, { defaultLimit: 50 });
  const [items, total, sums] = await Promise.all([
    Installment.find(filter)
      .sort({ dueDate: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('client')
      .populate('sale', 'code description total')
      .lean(),
    Installment.countDocuments(filter),
    Installment.aggregate([{ $match: filter }, { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  res.json({
    ...pageResult(items.map((i) => ({ ...i, client: presentClient(i.client, req.user) })), total, page),
    totals: Object.fromEntries(sums.map((s) => [s._id, { total: s.total, count: s.count }])),
  });
}

export async function postInstallmentReceive(req, res) {
  const inst = await receiveInstallment(req.validParams.id, req.body, req);
  res.json(inst);
}

export async function postInstallmentUndo(req, res) {
  const inst = await undoReceiveInstallment(req.validParams.id, req.body.reason, req);
  res.json(inst);
}

/* ──────────────────────────────── Despesas ───────────────────────────────── */

export async function listExpenses(req, res) {
  const q = req.validQuery;
  const filter = {};
  if (q.from || q.to) {
    const { start, end } = resolvePeriod(q.from, q.to);
    filter.dueDate = { $gte: start, $lt: end };
  }
  if (q.status?.length) filter.status = { $in: q.status };
  if (q.category) filter.category = q.category;
  if (q.overdue) {
    filter.status = 'pendente';
    filter.dueDate = { ...(filter.dueDate || {}), $lt: startOfDay(toDateKey()) };
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ description: rx }, { supplier: rx }, { code: rx }];
  }
  const page = paginate(q, { defaultLimit: 50 });
  const [items, total, sums] = await Promise.all([
    Expense.find(filter).sort({ dueDate: -1 }).skip(page.skip).limit(page.limit).populate('category', 'name color').lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  res.json({
    ...pageResult(items, total, page),
    totals: Object.fromEntries(sums.map((s) => [s._id, { total: s.total, count: s.count }])),
  });
}

function expenseDates(data) {
  const out = { ...data };
  if (data.dueDate) out.dueDate = zonedToUtc(data.dueDate, '12:00');
  if (data.paidAt !== undefined) out.paidAt = data.paidAt ? zonedToUtc(data.paidAt, '12:00') : null;
  return out;
}

export async function postExpense(req, res) {
  const data = expenseDates(req.body);
  if (!(await FinancialCategory.exists({ _id: data.category, type: 'despesa' }))) {
    throw AppError.badRequest('Categoria de despesa inválida.');
  }
  if (data.paidAt && !data.method) throw AppError.badRequest('Informe a forma de pagamento da despesa paga.');
  const expense = await Expense.create({
    ...data,
    code: await nextCode('D', { yearly: true }),
    status: data.paidAt ? 'paga' : 'pendente',
    createdBy: req.user._id,
  });
  await audit(req, {
    action: 'expense.create',
    entity: 'Expense',
    entityId: expense._id,
    entityLabel: expense.code,
    summary: `Despesa ${expense.code} "${expense.description}" de ${formatBRL(expense.amount)} registrada${expense.status === 'paga' ? ' como paga' : ''}`,
  });
  res.status(201).json(await Expense.findById(expense._id).populate('category', 'name color').lean());
}

export async function patchExpense(req, res) {
  const expense = await Expense.findById(req.validParams.id);
  if (!expense) throw AppError.notFound('Despesa não encontrada.');
  if (expense.status === 'cancelada') throw AppError.badRequest('Despesas canceladas não podem ser alteradas.');
  const before = { amount: expense.amount, status: expense.status };
  const data = expenseDates(req.body);
  Object.assign(expense, data);
  if (data.paidAt !== undefined) expense.status = data.paidAt ? 'paga' : 'pendente';
  if (expense.status === 'paga' && !expense.method) throw AppError.badRequest('Informe a forma de pagamento.');
  await expense.save();
  await audit(req, {
    action: 'expense.update',
    entity: 'Expense',
    entityId: expense._id,
    entityLabel: expense.code,
    summary: `Despesa ${expense.code} alterada`,
    details: before.amount !== expense.amount ? { valor: { de: before.amount, para: expense.amount } } : null,
  });
  res.json(await Expense.findById(expense._id).populate('category', 'name color').lean());
}

export async function postExpensePay(req, res) {
  const expense = await Expense.findById(req.validParams.id);
  if (!expense) throw AppError.notFound('Despesa não encontrada.');
  if (expense.status !== 'pendente') throw AppError.badRequest('Somente despesas pendentes podem ser pagas.');
  expense.status = 'paga';
  expense.paidAt = req.body.paidAt ? zonedToUtc(req.body.paidAt, '12:00') : new Date();
  expense.method = req.body.method;
  await expense.save();
  await audit(req, {
    action: 'expense.pay',
    entity: 'Expense',
    entityId: expense._id,
    entityLabel: expense.code,
    summary: `Despesa ${expense.code} paga — ${formatBRL(expense.amount)} (${LABELS.paymentMethod[expense.method]})`,
  });
  res.json(await Expense.findById(expense._id).populate('category', 'name color').lean());
}

export async function postExpenseCancel(req, res) {
  const expense = await Expense.findById(req.validParams.id);
  if (!expense) throw AppError.notFound('Despesa não encontrada.');
  if (expense.status === 'cancelada') throw AppError.badRequest('Esta despesa já está cancelada.');
  const wasPaid = expense.status === 'paga';
  expense.status = 'cancelada';
  expense.cancelReason = req.body.reason;
  expense.cancelledAt = new Date();
  await expense.save();
  await audit(req, {
    action: 'expense.cancel',
    entity: 'Expense',
    entityId: expense._id,
    entityLabel: expense.code,
    summary: `Despesa ${expense.code} ${wasPaid ? 'estornada' : 'cancelada'} — ${req.body.reason}`,
  });
  res.json(await Expense.findById(expense._id).populate('category', 'name color').lean());
}

/* ─────────────────────────────── Categorias ──────────────────────────────── */

export async function listCategories(req, res) {
  const filter = {};
  if (req.query.type === 'receita' || req.query.type === 'despesa') filter.type = req.query.type;
  res.json(await FinancialCategory.find(filter).sort({ type: 1, name: 1 }).lean());
}

export async function postCategory(req, res) {
  const cat = await FinancialCategory.create(req.body);
  await audit(req, { action: 'category.create', entity: 'FinancialCategory', entityId: cat._id, entityLabel: cat.name, summary: `Categoria de ${cat.type} "${cat.name}" criada` });
  res.status(201).json(cat);
}

export async function patchCategory(req, res) {
  const cat = await FinancialCategory.findById(req.validParams.id);
  if (!cat) throw AppError.notFound('Categoria não encontrada.');
  Object.assign(cat, req.body);
  await cat.save();
  await audit(req, { action: 'category.update', entity: 'FinancialCategory', entityId: cat._id, entityLabel: cat.name, summary: `Categoria "${cat.name}" alterada` });
  res.json(cat);
}

/* ─────────────────────────────── Indicadores ─────────────────────────────── */

export async function getFinanceSummary(req, res) {
  const period = resolvePeriod(req.validQuery.from, req.validQuery.to);
  res.json({ period: { from: period.fromKey, to: period.toKey }, ...(await financialSummary(period)) });
}

