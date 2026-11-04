import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { CalendarPlus, ChevronDown, HandCoins, KeyRound, LogOut, Menu as MenuIcon, Plus, UserPlus, X } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { ChangePasswordModal } from '../components/ChangePasswordModal.jsx';
import { Button, Menu, cn } from '../components/ui/index.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { capitalize, initials, longDate } from '../utils/format.js';
import { ROLE } from '../utils/labels.js';
import { NAVIGATION } from './navigation.js';

function Sidebar({ onNavigate }) {
  const { can, user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-ink text-zinc-400">
      <div className="flex h-14 items-center px-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2 scroll-thin" aria-label="Menu principal">
        {NAVIGATION.map((group) => {
          const items = group.items.filter((i) => can(...i.perms));
          if (!items.length) return null;
          return (
            <div key={group.section || 'main'}>
              {group.section && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{group.section}</p>}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors',
                          isActive ? 'bg-white/[0.07] text-white' : 'hover:bg-white/[0.04] hover:text-zinc-200',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute -left-3 top-1.5 h-5 w-[3px] skew-mark rounded-sm bg-brand" aria-hidden />}
                          <item.icon className={cn('size-4', isActive ? 'text-brand' : 'text-zinc-500 group-hover:text-zinc-300')} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200">{initials(user?.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-zinc-200">{user?.name}</p>
            <p className="text-[11px] text-zinc-500">{ROLE[user?.role]}</p>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200" title="Sair" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ onOpenMenu, onChangePassword }) {
  const { can, user, logout } = useAuth();
  const navigate = useNavigate();
  const quick = [
    { label: 'Novo agendamento', icon: CalendarPlus, onClick: () => navigate('/agenda?novo=1'), hidden: !can('appointments:manage') },
    { label: 'Nova venda', icon: HandCoins, onClick: () => navigate('/financeiro/vendas?nova=1'), hidden: !can('sales:manage') },
    { label: 'Novo cliente', icon: UserPlus, onClick: () => navigate('/clientes?novo=1'), hidden: !can('clients:manage') },
  ];
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6">
      <button onClick={onOpenMenu} className="-ml-1 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200/60 lg:hidden" aria-label="Abrir menu">
        <MenuIcon className="size-5" />
      </button>
      <p className="hidden text-[13px] text-zinc-500 sm:block">{capitalize(longDate(new Date()))}</p>
      <div className="ml-auto flex items-center gap-2">
        <Menu trigger={<Button variant="primary" size="sm" icon={Plus}>Novo</Button>} items={quick} />
        <Menu
          trigger={
            <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-zinc-200/60" aria-label="Menu do usuário">
              <span className="flex size-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{initials(user?.name)}</span>
              <ChevronDown className="size-3.5 text-zinc-500" />
            </button>
          }
          items={[
            { label: 'Alterar senha', icon: KeyRound, onClick: onChangePassword },
            { label: 'Sair', icon: LogOut, onClick: logout, danger: true },
          ]}
        />
      </div>
    </header>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64 animate-slide-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button onClick={() => setMobileOpen(false)} className="absolute right-2 top-3 rounded-md p-1.5 text-zinc-400 hover:text-white" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <Header onOpenMenu={() => setMobileOpen(true)} onChangePassword={() => setPwdOpen(true)} />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}
