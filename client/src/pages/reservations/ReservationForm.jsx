import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, Wrench } from 'lucide-react';
import {
  Button,
  Checkbox,
  ClientPicker,
  Field,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  cn,
  DateInput,
  TimeInput,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useDebounce } from '../../hooks/useApi.js';
import { useCatalog } from '../../hooks/useCatalog.js';
import { api, errorDetails, errorMessage } from '../../services/api.js';
import { diffMinutes, toDateKey, toTimeKey, zonedISO } from '../../utils/dates.js';
import { money } from '../../utils/format.js';
import { USAGE_TYPE } from '../../utils/labels.js';

const USAGE_OPTIONS = Object.entries(USAGE_TYPE)
  .filter(([k]) => k !== 'treinamento')
  .map(([value, v]) => ({ value, label: v.label }));

/** Reserva avulsa (locação, evento, uso interno, manutenção) de uma ou várias salas e equipamentos. */
export function ReservationForm({ open, onClose, reservation, defaults, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const catalog = useCatalog({ include: ['rooms', 'resources'] });
  const editing = Boolean(reservation?._id);
  const [f, setF] = useState({});
  const [check, setCheck] = useState({ state: 'idle', conflicts: [] });
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setF({
        title: reservation.title,
        usageType: reservation.usageType,
        client: reservation.client,
        responsible: reservation.responsible,
        date: toDateKey(reservation.start),
        startTime: toTimeKey(reservation.start),
        endTime: toTimeKey(reservation.end),
        rooms: reservation.rooms.map((r) => r._id),
        resources: reservation.resources.map((r) => r._id),
        amount: reservation.amount || 0,
        notes: reservation.notes || '',
        createSale: false,
      });
    } else {
      setF({
        title: '',
        usageType: 'locacao',
        client: null,
        responsible: '',
        date: defaults?.date || toDateKey(),
        startTime: defaults?.time || '14:00',
        endTime: defaults?.endTime || '17:00',
        rooms: defaults?.room ? [defaults.room] : [],
        resources: defaults?.resource ? [defaults.resource] : [],
        amount: 0,
        notes: '',
        createSale: true,
      });
    }
    setCheck({ state: 'idle', conflicts: [] });
  }, [open, reservation, defaults]);

  const valid = f.endTime > f.startTime;
  const start = f.date ? zonedISO(f.date, f.startTime || '00:00') : null;
  const end = f.date ? zonedISO(f.date, f.endTime || '00:00') : null;
  const hours = valid ? diffMinutes(start, end) / 60 : 0;
  const suggested = useMemo(
    () => catalog.rooms.filter((r) => f.rooms?.includes(r._id)).reduce((a, r) => a + (r.hourlyRate || 0) * hours, 0),
    [catalog.rooms, f.rooms, hours],
  );

  const key = useDebounce(JSON.stringify([start, end, f.rooms, f.resources, f.usageType]), 350);
  useEffect(() => {
    if (!open || !valid || (!f.rooms?.length && !f.resources?.length)) {
      setCheck({ state: 'idle', conflicts: [] });
      return;
    }
    let cancel = false;
    setCheck((c) => ({ ...c, state: 'checking' }));
    api
      .post('/availability/check', { start, end, rooms: f.rooms, resources: f.resources, usageType: f.usageType, excludeReservation: reservation?._id || null })
      .then((r) => !cancel && setCheck({ state: r.data.available ? 'ok' : 'conflict', conflicts: r.data.conflicts }))
      .catch(() => !cancel && setCheck({ state: 'idle', conflicts: [] }));
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  const toggle = (field, id) => set({ [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id] });
  const conflictIds = new Set(check.conflicts.map((c) => c.id));

  const submit = async () => {
    if (!f.title?.trim()) return toast.error('Informe o título da reserva.');
    if (!f.rooms.length && !f.resources.length) return toast.error('Selecione ao menos uma sala ou um equipamento.');
    if (!valid) return toast.error('O término deve ser após o início.');
    setBusy(true);
    const body = {
      title: f.title,
      usageType: f.usageType,
      client: f.client?._id || null,
      responsible: f.responsible,
      rooms: f.rooms,
      resources: f.resources,
      start,
      end,
      amount: f.amount,
      notes: f.notes,
    };
    try {
      const { data } = editing
        ? await api.patch(`/reservations/${reservation._id}`, body)
        : await api.post('/reservations', { ...body, createSale: f.createSale && f.amount > 0 && can('sales:manage') });
      toast.success(editing ? 'Reserva atualizada.' : 'Reserva confirmada.', `${data.code}${data.sale ? ` · venda ${data.sale.code}` : ''}`);
      onSaved?.(data);
      onClose();
    } catch (err) {
      const details = errorDetails(err);
      if (details?.conflicts) setCheck({ state: 'conflict', conflicts: details.conflicts });
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open || !f.date) return null;
  const chip = (field, item, disabled) => (
    <button
      key={item._id}
      type="button"
      disabled={disabled}
      onClick={() => toggle(field, item._id)}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        f[field].includes(item._id)
          ? conflictIds.has(item._id)
            ? 'border-red-500 bg-red-50 text-red-700'
            : 'border-zinc-900 bg-zinc-900 text-white'
          : 'border-line-strong bg-white text-zinc-700 hover:border-zinc-400',
        disabled && 'cursor-not-allowed border-line bg-zinc-50 text-zinc-400 line-through',
      )}
      title={item.name}
    >
      {disabled && <Wrench className="size-3" />}
      {field === 'rooms' ? item.name : item.code}
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? `Editar reserva ${reservation.code}` : 'Nova reserva'}
      description="Locações, eventos, uso interno e manutenção. Treinamentos são reservados pela Agenda."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={check.state === 'conflict'}>
            {editing ? 'Salvar' : 'Confirmar reserva'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Título" required>
              <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Evento corporativo — equipe X" />
            </Field>
            <Field label="Tipo de utilização">
              <Select value={f.usageType} onChange={(e) => set({ usageType: e.target.value })} options={USAGE_OPTIONS} disabled={editing && reservation.usageType === 'treinamento'} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente (opcional)">
              <ClientPicker value={f.client} onChange={(c) => set({ client: c })} />
            </Field>
            <Field label="Responsável">
              <Input value={f.responsible} onChange={(e) => set({ responsible: e.target.value })} placeholder="Nome do responsável" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data" required>
              <DateInput value={f.date} onChange={(v) => v && set({ date: v })}/>
            </Field>
            <Field label="Início" required>
              <TimeInput value={f.startTime} onChange={(v) => v && set({ startTime: v })}/>
            </Field>
            <Field label="Término" required error={!valid ? 'Após o início' : undefined}>
              <TimeInput value={f.endTime} onChange={(v) => v && set({ endTime: v })}/>
            </Field>
          </div>
          <Field label="Salas" hint="Selecione uma ou várias salas.">
            <div className="flex flex-wrap gap-1.5">{catalog.rooms.map((r) => chip('rooms', r, r.status !== 'ativa'))}</div>
          </Field>
          <Field label="Equipamentos" hint="Simuladores e equipamentos são validados individualmente.">
            <div className="space-y-2">
              {catalog.rooms.map((room) => {
                const list = catalog.resources.filter((x) => String(x.room?._id || x.room) === room._id);
                if (!list.length) return null;
                return (
                  <div key={room._id} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-28 shrink-0 truncate text-[11px] text-zinc-500">{room.name}</span>
                    {list.map((x) => chip('resources', x, f.usageType !== 'manutencao' && x.status !== 'disponivel'))}
                  </div>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor" hint={suggested ? `Sugestão pela tabela de locação: ${money(suggested)}` : 'Deixe zero para uso interno/manutenção.'}>
              <MoneyInput value={f.amount} onChange={(v) => set({ amount: v })} />
            </Field>
            {suggested > 0 && f.amount !== suggested && (
              <div className="flex items-end pb-1">
                <Button size="sm" variant="ghost" onClick={() => set({ amount: Math.round(suggested) })}>Usar valor sugerido</Button>
              </div>
            )}
          </div>
          <Field label="Observações">
            <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
          </Field>
          {!editing && f.amount > 0 && can('sales:manage') && (
            <Checkbox checked={f.createSale} onChange={(v) => set({ createSale: v })} label="Registrar venda da locação/evento no financeiro" />
          )}
        </div>
        <div className="rounded-lg border border-line bg-zinc-50/60 p-4 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Disponibilidade</p>
          {check.state === 'idle' && <p className="text-sm text-zinc-500">Selecione salas ou equipamentos.</p>}
          {check.state === 'checking' && <p className="flex items-center gap-2 text-sm text-zinc-600"><Loader2 className="size-4 animate-spin" /> Verificando…</p>}
          {check.state === 'ok' && <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Tudo disponível.</p>}
          {check.state === 'conflict' && (
            <ul className="space-y-2">
              {check.conflicts.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-red-800"><CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />{c.message}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-zinc-500">
            Locação, evento e manutenção ocupam a sala inteira, inclusive salas de uso compartilhado.
          </p>
        </div>
      </div>
    </Modal>
  );
}
