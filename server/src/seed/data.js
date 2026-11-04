/**
 * Dados demonstrativos FICTÍCIOS. Nenhum nome corresponde a funcionários ou clientes reais.
 * Valores monetários em centavos.
 */

export const DEMO_PASSWORDS = {
  admin: 'Admin@123',
  recepcao: 'Recepcao@123',
  financeiro: 'Financeiro@123',
  instrutor: 'Instrutor@123',
};

export const USERS = [
  { key: 'admin', name: 'Marina Duarte', email: 'admin@pilotagem.local', role: 'admin' },
  { key: 'rec1', name: 'Larissa Mendes', email: 'recepcao1@pilotagem.local', role: 'recepcao' },
  { key: 'rec2', name: 'Bianca Torres', email: 'recepcao2@pilotagem.local', role: 'recepcao' },
  { key: 'fin', name: 'Ricardo Almeida', email: 'financeiro@pilotagem.local', role: 'financeiro' },
  { key: 'ins1', name: 'Thiago Ventura', email: 'instrutor1@pilotagem.local', role: 'instrutor', instructor: 'thiago' },
  { key: 'ins2', name: 'Camila Rocha', email: 'instrutor2@pilotagem.local', role: 'instrutor', instructor: 'camila' },
  { key: 'ins3', name: 'Eduardo Lins', email: 'instrutor3@pilotagem.local', role: 'instrutor', instructor: 'eduardo' },
];

export const INSTRUCTORS = [
  {
    key: 'thiago',
    name: 'Thiago Ventura',
    phone: '(11) 90000-1101',
    specialty: 'Pilotagem e simulação',
    bio: 'Instrutor de pilotagem com foco em técnica de frenagem, traçado e consistência de voltas.',
    color: '#2563EB',
    services: ['sim', 'selection'],
  },
  {
    key: 'camila',
    name: 'Camila Rocha',
    phone: '(11) 90000-1102',
    specialty: 'Preparação psicofísica',
    bio: 'Responsável pelos treinamentos de reação, foco, respiração e condicionamento específico para pilotos.',
    color: '#DB2777',
    services: ['psico'],
  },
  {
    key: 'eduardo',
    name: 'Eduardo Lins',
    phone: '(11) 90000-1103',
    specialty: 'Simulação e telemetria',
    bio: 'Analisa dados de telemetria e conduz sessões de simulador para evolução de desempenho.',
    color: '#059669',
    services: ['sim', 'selection'],
  },
];

export const ROOMS = [
  {
    key: 'sim',
    name: 'Sala de Simuladores',
    code: 'SIM-01',
    type: 'simulacao',
    capacity: 8,
    shared: true,
    amenities: ['Ar-condicionado', 'Telemetria', 'Monitores para instrutor'],
    description: 'Sala principal com simuladores profissionais. Permite treinamentos simultâneos em simuladores diferentes.',
    hourlyRate: null,
  },
  {
    key: 'rr',
    name: 'Racing Room',
    code: 'RR-01',
    type: 'racing_room',
    capacity: 12,
    shared: true,
    amenities: ['Telão', 'Área de espera', 'Som ambiente'],
    description: 'Ambiente de experiência com simuladores lado a lado para grupos e disputas.',
    hourlyRate: 60000,
  },
  {
    key: 'psi',
    name: 'Sala de Preparação Psicofísica',
    code: 'PSI-01',
    type: 'preparacao',
    capacity: 4,
    shared: false,
    amenities: ['Equipamentos de reação', 'Tatame'],
    description: 'Espaço para treinamentos de reação, foco e preparação física.',
    hourlyRate: null,
  },
  {
    key: 'brf',
    name: 'Sala de Briefing',
    code: 'BRF-01',
    type: 'reuniao',
    capacity: 12,
    shared: false,
    amenities: ['TV 75"', 'Quadro branco', 'Videoconferência'],
    description: 'Sala para briefings, análise de vídeo e reuniões. Disponível para locação.',
    hourlyRate: 15000,
  },
  {
    key: 'evt',
    name: 'Espaço de Eventos',
    code: 'EVT-01',
    type: 'evento',
    capacity: 40,
    shared: false,
    amenities: ['Projetor', 'Sistema de som', 'Copa'],
    description: 'Espaço multiuso para eventos corporativos, palestras e confraternizações.',
    hourlyRate: 45000,
  },
];

