import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ArrowRight, CalendarCheck2, Eye, EyeOff, LineChart, ShieldCheck } from 'lucide-react';
import symbol from '../assets/brand/simbolo-amarelo.png';
import { Brand } from '../components/Brand.jsx';
import { Button, Callout, Field, Input } from '../components/ui/index.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

const DEMO = [
  { label: 'Administrador', email: 'admin@pilotagem.local', password: 'Admin@123' },
  { label: 'Recepção', email: 'recepcao1@pilotagem.local', password: 'Recepcao@123' },
  { label: 'Financeiro', email: 'financeiro@pilotagem.local', password: 'Financeiro@123' },
  { label: 'Instrutor', email: 'instrutor1@pilotagem.local', password: 'Instrutor@123' },
];

const showDemo = import.meta.env.VITE_SHOW_DEMO_LOGINS !== 'false';

export default function Login() {
  const { user, login, expired } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || (user.role === 'instrutor' ? '/portal' : '/')} replace />;

  const submit = async (e, creds) => {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    if (!em || !pw) return setError('Informe e-mail e senha.');
    setBusy(true);
    setError('');
    try {
      await login(em, pw);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível entrar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* Painel da marca */}
      <section className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img src={symbol} alt="" aria-hidden className="pointer-events-none absolute -right-24 bottom-[-6%] w-[640px] max-w-none opacity-[0.07]" />
        <div className="absolute left-0 top-0 h-1 w-40 origin-left skew-mark bg-brand" aria-hidden />
        <Brand size="lg" tagline="Gestão financeira e operacional" />
        <div className="relative max-w-md">
          <h1 className="font-display text-[40px] font-semibold italic leading-[1.05] tracking-tight text-white">
            Toda a operação da academia em uma única pista.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
            Agenda, salas, simuladores, instrutores, vendas e recebimentos centralizados — sem planilhas paralelas e sem
            conflitos de horário.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-zinc-300">
            <li className="flex items-center gap-3"><CalendarCheck2 className="size-4 text-brand" /> Disponibilidade validada em tempo real</li>
            <li className="flex items-center gap-3"><LineChart className="size-4 text-brand" /> Contratado, recebido e pendente sempre separados</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-brand" /> Clientes confidenciais protegidos e auditados</li>
          </ul>
        </div>
        <p className="relative text-xs text-zinc-600">Desenvolvido para a Pilotech · MVP acadêmico</p>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 rounded-lg bg-ink p-3 lg:hidden">
            <Brand />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Entrar</h2>
          <p className="mt-1 text-sm text-zinc-500">Acesse com sua conta de funcionário.</p>

          {expired && (
            <Callout tone="warning" className="mt-5">
              Sua sessão expirou. Entre novamente para continuar.
            </Callout>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="E-mail" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@pilotagem.local" />
            </Field>
            <Field label="Senha" htmlFor="password" error={error}>
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" variant="primary" className="w-full justify-center" loading={busy}>
              Entrar <ArrowRight className="size-4" />
            </Button>
          </form>

          {showDemo && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-3 text-xs text-zinc-400">
                <span className="h-px flex-1 bg-line" /> Acesso rápido — demonstração <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                      submit(null, d);
                    }}
                    className="rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <p className="text-[13px] font-medium text-zinc-900">{d.label}</p>
                    <p className="truncate text-[11px] text-zinc-500">{d.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
