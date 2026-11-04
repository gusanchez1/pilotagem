import { z } from 'zod';
import {
  APPOINTMENT_ORIGINS,
  APPOINTMENT_STATUS,
  CATEGORY_TYPES,
  EXPENSE_STATUS,
  INSTALLMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  PRICING_MODES,
  RESERVATION_STATUS,
  RESOURCE_CATEGORIES,
  RESOURCE_STATUS,
  ROLE_VALUES,
  ROOM_STATUS,
  ROOM_TYPES,
  SALE_ITEM_TYPES,
  SALE_PAYMENT_STATUS,
  SALE_STATUS,
  USAGE_TYPES,
} from '../config/constants.js';
import {
  boolish,
  cents,
  dateKey,
  isoDate,
  objectId,
  optionalObjectId,
  pageQuery,
  periodQuery,
  positiveCents,
  requiredText,
  text,
  timeKey,
} from './common.js';

const reason = z.object({ reason: requiredText('Motivo', 300) });
const enumList = (values) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.enum(values)).optional());

/* ── Autenticação e usuários ─────────────────────────────── */
const email = z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido').max(160);
const password = z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(100);

export const loginSchema = z.object({ email, password: z.string().min(1, 'Informe a senha').max(100) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: password });

export const userCreateSchema = z.object({
  name: requiredText('Nome', 120),
  email,
  password,
  role: z.enum(ROLE_VALUES, { error: 'Perfil inválido' }),
  instructor: optionalObjectId,
  active: z.boolean().optional(),
});
export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial();
export const resetPasswordSchema = z.object({ password });

export const settingsSchema = z.object({
  companyName: text(80).optional(),
  receptionCanManageSales: z.boolean().optional(),
  instructorsCanUpdateStatus: z.boolean().optional(),
  businessHoursStart: timeKey.optional(),
  businessHoursEnd: timeKey.optional(),
});

/* ── Clientes ────────────────────────────────────────────── */
const phone = z
  .string({ error: 'Telefone é obrigatório' })
  .trim()
  .refine((v) => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13, 'Telefone inválido (inclua o DDD)');

export const clientCreateSchema = z.object({
  firstName: requiredText('Nome', 80),
  lastName: requiredText('Sobrenome', 120),
  phone,
  notes: text(2000).optional(),
  confidential: z.boolean().optional(),
  alias: text(80).optional(),
});
export const clientUpdateSchema = clientCreateSchema.partial().extend({ active: z.boolean().optional() });
export const clientListQuery = pageQuery.extend({
  confidential: boolish.optional(),
  active: boolish.optional(),
});

/* ── Instrutores ─────────────────────────────────────────── */
export const instructorSchema = z.object({
  name: requiredText('Nome', 120),
  phone: text(30).optional(),
  specialty: text(120).optional(),
  bio: text(2000).optional(),
  notes: text(2000).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Cor inválida').optional(),
  active: z.boolean().optional(),
});

/* ── Catálogo ────────────────────────────────────────────── */
export const serviceSchema = z
  .object({
    name: requiredText('Nome', 120),
    description: text(2000).optional(),
    category: requiredText('Categoria', 60),
    durationMinutes: z.coerce.number().int().min(0).max(24 * 60).nullable().optional(),
    basePrice: cents,
    pricingMode: z.enum(PRICING_MODES).default('fixo'),
    priceTiers: z
      .array(z.object({ quantity: z.coerce.number().int().min(1), price: cents, label: text(60).optional() }))
      .default([]),
    quantityLabel: text(40).optional(),
    requiresInstructor: z.boolean().default(false),
    requiresRoom: z.boolean().default(true),
    requiredResources: z
      .array(z.object({ category: z.enum(RESOURCE_CATEGORIES), quantity: z.coerce.number().int().min(1) }))
      .default([]),
    compatibleRooms: z.array(objectId).default([]),
    priceNote: text(300).optional(),
    active: z.boolean().default(true),
  })
  .refine((s) => s.pricingMode !== 'por_quantidade' || s.priceTiers.length > 0, {
    message: 'Cadastre ao menos uma faixa de preço por quantidade',
    path: ['priceTiers'],
  })
  .refine((s) => new Set(s.priceTiers.map((t) => t.quantity)).size === s.priceTiers.length, {
    message: 'Há faixas de preço com a mesma quantidade',
    path: ['priceTiers'],
  });

export const packageSchema = z.object({
  name: requiredText('Nome', 120),
  description: text(2000).optional(),
  items: z
    .array(
      z.object({
        service: objectId,
        quantity: z.coerce.number().int().min(1),
        durationMinutes: z.coerce.number().int().min(0).nullable().optional(),
        unitPrice: cents.optional(),
      }),
    )
    .min(1, 'Inclua ao menos um serviço no pacote'),
  simulatorCount: z.coerce.number().int().min(0).default(0),
  price: cents,
  validityDays: z.coerce.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
});