export const RESOURCES = [
  { key: 'simp1', name: 'Simulador Pro 01', code: 'SIM-P01', category: 'simulador', room: 'sim' },
  { key: 'simp2', name: 'Simulador Pro 02', code: 'SIM-P02', category: 'simulador', room: 'sim' },
  { key: 'simp3', name: 'Simulador Pro 03', code: 'SIM-P03', category: 'simulador', room: 'sim' },
  {
    key: 'simp4',
    name: 'Simulador Pro 04',
    code: 'SIM-P04',
    category: 'simulador',
    room: 'sim',
    status: 'manutencao',
    notes: 'Base de movimento em manutenção corretiva (aguardando peça).',
  },
  { key: 'rr1', name: 'Simulador Racing Room 01', code: 'SIM-R01', category: 'simulador', room: 'rr' },
  { key: 'rr2', name: 'Simulador Racing Room 02', code: 'SIM-R02', category: 'simulador', room: 'rr' },
  { key: 'rr3', name: 'Simulador Racing Room 03', code: 'SIM-R03', category: 'simulador', room: 'rr' },
  { key: 'rr4', name: 'Simulador Racing Room 04', code: 'SIM-R04', category: 'simulador', room: 'rr' },
  { key: 'kit', name: 'Kit de testes cognitivos', code: 'EQ-COG1', category: 'equipamento_fisico', room: 'psi' },
  { key: 'react', name: 'Painel de tempo de reação', code: 'EQ-REA1', category: 'equipamento_fisico', room: 'psi' },
  { key: 'proj', name: 'Projetor e telão', code: 'AV-PRJ1', category: 'audiovisual', room: 'evt' },
  { key: 'som', name: 'Sistema de som', code: 'AV-SOM1', category: 'audiovisual', room: 'evt' },
];

export const SERVICES = [
  {
    key: 'sim',
    name: 'Sessão de simulador',
    category: 'Simulação',
    description: 'Sessão individual de 1 hora em simulador profissional, acompanhada por instrutor.',
    durationMinutes: 60,
    basePrice: 43000,
    requiresInstructor: true,
    requiresRoom: true,
    requiredResources: [{ category: 'simulador', quantity: 1 }],
    rooms: ['sim'],
    priceNote: 'Preço de referência do site institucional — não confirmado como tabela comercial.',
  },
  {
    key: 'rr',
    name: 'Sessão Racing Room',
    category: 'Racing Room',
    description: 'Experiência de 1 hora na Racing Room. O preço varia conforme a quantidade de simuladores.',
    durationMinutes: 60,
    basePrice: 25000,
    pricingMode: 'por_quantidade',
    quantityLabel: 'simulador',
    priceTiers: [
      { quantity: 1, price: 25000, label: '1 simulador' },
      { quantity: 2, price: 45000, label: '2 simuladores' },
      { quantity: 3, price: 60000, label: '3 simuladores' },
      { quantity: 4, price: 70000, label: '4 simuladores' },
    ],
    requiresInstructor: false,
    requiresRoom: true,
    requiredResources: [{ category: 'simulador', quantity: 1 }],
    rooms: ['rr'],
    priceNote: 'Valores de cada opção são o PREÇO TOTAL da opção (referência do site Racing Room).',
  },
  {
    key: 'psico',
    name: 'Treinamento psicofísico',
    category: 'Preparação',
    description: 'Treinamento de 1 hora de reação, foco, respiração e condicionamento para pilotos.',
    durationMinutes: 60,
    basePrice: 43000,
    requiresInstructor: true,
    requiresRoom: true,
    requiredResources: [],
    rooms: ['psi'],
    priceNote: 'Preço de referência do site institucional.',
  },
  {
    key: 'aluguel',
    name: 'Aluguel de simulador',
    category: 'Locação',
    description: 'Locação de simulador por 12 horas.',
    durationMinutes: 720,
    basePrice: 600000,
    requiresInstructor: false,
    requiresRoom: false,
    requiredResources: [{ category: 'simulador', quantity: 1 }],
    rooms: [],
    priceNote: 'Preço de referência do site institucional.',
  },
  {
    key: 'selection',
    name: 'Pilotech Selection',
    category: 'Programas',
    description: 'Programa de avaliação e seleção de pilotos. Duração não informada no site — definir no agendamento.',
    durationMinutes: null,
    basePrice: 300000,
    requiresInstructor: true,
    requiresRoom: true,
    requiredResources: [],
    rooms: ['sim', 'brf'],
    priceNote: 'Preço de referência do site institucional. Duração não informada.',
  },
];

