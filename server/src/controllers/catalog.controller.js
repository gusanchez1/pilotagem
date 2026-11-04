import { Appointment, Instructor, Package, Resource, Room, Service } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { computePackagePricing } from '../services/finance.calc.js';
import { APPOINTMENT_POPULATE, presentAppointment } from '../services/presenters.js';
import { AppError } from '../utils/AppError.js';
import { formatBRL } from '../utils/money.js';
import { resolvePeriod } from '../utils/dates.js';

/**
 * Cadastros administrativos: instrutores, serviços, pacotes, salas e equipamentos.
 * Um fábrica genérica evita repetir o mesmo CRUD cinco vezes.
 */
function crud(Model, { entity, label, populate = [], sort = { name: 1 }, prepare = async (d) => d, describe }) {
  return {
    async list(req, res) {
      const filter = {};
      if (req.query.active === 'true') filter.active = true;
      if (req.query.status) filter.status = req.query.status;
      const items = await Model.find(filter).populate(populate).sort(sort).lean();
      res.json(items);
    },
    async get(req, res) {
      const item = await Model.findById(req.validParams.id).populate(populate).lean();
      if (!item) throw AppError.notFound(`${label} não encontrado(a).`);
      res.json(item);
    },
    async create(req, res) {
      const item = await Model.create(await prepare(req.body));
      await audit(req, {
        action: `${entity.toLowerCase()}.create`,
        entity,
        entityId: item._id,
        entityLabel: item.name,
        summary: `${label} "${item.name}" cadastrado(a)${describe ? ` — ${describe(item)}` : ''}`,
      });
      res.status(201).json(await Model.findById(item._id).populate(populate).lean());
    },
    async update(req, res) {
      const item = await Model.findById(req.validParams.id);
      if (!item) throw AppError.notFound(`${label} não encontrado(a).`);
      const before = item.toObject();
      Object.assign(item, await prepare(req.body, item));
      await item.save();
      const statusChanged = before.status !== item.status || before.active !== item.active;
      await audit(req, {
        action: `${entity.toLowerCase()}.update`,
        entity,
        entityId: item._id,
        entityLabel: item.name,
        summary: `${label} "${item.name}" alterado(a)${describe ? ` — ${describe(item)}` : ''}`,
        details: statusChanged ? { status: { de: before.status ?? before.active, para: item.status ?? item.active } } : null,
      });
      res.json(await Model.findById(item._id).populate(populate).lean());
    },
    /** Ativar/desativar ou mudar status (ex.: manutenção) sem reenviar o cadastro completo. */
    async setStatus(req, res) {
      const item = await Model.findById(req.validParams.id);
      if (!item) throw AppError.notFound(`${label} não encontrado(a).`);
      const before = { active: item.active, status: item.status };
      if (req.body.active !== undefined && 'active' in item.schema.paths) item.active = req.body.active;
      if (req.body.status !== undefined && 'status' in item.schema.paths) item.status = req.body.status;
      await item.save();
      await audit(req, {
        action: `${entity.toLowerCase()}.status`,
        entity,
        entityId: item._id,
        entityLabel: item.name,
        summary: `${label} "${item.name}": ${
          req.body.status !== undefined ? `status ${before.status} → ${item.status}` : item.active ? 'ativado(a)' : 'desativado(a)'
        }`,
      });
      res.json(await Model.findById(item._id).populate(populate).lean());
    },
  };
}

export const instructors = crud(Instructor, { entity: 'Instructor', label: 'Instrutor' });

export const services = crud(Service, {
  entity: 'Service',
  label: 'Serviço',
  populate: [{ path: 'compatibleRooms', select: 'name code' }],
  sort: { active: -1, category: 1, name: 1 },
  describe: (s) => `preço de referência ${formatBRL(s.basePrice)}`,
  prepare: async (data) => {
    if (data.priceTiers) data.priceTiers = [...data.priceTiers].sort((a, b) => a.quantity - b.quantity);
    if (data.pricingMode === 'por_quantidade' && data.priceTiers?.length) data.basePrice = data.priceTiers[0].price;
    return data;
  },
});

export const packages = crud(Package, {
  entity: 'Package',
  label: 'Pacote',
  populate: [{ path: 'items.service', select: 'name category durationMinutes basePrice' }],
  sort: { active: -1, name: 1 },
  describe: (p) => `${formatBRL(p.price)}`,
  prepare: async (data) => {
    if (!data.items) return data;
    const ids = data.items.map((i) => i.service);
    const found = await Service.find({ _id: { $in: ids } }).lean();
    const byId = new Map(found.map((s) => [String(s._id), s]));
    const items = data.items.map((it) => {
      const svc = byId.get(String(it.service));
      if (!svc) throw AppError.badRequest('Serviço do pacote não encontrado.');
      return {
        service: it.service,
        quantity: it.quantity,
        durationMinutes: it.durationMinutes ?? svc.durationMinutes,
        unitPrice: it.unitPrice ?? svc.basePrice,
      };
    });
    return { ...data, items, ...computePackagePricing(items, data.price) };
  },
});

export const rooms = crud(Room, {
  entity: 'Room',
  label: 'Sala',
  sort: { code: 1 },
  prepare: async (data) => {
    if (data.code) data.code = data.code.toUpperCase();
    return data;
  },
});

export const resources = crud(Resource, {
  entity: 'Resource',
  label: 'Equipamento',
  populate: [{ path: 'room', select: 'name code' }],
  sort: { category: 1, code: 1 },
  prepare: async (data) => {
    if (data.code) data.code = data.code.toUpperCase();
    return data;
  },
});

/** Agenda individual de um instrutor. */
export async function instructorAgenda(req, res) {
  const { start, end } = resolvePeriod(req.validQuery.from, req.validQuery.to);
  const items = await Appointment.find({ instructor: req.validParams.id, start: { $gte: start, $lt: end } })
    .sort({ start: 1 })
    .populate(APPOINTMENT_POPULATE)
    .lean();
  res.json(items.map((a) => presentAppointment(a, req.user)));
}