/* ── Salas e recursos ────────────────────────────────────── */
export const roomSchema = z.object({
  name: requiredText('Nome', 120),
  code: requiredText('Identificação', 30),
  description: text(2000).optional(),
  type: z.enum(ROOM_TYPES, { error: 'Tipo de sala inválido' }),
  capacity: z.coerce.number().int().min(0).nullable().optional(),
  amenities: z.array(text(60)).default([]),
  status: z.enum(ROOM_STATUS).default('ativa'),
  shared: z.boolean().default(false),
  hourlyRate: cents.nullable().optional(),
});

export const resourceSchema = z.object({
  name: requiredText('Nome', 120),
  category: z.enum(RESOURCE_CATEGORIES, { error: 'Categoria inválida' }),
  code: requiredText('Identificação', 30),
  description: text(2000).optional(),
  location: text(120).optional(),
  room: optionalObjectId,
  status: z.enum(RESOURCE_STATUS).default('disponivel'),
  notes: text(2000).optional(),
});

/* ── Disponibilidade e reservas ──────────────────────────── */
const interval = { start: isoDate, end: isoDate };
const intervalRefine = [(v) => !v.start || !v.end || v.start < v.end, { message: 'O término deve ser após o início', path: ['end'] }];

export const availabilitySchema = z
  .object({
    ...interval,
    instructor: optionalObjectId,
    room: optionalObjectId,
    rooms: z.array(objectId).default([]),
    resources: z.array(objectId).default([]),
    usageType: z.enum(USAGE_TYPES).default('treinamento'),
    excludeAppointment: optionalObjectId,
    excludeReservation: optionalObjectId,
  })
  .refine(...intervalRefine);

export const timelineQuery = z.object({ date: dateKey.optional() });

export const reservationCreateSchema = z
  .object({
    title: requiredText('Título', 160),
    client: optionalObjectId,
    responsible: text(120).optional(),
    rooms: z.array(objectId).default([]),
    resources: z.array(objectId).default([]),
    ...interval,
    usageType: z.enum(USAGE_TYPES, { error: 'Tipo de utilização inválido' }),
    amount: cents.optional(),
    status: z.enum(['pendente', 'confirmada']).optional(),
    notes: text(2000).optional(),
    createSale: z.boolean().optional(),
  })
  .refine(...intervalRefine);

export const reservationUpdateSchema = z
  .object({
    title: text(160).optional(),
    client: optionalObjectId,
    responsible: text(120).optional(),
    rooms: z.array(objectId).optional(),
    resources: z.array(objectId).optional(),
    start: isoDate.optional(),
    end: isoDate.optional(),
    usageType: z.enum(USAGE_TYPES).optional(),
    amount: cents.optional(),
    notes: text(2000).optional(),
  })
  .refine(...intervalRefine);

export const reservationListQuery = pageQuery.extend({
  ...periodQuery.shape,
  room: objectId.optional(),
  resource: objectId.optional(),
  status: enumList(RESERVATION_STATUS),
  usageType: enumList(USAGE_TYPES),
});

export const reservationStatusSchema = z.object({ status: z.enum(RESERVATION_STATUS) });
export const reasonSchema = reason;

/* ── Pagamentos ──────────────────────────────────────────── */
export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS, { error: 'Forma de pagamento inválida' }),
  amount: positiveCents,
  installmentsCount: z.coerce.number().int().min(1).max(24).default(1),
  firstDueDate: dateKey.optional(),
  receiveNow: z.boolean().optional(),
  receivedAt: dateKey.optional(),
  notes: text(1000).optional(),
  receiptReference: text(500).optional(),
});

/* ── Agendamentos ────────────────────────────────────────── */
const appointmentBase = {
  client: objectId,
  service: objectId,
  package: optionalObjectId,
  sale: optionalObjectId,
  instructor: optionalObjectId,
  room: optionalObjectId,
  resources: z.array(objectId).default([]),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  ...interval,
  contractedAmount: cents.optional(),
  origin: z.enum(APPOINTMENT_ORIGINS).default('recepcao'),
  status: z.enum(['solicitado', 'agendado', 'confirmado']).default('agendado'),
  notes: text(2000).optional(),
};

export const appointmentCreateSchema = z
  .object({
    ...appointmentBase,
    createSale: z.boolean().optional(),
    paymentTerms: z.enum(PAYMENT_TERMS).optional(),
    saleDueDate: dateKey.optional(),
    initialPayment: paymentSchema.optional(),
  })
  .refine(...intervalRefine);