export const PACKAGES = [
  {
    key: 'evolucao',
    name: 'Pacote Evolução — 5 sessões',
    description: 'Cinco sessões de simulador com instrutor para evolução contínua de técnica. (Pacote demonstrativo.)',
    items: [{ service: 'sim', quantity: 5 }],
    simulatorCount: 1,
    price: 195000,
    validityDays: 90,
  },
  {
    key: 'completo',
    name: 'Programa Piloto Completo',
    description: 'Quatro sessões de simulador e quatro treinamentos psicofísicos. (Pacote demonstrativo.)',
    items: [
      { service: 'sim', quantity: 4 },
      { service: 'psico', quantity: 4 },
    ],
    simulatorCount: 1,
    price: 310000,
    validityDays: 120,
  },
  {
    key: 'grupo',
    name: 'Racing Room em Grupo — 2 baterias',
    description: 'Duas sessões de Racing Room com 4 simuladores para grupos e confraternizações. (Pacote demonstrativo.)',
    items: [{ service: 'rr', quantity: 2, unitPrice: 70000 }],
    simulatorCount: 4,
    price: 129000,
    validityDays: 60,
  },
];

export const CATEGORIES = [
  { name: 'Treinamentos', type: 'receita', color: '#18181B' },
  { name: 'Racing Room', type: 'receita', color: '#CA8A04' },
  { name: 'Pacotes e programas', type: 'receita', color: '#2563EB' },
  { name: 'Locações', type: 'receita', color: '#059669' },
  { name: 'Eventos', type: 'receita', color: '#7C3AED' },
  { name: 'Outras receitas', type: 'receita', color: '#71717A' },
  { name: 'Aluguel e condomínio', type: 'despesa', color: '#18181B' },
  { name: 'Pessoal e encargos', type: 'despesa', color: '#2563EB' },
  { name: 'Energia e utilidades', type: 'despesa', color: '#CA8A04' },
  { name: 'Tecnologia e software', type: 'despesa', color: '#7C3AED' },
  { name: 'Marketing', type: 'despesa', color: '#DB2777' },
  { name: 'Manutenção de equipamentos', type: 'despesa', color: '#EA580C' },
  { name: 'Materiais e consumo', type: 'despesa', color: '#059669' },
  { name: 'Serviços terceirizados', type: 'despesa', color: '#0891B2' },
  { name: 'Impostos e taxas', type: 'despesa', color: '#71717A' },
];

/** Despesas recorrentes mensais: [descrição, categoria, valor base, variação, dia de vencimento, fornecedor] */
export const RECURRING_EXPENSES = [
  ['Aluguel do imóvel', 'Aluguel e condomínio', 1450000, 0, 5, 'Imobiliária Horizonte (fictícia)'],
  ['Folha de pagamento', 'Pessoal e encargos', 1400000, 0, 5, ''],
  ['Contabilidade', 'Serviços terceirizados', 140000, 0, 8, 'Escritório Contábil Alfa (fictício)'],
  ['Internet e telefonia', 'Energia e utilidades', 48000, 0, 10, 'Provedor Net Rápida (fictício)'],
  ['Energia elétrica', 'Energia e utilidades', 260000, 80000, 12, 'Distribuidora de energia'],
  ['Licenças de software de simulação e telemetria', 'Tecnologia e software', 185000, 0, 15, 'SimSoft (fictício)'],
  ['Marketing digital e anúncios', 'Marketing', 200000, 150000, 20, 'Agência Pista Digital (fictícia)'],
  ['Materiais de limpeza e consumo', 'Materiais e consumo', 60000, 30000, 18, 'Distribuidora Central (fictícia)'],
];

