/** Rótulos e tons de status (espelham os enums da API). */

export const ROLE = { admin: 'Administrador', recepcao: 'Recepção', financeiro: 'Financeiro', instrutor: 'Instrutor' };

export const APPOINTMENT_STATUS = {
  solicitado: { label: 'Solicitado', tone: 'violet' },
  agendado: { label: 'Agendado', tone: 'blue' },
  confirmado: { label: 'Confirmado', tone: 'teal' },
  em_andamento: { label: 'Em andamento', tone: 'amber' },
  concluido: { label: 'Concluído', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'zinc' },
  nao_compareceu: { label: 'Não compareceu', tone: 'red' },
};

export const APPOINTMENT_TRANSITIONS = {
  solicitado: ['agendado', 'confirmado', 'cancelado'],
  agendado: ['confirmado', 'em_andamento', 'concluido', 'cancelado', 'nao_compareceu'],
  confirmado: ['agendado', 'em_andamento', 'concluido', 'cancelado', 'nao_compareceu'],
  em_andamento: ['concluido', 'confirmado', 'cancelado'],
  concluido: ['em_andamento'],
  cancelado: [],
  nao_compareceu: ['agendado', 'confirmado'],
};

export const ORIGIN = {
  recepcao: 'Recepção',
  site_pilotech: 'Site Pilotech',
  site_racing_room: 'Site Racing Room',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  outro: 'Outro canal',
};

export const RESERVATION_STATUS = {
  pendente: { label: 'Pendente', tone: 'violet' },
  confirmada: { label: 'Confirmada', tone: 'blue' },
  em_uso: { label: 'Em uso', tone: 'amber' },
  concluida: { label: 'Concluída', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'zinc' },
};

export const USAGE_TYPE = {
  treinamento: { label: 'Treinamento', tone: 'blue' },
  locacao: { label: 'Locação', tone: 'teal' },
  evento: { label: 'Evento', tone: 'violet' },
  uso_interno: { label: 'Uso interno', tone: 'zinc' },
  manutencao: { label: 'Manutenção', tone: 'red' },
};

export const PAYMENT_METHOD = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  boleto: 'Boleto',
  outro: 'Outros',
};

export const PAYMENT_TERMS = {
  antecipado: 'Pagamento antecipado',
  no_dia: 'No dia do treinamento',
  posterior: 'Após o treinamento',
  parcelado: 'Parcelado',
  a_combinar: 'A combinar',
};

export const SALE_PAYMENT_STATUS = {
  em_aberto: { label: 'Em aberto', tone: 'amber' },
  parcial: { label: 'Parcial', tone: 'blue' },
  quitada: { label: 'Quitada', tone: 'green' },
};

export const INSTALLMENT_STATUS = {
  pendente: { label: 'Pendente', tone: 'amber' },
  recebida: { label: 'Recebida', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'zinc' },
};

export const EXPENSE_STATUS = {
  pendente: { label: 'Pendente', tone: 'amber' },
  paga: { label: 'Paga', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'zinc' },
};

export const SALE_ITEM_TYPE = { servico: 'Serviço', pacote: 'Pacote', locacao: 'Locação', personalizado: 'Personalizado' };

export const ROOM_TYPE = {
  simulacao: 'Simulação',
  racing_room: 'Racing Room',
  preparacao: 'Preparação psicofísica',
  reuniao: 'Reunião / briefing',
  evento: 'Eventos',
  multiuso: 'Multiuso',
};

export const ROOM_STATUS = {
  ativa: { label: 'Ativa', tone: 'green' },
  manutencao: { label: 'Em manutenção', tone: 'red' },
  inativa: { label: 'Inativa', tone: 'zinc' },
};

export const RESOURCE_CATEGORY = {
  simulador: 'Simulador',
  equipamento_fisico: 'Equipamento físico',
  audiovisual: 'Audiovisual',
  outro: 'Outro',
};

export const RESOURCE_STATUS = {
  disponivel: { label: 'Disponível', tone: 'green' },
  manutencao: { label: 'Em manutenção', tone: 'red' },
  inativo: { label: 'Inativo', tone: 'zinc' },
};

export const options = (map) =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === 'string' ? v : v.label }));