export const appointmentUpdateSchema = z
  .object({
    client: objectId.optional(),
    service: objectId.optional(),
    package: optionalObjectId,
    instructor: optionalObjectId,
    room: optionalObjectId,
    resources: z.array(objectId).optional(),
    quantity: z.coerce.number().int().min(1).max(50).optional(),
    start: isoDate.optional(),
    end: isoDate.optional(),
    contractedAmount: cents.optional(),
    origin: z.enum(APPOINTMENT_ORIGINS).optional(),
    notes: text(2000).optional(),
  })
  .refine(...intervalRefine);

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS, { error: 'Status inválido' }),
  reason: text(300).optional(),
});
export const noteSchema = z.object({ text: requiredText('Observação', 2000) });

export const appointmentListQuery = pageQuery.extend({
  ...periodQuery.shape,
  instructor: objectId.optional(),
  room: objectId.optional(),
  client: objectId.optional(),
  service: objectId.optional(),
  status: enumList(APPOINTMENT_STATUS),
  origin: enumList(APPOINTMENT_ORIGINS),
});

/* ── Vendas ──────────────────────────────────────────────── */
const saleItem = z.object({
  type: z.enum(SALE_ITEM_TYPES),
  service: optionalObjectId,
  package: optionalObjectId,
  description: text(200).optional(),
  modality: text(60).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: cents,
  discount: cents.default(0),
});

export const saleCreateSchema = z.object({
  client: optionalObjectId,
  items: z.array(saleItem).min(1, 'Inclua ao menos um item na venda'),
  discount: cents.default(0),
  saleDate: dateKey.optional(),
  dueDate: dateKey.optional(),
  category: optionalObjectId,
  paymentTerms: z.enum(PAYMENT_TERMS).default('antecipado'),
  description: text(300).optional(),
  notes: text(2000).optional(),
  appointments: z.array(objectId).default([]),
  payments: z.array(paymentSchema).default([]),
});

export const saleUpdateSchema = z.object({
  items: z.array(saleItem).min(1).optional(),
  discount: cents.optional(),
  saleDate: dateKey.optional(),
  dueDate: dateKey.optional(),
  category: optionalObjectId,
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  description: text(300).optional(),
  notes: text(2000).optional(),
});

export const saleListQuery = pageQuery.extend({
  ...periodQuery.shape,
  status: z.enum(SALE_STATUS).optional(),
  paymentStatus: enumList(SALE_PAYMENT_STATUS),
  client: objectId.optional(),
  category: objectId.optional(),
  overdue: boolish.optional(),
});

export const paymentUpdateSchema = z.object({
  notes: text(1000).optional(),
  receiptReference: text(500).optional(),
});

export const installmentListQuery = pageQuery.extend({
  ...periodQuery.shape,
  status: enumList(INSTALLMENT_STATUS),
  method: z.enum(PAYMENT_METHODS).optional(),
  overdue: boolish.optional(),
  client: objectId.optional(),
});
export const receiveSchema = z.object({ receivedAt: dateKey.optional() });

/* ── Despesas e categorias ───────────────────────────────── */
export const expenseCreateSchema = z.object({
  description: requiredText('Descrição', 200),
  category: objectId,
  amount: positiveCents,
  dueDate: dateKey,
  paidAt: dateKey.nullable().optional(),
  method: z.enum(PAYMENT_METHODS).nullable().optional(),
  supplier: text(120).optional(),
  notes: text(2000).optional(),
  receiptReference: text(500).optional(),
});
export const expenseUpdateSchema = expenseCreateSchema.partial();
export const expensePaySchema = z.object({ paidAt: dateKey.optional(), method: z.enum(PAYMENT_METHODS) });
export const expenseListQuery = pageQuery.extend({
  ...periodQuery.shape,
  status: enumList(EXPENSE_STATUS),
  category: objectId.optional(),
  overdue: boolish.optional(),
});

export const categorySchema = z.object({
  name: requiredText('Nome', 80),
  type: z.enum(CATEGORY_TYPES),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Cor inválida').optional(),
  active: z.boolean().optional(),
});
export const categoryUpdateSchema = categorySchema.omit({ type: true }).partial();

/* ── Relatórios, dashboard, auditoria ────────────────────── */
export const dashboardQuery = periodQuery;

export const reportQuery = periodQuery.extend({
  category: objectId.optional(),
  service: objectId.optional(),
  instructor: objectId.optional(),
  room: objectId.optional(),
  status: z.string().trim().max(40).optional(),
  format: z.enum(['csv', 'pdf']).optional(),
});

export const auditListQuery = pageQuery.extend({
  ...periodQuery.shape,
  entity: z.string().trim().max(40).optional(),
  action: z.string().trim().max(60).optional(),
  user: objectId.optional(),
});