const FIRST = [
  'Gabriel', 'Lucas', 'Mateus', 'Rafael', 'Felipe', 'Bruno', 'Diego', 'Gustavo', 'Henrique', 'Igor', 'João', 'Leonardo',
  'Marcelo', 'Nicolas', 'Otávio', 'Paulo', 'Renato', 'Samuel', 'Vinícius', 'André', 'Beatriz', 'Carolina', 'Daniela',
  'Fernanda', 'Helena', 'Isabela', 'Juliana', 'Letícia', 'Mariana', 'Natália', 'Patrícia', 'Renata',
];
const LAST = [
  'Silva Prado', 'Moraes', 'Teixeira Lima', 'Barros', 'Campos', 'Nogueira', 'Pacheco', 'Rezende', 'Siqueira', 'Toledo',
  'Vasconcelos', 'Andrade Neto', 'Brandão', 'Coutinho', 'Diniz', 'Esteves', 'Fontana', 'Guimarães', 'Leal', 'Macedo',
  'Novaes', 'Pimentel', 'Quintela', 'Rangel', 'Sampaio', 'Tavares', 'Valadares', 'Xavier', 'Zanetti', 'Aragão', 'Bittencourt', 'Cordeiro',
];

export const CLIENT_NOTES = [
  'Prefere horários no fim da tarde.',
  'Piloto de kart buscando transição para fórmula.',
  'Indicado por outro aluno.',
  'Treina para campeonato regional.',
  'Primeira experiência com simulador.',
  '',
  '',
  '',
];

export function buildClients() {
  const clients = FIRST.map((first, i) => ({
    firstName: first,
    lastName: LAST[i],
    phone: `(11) 9${String(1000 + i * 37).padStart(4, '0')}-${String(2000 + i * 53).slice(-4)}`,
    notes: CLIENT_NOTES[i % CLIENT_NOTES.length],
  }));
  clients.push(
    {
      firstName: 'Augusto',
      lastName: 'Vilela Prates',
      phone: '(11) 98888-0101',
      confidential: true,
      alias: 'Piloto Reservado 01',
      notes: 'Cliente solicita discrição total. Não fotografar nem mencionar em redes sociais.',
    },
    {
      firstName: 'Helena',
      lastName: 'Montenegro Saldanha',
      phone: '(21) 98888-0202',
      confidential: true,
      alias: 'Convidada Executiva',
      notes: 'Agendamentos apenas pela recepção. Usar entrada lateral.',
    },
    {
      firstName: 'Ricardo',
      lastName: 'Albuquerque Penna',
      phone: '(11) 98888-0303',
      confidential: true,
      alias: 'Piloto Reservado 02',
      notes: 'Contato somente pelo assessor. Dados não devem aparecer em relatórios.',
    },
  );
  return clients;
}

export const SESSION_NOTES = [
  'Boa evolução na frenagem da curva 1. Trabalhar ponto de tangência no S do Senna.',
  'Consistência acima de 98% nas últimas 10 voltas. Próxima sessão: pista molhada.',
  'Tempo de reação médio de 0,31 s. Melhora de 6% em relação à avaliação inicial.',
  'Ajustado o setup de pedais. Cliente relatou desconforto na lombar — reforçar alongamento.',
  'Sessão focada em largadas e defesa de posição.',
  'Exercícios de respiração reduziram a frequência cardíaca média em situação de pressão.',
];
