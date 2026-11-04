import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { Button, EmptyState, Spinner } from './components/ui/index.js';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import Login from './pages/Login.jsx';

const Dashboard = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const Portal = lazy(() => import('./pages/portal/PortalPage.jsx'));
const Agenda = lazy(() => import('./pages/agenda/AgendaPage.jsx'));
const Reservations = lazy(() => import('./pages/reservations/ReservationsPage.jsx'));
const Clients = lazy(() => import('./pages/clients/ClientsPage.jsx'));
const ClientDetail = lazy(() => import('./pages/clients/ClientDetailPage.jsx'));
const Sales = lazy(() => import('./pages/finance/SalesPage.jsx'));
const SaleDetail = lazy(() => import('./pages/finance/SaleDetailPage.jsx'));
const Receivables = lazy(() => import('./pages/finance/ReceivablesPage.jsx'));
const Expenses = lazy(() => import('./pages/finance/ExpensesPage.jsx'));
const Reports = lazy(() => import('./pages/reports/ReportsPage.jsx'));
const Catalog = lazy(() => import('./pages/catalog/CatalogPage.jsx'));
const Facilities = lazy(() => import('./pages/facilities/FacilitiesPage.jsx'));
const Instructors = lazy(() => import('./pages/instructors/InstructorsPage.jsx'));
const Audit = lazy(() => import('./pages/admin/AuditPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="min-h-screen" label="Carregando sessão…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

/** Bloqueia a rota no frontend (a API também valida cada permissão). */
function Guard({ perms, children }) {
  const { can } = useAuth();
  if (!can(...perms)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta área. Fale com o administrador se precisar de acesso."
        action={<Button to="/">Voltar ao início</Button>}
      />
    );
  }
  return children;
}

function Home() {
  const { user, can } = useAuth();
  if (user.role === 'instrutor' || !can('dashboard:view')) return <Navigate to="/portal" replace />;
  return <Dashboard />;
}

const page = (perms, element) => (
  <Guard perms={perms}>
    <Suspense fallback={<Spinner />}>{element}</Suspense>
  </Guard>
);

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Suspense fallback={<Spinner />}><Home /></Suspense>} />
              <Route path="portal" element={page(['portal:view'], <Portal />)} />
              <Route path="agenda" element={page(['appointments:view'], <Agenda />)} />
              <Route path="reservas" element={page(['reservations:view'], <Reservations />)} />
              <Route path="clientes" element={page(['clients:view'], <Clients />)} />
              <Route path="clientes/:id" element={page(['clients:view'], <ClientDetail />)} />
              <Route path="financeiro/vendas" element={page(['sales:view'], <Sales />)} />
              <Route path="financeiro/vendas/:id" element={page(['sales:view'], <SaleDetail />)} />
              <Route path="financeiro/contas-a-receber" element={page(['finance:view'], <Receivables />)} />
              <Route path="financeiro/despesas" element={page(['expenses:view'], <Expenses />)} />
              <Route path="relatorios" element={page(['reports:financial', 'reports:operational'], <Reports />)} />
              <Route path="catalogo" element={page(['catalog:view'], <Catalog />)} />
              <Route path="salas" element={page(['rooms:view'], <Facilities />)} />
              <Route path="instrutores" element={page(['instructors:view'], <Instructors />)} />
              <Route path="auditoria" element={page(['audit:view'], <Audit />)} />
              <Route path="configuracoes" element={page(['settings:manage'], <SettingsPage />)} />
              <Route
                path="*"
                element={<EmptyState title="Página não encontrada" description="O endereço acessado não existe." action={<Button to="/">Voltar ao início</Button>} />}
              />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
