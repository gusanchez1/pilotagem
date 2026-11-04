import { useEffect, useState } from 'react';
import { DatabaseBackup, KeyRound, Pencil, Plus, ShieldCheck, SlidersHorizontal, UserCog } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Toggle,
  TimeInput,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { dateTime } from '../../utils/format.js';
import { ROLE } from '../../utils/labels.js';

const ROLE_DESCRIPTION = {
  admin: 'Acesso completo, usuários, auditoria e configurações.',
  recepcao: 'Clientes, agenda, reservas e, se autorizado, vendas e pagamentos.',
  financeiro: 'Vendas, pagamentos, contas a receber, despesas e relatórios financeiros.',
  instrutor: 'Somente a própria agenda e as sessões, sem dados financeiros.',
};

function UserForm({ open, onClose, user, instructors, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    if (open) setF(user ? { name: user.name, email: user.email, role: user.role, instructor: user.instructor?._id || '', active: user.active } : { name: '', email: '', role: 'recepcao', instructor: '', password: '', active: true });
  }, [open, user]);
  const submit = async () => {
    setBusy(true);
    const payload = { name: f.name, email: f.email, role: f.role, instructor: f.role === 'instrutor' ? f.instructor || null : null, active: f.active };
    try {
      if (user) await api.patch(`/users/${user._id}`, payload);
      else await api.post('/users', { ...payload, password: f.password });
      toast.success('Usuário salvo.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={user ? 'Editar usuário' : 'Novo usuário'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        <Field label="Nome" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="E-mail de acesso" required><Input type="email" value={f.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
        {!user && <Field label="Senha inicial" required hint="Mínimo de 8 caracteres. O usuário pode alterá-la depois."><Input type="password" value={f.password || ''} onChange={(e) => set({ password: e.target.value })} /></Field>}
        <Field label="Perfil" hint={ROLE_DESCRIPTION[f.role]}>
          <Select value={f.role} onChange={(e) => set({ role: e.target.value })} options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} />
        </Field>
        {f.role === 'instrutor' && (
          <Field label="Instrutor vinculado" required>
            <Select value={f.instructor} onChange={(e) => set({ instructor: e.target.value })} placeholder="Selecione…" options={instructors.map((i) => ({ value: i._id, label: i.name }))} />
          </Field>
        )}
        {user && <Toggle checked={Boolean(f.active)} onChange={(v) => set({ active: v })} label="Usuário ativo" description="Usuários inativos perdem o acesso imediatamente." />}
      </div>
    </Modal>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const users = useApi('/users', { initial: [] });
  const instructors = useApi('/instructors', { initial: [] });
  const [form, setForm] = useState({ open: false });
  const [resetting, setResetting] = useState(null);
  const [pwd, setPwd] = useState('');

  const columns = [
    { key: 'name', header: 'Usuário', render: (u) => <div><p className="font-medium text-zinc-900">{u.name}{u._id === me._id && <span className="ml-1.5 text-xs text-zinc-400">(você)</span>}</p><p className="text-xs text-zinc-500">{u.email}</p></div> },
    { key: 'role', header: 'Perfil', render: (u) => <Badge tone={{ admin: 'violet', recepcao: 'blue', financeiro: 'teal', instrutor: 'amber' }[u.role]}>{ROLE[u.role]}</Badge> },
    { key: 'inst', header: 'Instrutor', hideOn: 'md', render: (u) => u.instructor?.name || '—' },
    { key: 'last', header: 'Último acesso', hideOn: 'lg', render: (u) => <span className="tabular text-zinc-500">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Nunca'}</span> },
    { key: 'active', header: 'Situação', render: (u) => (u.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="zinc">Inativo</Badge>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, user: u })} aria-label="Editar"><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setPwd(''); setResetting(u); }} aria-label="Redefinir senha"><KeyRound className="size-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end"><Button variant="primary" icon={Plus} onClick={() => setForm({ open: true })}>Novo usuário</Button></div>
      <Card><DataTable columns={columns} rows={users.data} loading={users.loading} /></Card>
      <UserForm open={form.open} user={form.user} instructors={instructors.data} onClose={() => setForm({ open: false })} onSaved={users.reload} />
      <Modal
        open={Boolean(resetting)}
        onClose={() => setResetting(null)}
        size="sm"
        title="Redefinir senha"
        description={resetting?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetting(null)}>Cancelar</Button>
            <Button
              variant="dark"
              onClick={async () => {
                try {
                  await api.post(`/users/${resetting._id}/reset-password`, { password: pwd });
                  toast.success('Senha redefinida.', 'As sessões abertas desse usuário foram encerradas.');
                  setResetting(null);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              Redefinir
            </Button>
          </>
        }
      >
        <Field label="Nova senha" hint="Mínimo de 8 caracteres."><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

function SystemTab() {
  const toast = useToast();
  const { refresh, logout } = useAuth();
  const { data, setData } = useApi("/settings");
  const [confirm, setConfirm] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = async (patch) => {
    try {
      const { data: next } = await api.patch('/settings', patch);
      setData({ ...data, ...next });
      await refresh();
      toast.success('Configuração salva.', 'Permissões aplicadas imediatamente pela API.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!data) return <Spinner />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Autorizações por perfil" icon={ShieldCheck} description="Regras aplicadas no backend — não apenas escondidas na interface." />
        <div className="space-y-5 p-5">
          <Toggle checked={data.receptionCanManageSales} onChange={(v) => update({ receptionCanManageSales: v })} label="Recepção pode registrar vendas e pagamentos" description="Quando desativado, a recepção apenas consulta a situação financeira das vendas." />
          <Toggle checked={data.instructorsCanUpdateStatus} onChange={(v) => update({ instructorsCanUpdateStatus: v })} label="Instrutores podem atualizar o status das sessões" description="Iniciar, concluir ou registrar ausência nos próprios treinamentos." />
        </div>
      </Card>
      <Card>
        <CardHeader title="Funcionamento" icon={SlidersHorizontal} description="Usado no cálculo de ocupação das salas." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Abertura"><TimeInput value={data.businessHoursStart} onChange={(v) => update({ businessHoursStart: v })} /></Field>
          <Field label="Fechamento"><TimeInput value={data.businessHoursEnd} onChange={(v) => update({ businessHoursEnd: v })} /></Field>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Dados de demonstração" icon={DatabaseBackup} description="Restaura o banco para o estado inicial da apresentação." />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-zinc-600">
            Apaga <strong>todos</strong> os dados atuais e recria clientes, agenda, vendas e despesas fictícios com datas relativas a hoje.
            Também disponível no terminal com <code className="rounded bg-zinc-100 px-1">npm run seed</code>.
          </p>
          <Button variant="danger" disabled={!data.allowDemoReset} onClick={() => { setConfirm(''); setResetOpen(true); }}>Restaurar dados de demonstração</Button>
        </div>
        {!data.allowDemoReset && <Callout tone="neutral" className="mx-5 mb-5">Desativado por configuração (ALLOW_DEMO_RESET=false).</Callout>}
      </Card>
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="sm"
        title="Restaurar dados de demonstração?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              variant="dangerSolid"
              loading={busy}
              disabled={confirm !== 'RESTAURAR'}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/admin/demo-reset', { confirm: 'RESTAURAR' });
                  toast.success('Dados restaurados.', 'Entre novamente com as contas de demonstração.');
                  logout();
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Apagar e restaurar
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">Esta ação não pode ser desfeita. Digite <strong>RESTAURAR</strong> para confirmar.</p>
        <Input className="mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESTAURAR" />
      </Modal>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('sistema');
  return (
    <>
      <PageHeader title="Configurações" description="Usuários, permissões e preferências do sistema." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'sistema', label: 'Sistema e permissões', icon: SlidersHorizontal }, { value: 'usuarios', label: 'Usuários', icon: UserCog }]} />
      {tab === 'sistema' ? <SystemTab /> : <UsersTab />}
    </>
  );
}
