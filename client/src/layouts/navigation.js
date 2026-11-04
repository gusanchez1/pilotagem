import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileBarChart2,
  Gauge,
  HandCoins,
  Layers,
  Receipt,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

/** Menu lateral: cada item exige ao menos uma das permissões listadas. */
export const NAVIGATION = [
  {
    section: null,
    items: [
      { to: '/', label: 'Dashboard', icon: Gauge, perms: ['dashboard:view'], end: true },
      { to: '/portal', label: 'Meu portal', icon: UserRound, perms: ['portal:view'] },
    ],
  },
  {
    section: 'Operação',
    items: [
      { to: '/agenda', label: 'Agenda', icon: CalendarDays, perms: ['appointments:view'] },
      { to: '/reservas', label: 'Reservas e salas', icon: CalendarRange, perms: ['reservations:view'] },
      { to: '/clientes', label: 'Clientes', icon: Users, perms: ['clients:view'] },
    ],
  },
  {
    section: 'Financeiro',
    items: [
      { to: '/financeiro/vendas', label: 'Vendas', icon: HandCoins, perms: ['sales:view'] },
      { to: '/financeiro/contas-a-receber', label: 'Contas a receber', icon: ClipboardList, perms: ['finance:view'] },
      { to: '/financeiro/despesas', label: 'Despesas', icon: Receipt, perms: ['expenses:view'] },
      { to: '/relatorios', label: 'Relatórios', icon: FileBarChart2, perms: ['reports:financial', 'reports:operational'] },
    ],
  },
  {
    section: 'Cadastros',
    items: [
      { to: '/catalogo', label: 'Serviços e pacotes', icon: Layers, perms: ['catalog:view'] },
      { to: '/salas', label: 'Salas e equipamentos', icon: Building2, perms: ['rooms:view'] },
      { to: '/instrutores', label: 'Instrutores', icon: BarChart3, perms: ['instructors:view'] },
    ],
  },
  {
    section: 'Administração',
    items: [
      { to: '/auditoria', label: 'Auditoria', icon: ShieldCheck, perms: ['audit:view'] },
      { to: '/configuracoes', label: 'Configurações', icon: Settings, perms: ['settings:manage'] },
    ],
  },
];
