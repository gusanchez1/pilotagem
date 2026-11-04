import { ROLES } from './constants.js';

/**
 * Controle de acesso baseado em funções (RBAC).
 *
 * Esta é a ÚNICA fonte da verdade sobre permissões. O frontend recebe a lista de permissões
 * do usuário em GET /api/auth/me apenas para decidir o que exibir; cada rota da API verifica
 * novamente a permissão no servidor (middleware `permit`).
 */
export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard:view',
  FINANCE_VIEW: 'finance:view',

  USERS_MANAGE: 'users:manage',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_VIEW: 'audit:view',
  DEMO_RESET: 'demo:reset',

  CLIENTS_VIEW: 'clients:view',
  CLIENTS_MANAGE: 'clients:manage',
  CLIENTS_CONFIDENTIAL: 'clients:confidential',

  INSTRUCTORS_VIEW: 'instructors:view',
  INSTRUCTORS_MANAGE: 'instructors:manage',

  CATALOG_VIEW: 'catalog:view',
  CATALOG_MANAGE: 'catalog:manage',

  ROOMS_VIEW: 'rooms:view',
  ROOMS_MANAGE: 'rooms:manage',

  RESERVATIONS_VIEW: 'reservations:view',
  RESERVATIONS_MANAGE: 'reservations:manage',

  APPOINTMENTS_VIEW: 'appointments:view',
  APPOINTMENTS_MANAGE: 'appointments:manage',
  APPOINTMENTS_UPDATE_STATUS: 'appointments:update_status',

  PORTAL_VIEW: 'portal:view',

  SALES_VIEW: 'sales:view',
  SALES_MANAGE: 'sales:manage',
  PAYMENTS_MANAGE: 'payments:manage',

  EXPENSES_VIEW: 'expenses:view',
  EXPENSES_MANAGE: 'expenses:manage',
  CATEGORIES_MANAGE: 'categories:manage',

  REPORTS_FINANCIAL: 'reports:financial',
  REPORTS_OPERATIONAL: 'reports:operational',
});

const P = PERMISSIONS;

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(P).filter((p) => p !== P.PORTAL_VIEW),

  [ROLES.RECEPCAO]: [
    P.DASHBOARD_VIEW,
    P.CLIENTS_VIEW,
    P.CLIENTS_MANAGE,
    P.CLIENTS_CONFIDENTIAL,
    P.INSTRUCTORS_VIEW,
    P.CATALOG_VIEW,
    P.ROOMS_VIEW,
    P.RESERVATIONS_VIEW,
    P.RESERVATIONS_MANAGE,
    P.APPOINTMENTS_VIEW,
    P.APPOINTMENTS_MANAGE,
    P.APPOINTMENTS_UPDATE_STATUS,
    P.SALES_VIEW,
    P.REPORTS_OPERATIONAL,
  ],

  [ROLES.FINANCEIRO]: [
    P.DASHBOARD_VIEW,
    P.FINANCE_VIEW,
    P.CLIENTS_VIEW,
    P.CATALOG_VIEW,
    P.APPOINTMENTS_VIEW,
    P.SALES_VIEW,
    P.SALES_MANAGE,
    P.PAYMENTS_MANAGE,
    P.EXPENSES_VIEW,
    P.EXPENSES_MANAGE,
    P.CATEGORIES_MANAGE,
    P.REPORTS_FINANCIAL,
  ],

  [ROLES.INSTRUTOR]: [P.PORTAL_VIEW, P.ROOMS_VIEW],
};

/**
 * Permissões que dependem de autorização configurável pelo administrador (Configurações).
 */
function conditionalPermissions(role, settings = {}) {
  const extra = [];
  if (role === ROLES.RECEPCAO && settings.receptionCanManageSales !== false) {
    extra.push(P.SALES_MANAGE, P.PAYMENTS_MANAGE);
  }
  if (role === ROLES.INSTRUTOR && settings.instructorsCanUpdateStatus !== false) {
    extra.push(P.APPOINTMENTS_UPDATE_STATUS);
  }
  return extra;
}

export function getPermissions(role, settings) {
  const base = ROLE_PERMISSIONS[role] || [];
  return [...new Set([...base, ...conditionalPermissions(role, settings)])];
}

export function hasPermission(user, permission) {
  return Boolean(user?.permissions?.includes(permission));
}
