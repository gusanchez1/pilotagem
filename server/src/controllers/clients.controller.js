import { PERMISSIONS, hasPermission } from '../config/permissions.js';
import { Appointment, Client, Installment, Payment, Sale, nextCode } from '../models/index.js';
import { audit, diffFields } from '../services/audit.service.js';
import { APPOINTMENT_POPULATE, SALE_POPULATE, presentAppointment, presentSale } from '../services/presenters.js';
import { canSeeConfidential, clientDisplayName, clientSearchFilter, presentClient } from '../services/privacy.service.js';
import { AppError } from '../utils/AppError.js';
import { pageResult, paginate } from '../utils/pagination.js';

const PERSONAL_FIELDS = ['firstName', 'lastName', 'phone', 'notes', 'alias'];

export async function listClients(req, res) {
  const q = req.validQuery;
  const filter = { ...clientSearchFilter(q.q, req.user) };
  if (q.confidential !== undefined) filter.confidential = q.confidential;
  filter.active = q.active ?? true;

  const page = paginate(q);
  const [items, total] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(),
    Client.countDocuments(filter),
  ]);
  res.json(pageResult(items.map((c) => presentClient(c, req.user)), total, page));
}

export async function getClient(req, res) {
  const client = await Client.findById(req.validParams.id).lean();
  if (!client) throw AppError.notFound('Cliente não encontrado.');
  if (client.confidential) {
    await audit(req, {
      action: 'client.view_confidential',
      entity: 'Client',
      entityId: client._id,
      entityLabel: client.code,
      summary: `Ficha do cliente confidencial ${client.code} consultada (dados protegidos)`,
    });
  }
  res.json(presentClient(client, req.user));
}

/** Revela os dados reais de um cliente confidencial — sempre auditado. */
export async function revealClient(req, res) {
  const client = await Client.findById(req.validParams.id).lean();
  if (!client) throw AppError.notFound('Cliente não encontrado.');
  if (!canSeeConfidential(req.user)) throw AppError.forbidden('Você não tem permissão para ver dados de clientes confidenciais.');
  if (client.confidential) {
    await audit(req, {
      action: 'client.reveal',
      entity: 'Client',
      entityId: client._id,
      entityLabel: client.code,
      summary: `Dados pessoais do cliente confidencial ${client.code} (${clientDisplayName(client)}) revelados`,
    });
  }
  res.json(presentClient(client, req.user, { reveal: true }));
}

export async function createClient(req, res) {
  const data = req.body;
  if (data.confidential && !canSeeConfidential(req.user)) {
    throw AppError.forbidden('Você não tem permissão para cadastrar clientes confidenciais.');
  }
  const code = await nextCode('CL');
  const client = await Client.create({
    ...data,
    code,
    alias: data.confidential ? data.alias || `Cliente reservado ${code}` : data.alias || '',
    createdBy: req.user._id,
  });
  await audit(req, {
    action: 'client.create',
    entity: 'Client',
    entityId: client._id,
    entityLabel: client.code,
    summary: `Cliente ${client.code} cadastrado${client.confidential ? ' como confidencial' : `: ${clientDisplayName(client)}`}`,
  });
  res.status(201).json(presentClient(client, req.user, { reveal: true }));
}

export async function updateClient(req, res) {
  const client = await Client.findById(req.validParams.id);
  if (!client) throw AppError.notFound('Cliente não encontrado.');
  const data = req.body;

  const touchesConfidential = client.confidential || data.confidential !== undefined;
  if (touchesConfidential && !canSeeConfidential(req.user)) {
    throw AppError.forbidden('Você não tem permissão para alterar clientes confidenciais.');
  }

  const before = client.toObject();
  Object.assign(client, data);
  if (client.confidential && !client.alias) client.alias = `Cliente reservado ${client.code}`;
  await client.save();

  const changes = diffFields(before, client.toObject(), [...PERSONAL_FIELDS, 'confidential', 'active'], {
    redact: before.confidential || client.confidential ? PERSONAL_FIELDS : [],
  });
  const confidentialityChanged = before.confidential !== client.confidential;
  await audit(req, {
    action: confidentialityChanged ? 'client.confidentiality' : 'client.update',
    entity: 'Client',
    entityId: client._id,
    entityLabel: client.code,
    summary: confidentialityChanged
      ? `Cliente ${client.code} ${client.confidential ? 'marcado como confidencial' : 'deixou de ser confidencial'}`
      : `Cadastro do cliente ${client.code} alterado`,
    details: changes,
  });
  res.json(presentClient(client, req.user, { reveal: true }));
}

export async function clientAppointments(req, res) {
  const items = await Appointment.find({ client: req.validParams.id })
    .sort({ start: -1 })
    .limit(200)
    .populate(APPOINTMENT_POPULATE)
    .lean();
  res.json(items.map((a) => presentAppointment(a, req.user)));
}

export async function clientFinance(req, res) {
  if (!hasPermission(req.user, PERMISSIONS.SALES_VIEW)) throw AppError.forbidden();
  const clientId = req.validParams.id;
  const [sales, payments, installments] = await Promise.all([
    Sale.find({ client: clientId }).sort({ saleDate: -1 }).populate(SALE_POPULATE).lean(),
    Payment.find({ client: clientId }).sort({ createdAt: -1 }).lean(),
    Installment.find({ client: clientId, status: { $ne: 'cancelada' } }).sort({ dueDate: 1 }).lean(),
  ]);
  const active = sales.filter((s) => s.status === 'ativa');
  res.json({
    summary: {
      contracted: active.reduce((a, s) => a + s.total, 0),
      received: active.reduce((a, s) => a + s.amountReceived, 0),
      outstanding: active.reduce((a, s) => a + s.amountOutstanding, 0),
      salesCount: active.length,
    },
    sales: sales.map((s) => presentSale(s, req.user)),
    payments,
    installments,
  });
}
