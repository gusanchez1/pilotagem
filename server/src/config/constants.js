/**
 * Enumerações do domínio. Os valores são armazenados no banco; os rótulos (LABELS)
 * são usados em exportações CSV/PDF. O frontend possui rótulos equivalentes.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECEPCAO: 'recepcao',
  FINANCEIRO: 'financeiro',
  INSTRUTOR: 'instrutor',
});
export const ROLE_VALUES = Object.values(ROLES);

export const APPOINTMENT_STATUS = [
  'solicitado',
  'agendado',
  'confirmado',
  'em_andamento',
  'concluido',
  'cancelado',
  'nao_compareceu',
];
/** Status que NÃO ocupam o horário do instrutor/sala/equipamento. */
export const APPOINTMENT_NON_BLOCKING = ['cancelado', 'nao_compareceu'];

export const APPOINTMENT_ORIGINS = ['recepcao', 'site_pilotech', 'site_racing_room', 'telefone', 'whatsapp', 'outro'];

/** Transições de status permitidas na agenda. */
export const APPOINTMENT_TRANSITIONS = {
  solicitado: ['agendado', 'confirmado', 'cancelado'],
  agendado: ['confirmado', 'em_andamento', 'concluido', 'cancelado', 'nao_compareceu'],
  confirmado: ['agendado', 'em_andamento', 'concluido', 'cancelado', 'nao_compareceu'],
  em_andamento: ['concluido', 'confirmado', 'cancelado'],
  concluido: ['em_andamento'],
  cancelado: [],
  nao_compareceu: ['agendado', 'confirmado'],
};

export const RESERVATION_STATUS = ['pendente', 'confirmada', 'em_uso', 'concluida', 'cancelada'];
export const RESERVATION_NON_BLOCKING = ['cancelada'];
export const USAGE_TYPES = ['treinamento', 'locacao', 'evento', 'uso_interno', 'manutencao'];

export const ROOM_TYPES = ['simulacao', 'racing_room', 'preparacao', 'reuniao', 'evento', 'multiuso'];
export const ROOM_STATUS = ['ativa', 'manutencao', 'inativa'];

export const RESOURCE_CATEGORIES = ['simulador', 'equipamento_fisico', 'audiovisual', 'outro'];
export const RESOURCE_STATUS = ['disponivel', 'manutencao', 'inativo'];

export const PRICING_MODES = ['fixo', 'por_quantidade'];

export const PAYMENT_METHODS = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'outro'];
export const PAYMENT_STATUS = ['ativo', 'estornado'];
export const INSTALLMENT_STATUS = ['pendente', 'recebida', 'cancelada'];

export const SALE_STATUS = ['ativa', 'cancelada'];
export const SALE_PAYMENT_STATUS = ['em_aberto', 'parcial', 'quitada'];
export const SALE_ITEM_TYPES = ['servico', 'pacote', 'locacao', 'personalizado'];
export const PAYMENT_TERMS = ['antecipado', 'no_dia', 'posterior', 'parcelado', 'a_combinar'];

export const EXPENSE_STATUS = ['pendente', 'paga', 'cancelada'];
export const CATEGORY_TYPES = ['receita', 'despesa'];

export const LABELS = {
  role: { admin: 'Administrador', recepcao: 'Recepção', financeiro: 'Financeiro', instrutor: 'Instrutor' },
  appointmentStatus: {
    solicitado: 'Solicitado',
    agendado: 'Agendado',
    confirmado: 'Confirmado',
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    nao_compareceu: 'Não compareceu',
  },
  origin: {
    recepcao: 'Recepção',
    site_pilotech: 'Site Pilotech',
    site_racing_room: 'Site Racing Room',
    telefone: 'Telefone',
    whatsapp: 'WhatsApp',
    outro: 'Outro canal',
  },
  reservationStatus: {
    pendente: 'Pendente',
    confirmada: 'Confirmada',
    em_uso: 'Em uso',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  },
  usageType: {
    treinamento: 'Treinamento',
    locacao: 'Locação',
    evento: 'Evento',
    uso_interno: 'Uso interno',
    manutencao: 'Manutenção',
  },
  paymentMethod: {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito',
    boleto: 'Boleto',
    outro: 'Outros',
  },
  installmentStatus: { pendente: 'Pendente', recebida: 'Recebida', cancelada: 'Cancelada' },
  salePaymentStatus: { em_aberto: 'Em aberto', parcial: 'Parcial', quitada: 'Quitada' },
  saleStatus: { ativa: 'Ativa', cancelada: 'Cancelada' },
  expenseStatus: { pendente: 'Pendente', paga: 'Paga', cancelada: 'Cancelada' },
  saleItemType: { servico: 'Serviço', pacote: 'Pacote', locacao: 'Locação', personalizado: 'Personalizado' },
  roomType: {
    simulacao: 'Simulação',
    racing_room: 'Racing Room',
    preparacao: 'Preparação psicofísica',
    reuniao: 'Reunião / briefing',
    evento: 'Eventos',
    multiuso: 'Multiuso',
  },
  resourceCategory: {
    simulador: 'Simulador',
    equipamento_fisico: 'Equipamento físico',
    audiovisual: 'Audiovisual',
    outro: 'Outro',
  },
};
