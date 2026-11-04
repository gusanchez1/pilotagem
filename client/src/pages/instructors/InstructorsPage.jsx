import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, Pencil, Phone, Plus, Power } from 'lucide-react';
import { AppointmentRow } from '../../components/AppointmentRow.jsx';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
  Toggle,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { addDays, toDateKey } from '../../utils/dates.js';
import { capitalize, longDate, phoneMask } from '../../utils/format.js';

function InstructorForm({ open, onClose, instructor, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    if (open) setF(instructor ? { ...instructor } : { name: '', phone: '', specialty: '', bio: '', notes: '', color: '#2563eb', active: true });
  }, [open, instructor]);
  const submit = async () => {
    setBusy(true);
    const payload = { name: f.name, phone: f.phone, specialty: f.specialty, bio: f.bio, notes: f.notes, color: f.color, active: f.active };
    try {
      if (instructor) await api.put(`/instructors/${instructor._id}`, payload);
      else await api.post('/instructors', payload);
      toast.success('Instrutor salvo.', instructor ? undefined : 'Crie um usuário com perfil Instrutor em Configurações para dar acesso ao portal.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={instructor ? 'Editar instrutor' : 'Novo instrutor'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Salvar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Telefone"><Input value={f.phone || ''} onChange={(e) => set({ phone: phoneMask(e.target.value) })} /></Field>
        <Field label="Especialidade"><Input value={f.specialty || ''} onChange={(e) => set({ specialty: e.target.value })} /></Field>
        <Field label="Cor na agenda">
          <input type="color" value={f.color || '#2563eb'} onChange={(e) => set({ color: e.target.value })} className="h-9 w-16 cursor-pointer rounded border border-line" />
        </Field>
        <Field label="Descrição profissional" className="sm:col-span-2"><Textarea rows={3} value={f.bio || ''} onChange={(e) => set({ bio: e.target.value })} /></Field>
        <Field label="Observações internas" className="sm:col-span-2"><Textarea rows={2} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <Toggle checked={Boolean(f.active)} onChange={(v) => set({ active: v })} label="Instrutor ativo" />
      </div>
    </Modal>
  );
}

function AgendaDrawer({ instructor, onClose }) {
  const navigate = useNavigate();
  const today = toDateKey();
  const { data, loading } = useApi(instructor ? `/instructors/${instructor._id}/agenda` : null, { params: { from: today, to: addDays(today, 13) } });
  const groups = {};
  for (const a of data || []) (groups[toDateKey(a.start)] ??= []).push(a);
  return (
    <Drawer open={Boolean(instructor)} onClose={onClose} subtitle="Agenda — próximos 14 dias" title={instructor?.name}>
      {loading && !data ? (
        <Spinner />
      ) : !Object.keys(groups).length ? (
        <EmptyState icon={CalendarDays} title="Sem treinamentos nos próximos 14 dias" description="Horários livres para novos agendamentos." />
      ) : (
        <div className="-mx-5 space-y-4">
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{capitalize(longDate(`${day}T15:00:00Z`))}</p>
              <div className="divide-y divide-line">
                {items.map((a) => <AppointmentRow key={a._id} appt={a} onClick={() => navigate(`/agenda?ag=${a._id}`)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

export default function InstructorsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi('/instructors', { initial: [] });
  const [form, setForm] = useState({ open: false });
  const [agendaOf, setAgendaOf] = useState(null);
  const admin = can('instructors:manage');

  const toggle = async (i) => {
    try {
      await api.patch(`/instructors/${i._id}/status`, { active: !i.active });
      toast.success(i.active ? 'Instrutor desativado.' : 'Instrutor ativado.');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Instrutores"
        description="Equipe técnica, especialidades e agenda individual. Um instrutor nunca recebe dois treinamentos no mesmo horário."
        actions={admin && <Button variant="primary" icon={Plus} onClick={() => setForm({ open: true })}>Novo instrutor</Button>}
      />
      {loading && !data.length ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((i) => (
            <Card key={i._id} className={i.active ? '' : 'opacity-60'}>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: i.color }}>
                    {i.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold text-zinc-950">{i.name}</h3>
                      {i.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="zinc">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-zinc-600">{i.specialty}</p>
                    {i.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500"><Phone className="size-3" />{i.phone}</p>}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-zinc-500">{i.bio}</p>
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <Button size="sm" variant="secondary" icon={CalendarDays} onClick={() => setAgendaOf(i)}>Ver agenda</Button>
                {admin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, instructor: i })} aria-label="Editar"><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => toggle(i)} aria-label="Ativar/desativar"><Power className="size-4" /></Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <InstructorForm open={form.open} instructor={form.instructor} onClose={() => setForm({ open: false })} onSaved={reload} />
      <AgendaDrawer instructor={agendaOf} onClose={() => setAgendaOf(null)} />
    </>
  );
}
