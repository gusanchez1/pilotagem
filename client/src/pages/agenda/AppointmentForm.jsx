import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock, Loader2, Lock, Wrench } from 'lucide-react';
import { ClientFormModal } from '../../components/ClientFormModal.jsx';
import {
  Button,
  Callout,
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
import { addMinutesToTime, diffMinutes, toDateKey, toTimeKey, zonedISO } from '../../utils/dates.js';
import { date, minutesLabel, money } from '../../utils/format.js';
import { ORIGIN, PAYMENT_METHOD, options } from '../../utils/labels.js';

const overlaps = (a1, a2, b1, b2) => new Date(a1) < new Date(b2) && new Date(b1) < new Date(a2);

function priceFor(service, quantity) {
  if (!service) return 0;
  if (service.pricingMode === 'por_quantidade') return service.priceTiers.find((t) => t.quantity === quantity)?.price ?? 0;
  return service.basePrice;
}

function requiredSims(service, quantity) {
  const req = service?.requiredResources?.find((r) => r.category === 'simulador');
  if (!req) return 0;
  return service.pricingMode === 'por_quantidade' ? Math.max(req.quantity, quantity) : req.quantity;
}

const emptyForm = (date, time) => ({
  client: null,
  service: '',
  package: '',
  sale: '',
  quantity: 1,
  date: date || toDateKey(),
  startTime: time || '10:00',
  endTime: addMinutesToTime(time || '10:00', 60),
  instructor: '',
  room: '',
  resources: [],
  contractedAmount: 0,
  origin: 'recepcao',
  status: 'agendado',
  notes: '',
  createSale: true,
  payNow: false,
  payMethod: 'pix',
  payAmount: 0,
});

/**
 * Formulário de agendamento com verificação de disponibilidade ao vivo
 * (instrutor, sala e cada equipamento individualmente).
 */
export function AppointmentForm({ open, onClose, appointment, defaults, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const catalog = useCatalog({ include: ['services', 'packages', 'instructors', 'rooms', 'resources'] });
  const editing = Boolean(appointment?._id);
  const [f, setF] = useState(() => emptyForm());
  const [timeline, setTimeline] = useState(null);
  const [check, setCheck] = useState({ state: 'idle', conflicts: [] });
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState(null);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  // Inicialização
  useEffect(() => {
    if (!open) return;
    if (appointment?._id) {
      setF({
        ...emptyForm(),
        client: appointment.client,
        service: appointment.service?._id || '',
        package: appointment.package?._id || '',
        quantity: appointment.quantity || 1,
        date: toDateKey(appointment.start),
        startTime: toTimeKey(appointment.start),
        endTime: toTimeKey(appointment.end),
        instructor: appointment.instructor?._id || '',
        room: appointment.room?._id || '',
        resources: (appointment.resources || []).map((r) => r._id),
        contractedAmount: appointment.contractedAmount ?? 0,
        origin: appointment.origin,
        status: appointment.status,
        notes: appointment.notes || '',
        createSale: false,
      });
    } else {
      setF({ ...emptyForm(defaults?.date, defaults?.time), client: defaults?.client || null });
    }
    setCheck({ state: 'idle', conflicts: [] });
  }, [open, appointment, defaults]);

  const service = catalog.services.find((s) => s._id === f.service);
  const activeServices = catalog.services.filter((s) => s.active || s._id === f.service);
  const pkgOptions = catalog.packages.filter((p) => p.active && p.items.some((it) => (it.service?._id || it.service) === f.service));
  const compatibleRooms = service?.compatibleRooms?.length
    ? catalog.rooms.filter((r) => service.compatibleRooms.some((c) => (c._id || c) === r._id))
    : catalog.rooms;
  const start = zonedISO(f.date, f.startTime);
  const end = zonedISO(f.date, f.endTime);
  const validInterval = f.endTime > f.startTime;

  // Ocupação do dia (para indicar equipamentos livres antes da verificação oficial)
  useEffect(() => {
    if (!open || !f.date) return;
    api.get('/availability/timeline', { params: { date: f.date } }).then((r) => setTimeline(r.data)).catch(() => setTimeline(null));
  }, [open, f.date]);

  // Vendas do pacote selecionado para este cliente (para vincular a sessão)
  const [packageSales, setPackageSales] = useState([]);
  useEffect(() => {
    if (!open || !f.package || !f.client?._id || !can('sales:view')) {
      setPackageSales([]);
      return;
    }
    api
      .get('/sales', { params: { client: f.client._id, status: 'ativa', limit: 50 } })
      .then((r) => {
        const list = r.data.items.filter((s) => s.items.some((it) => String(it.package) === f.package));
        setPackageSales(list);
        if (list.length === 1) setF((prev) => ({ ...prev, sale: prev.sale || list[0]._id }));
      })
      .catch(() => setPackageSales([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f.package, f.client?._id]);

  const busyResource = useMemo(() => {
    const map = {};
    if (!timeline || !validInterval) return map;
    for (const r of timeline.resources) {
      const hit = r.bookings.find((b) => b.appointment !== appointment?._id && overlaps(start, end, b.start, b.end));
      if (hit) map[r._id] = hit;
    }
    return map;
  }, [timeline, start, end, validInterval, appointment]);

  const roomResources = catalog.resources.filter((r) => !f.room || String(r.room?._id || r.room) === f.room);
  const otherResources = catalog.resources.filter((r) => f.room && String(r.room?._id || r.room) !== f.room);

  function autoPickResources(svc, quantity, roomId) {
    const need = requiredSims(svc, quantity);
    if (!need) return [];
    const pool = catalog.resources.filter(
      (r) => r.category === 'simulador' && r.status === 'disponivel' && !busyResource[r._id] && (!roomId || String(r.room?._id || r.room) === roomId),
    );
    return pool.slice(0, need).map((r) => r._id);
  }

  const onServiceChange = (id) => {
    const svc = catalog.services.find((s) => s._id === id);
    const duration = svc?.durationMinutes || 120;
    const roomId = svc?.compatibleRooms?.length ? svc.compatibleRooms[0]._id || svc.compatibleRooms[0] : '';
    const quantity = 1;
    set({
      service: id,
      package: '',
      quantity,
      endTime: addMinutesToTime(f.startTime, duration),
      room: svc?.requiresRoom ? roomId : '',
      instructor: svc?.requiresInstructor ? f.instructor : '',
      resources: autoPickResources(svc, quantity, svc?.requiresRoom ? roomId : ''),
      contractedAmount: priceFor(svc, quantity),
    });
  };

  const onQuantityChange = (q) =>
    set({ quantity: q, resources: autoPickResources(service, q, f.room), contractedAmount: f.package ? 0 : priceFor(service, q) });

  const onStartChange = (t) => {
    const duration = validInterval ? diffMinutes(start, end) : service?.durationMinutes || 60;
    set({ startTime: t, endTime: addMinutesToTime(t, duration) });
  };

  // Verificação oficial de disponibilidade (servidor), com debounce
  const checkKey = useDebounce(JSON.stringify([start, end, f.instructor, f.room, f.resources]), 350);
  useEffect(() => {
    if (!open || !validInterval || (!f.instructor && !f.room && !f.resources.length)) {
      setCheck({ state: 'idle', conflicts: [] });
      return;
    }
    let cancelled = false;
    setCheck((c) => ({ ...c, state: 'checking' }));
    api
      .post('/availability/check', {
        start,
        end,
        instructor: f.instructor || null,
        rooms: f.room ? [f.room] : [],
        resources: f.resources,
        excludeAppointment: appointment?._id || null,
        excludeReservation: appointment?.reservation?._id || appointment?.reservation || null,
      })
      .then((r) => !cancelled && setCheck({ state: r.data.available ? 'ok' : 'conflict', conflicts: r.data.conflicts }))
      .catch(() => !cancelled && setCheck({ state: 'idle', conflicts: [] }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey, open]);

  const conflictFor = (type, id) => check.conflicts.find((c) => c.type === type && c.id === id);
  const need = requiredSims(service, f.quantity);
  const selectedSims = catalog.resources.filter((r) => f.resources.includes(r._id) && r.category === 'simulador').length;

  const errors = [];
  if (!f.client) errors.push('Selecione o cliente.');
  if (!f.service) errors.push('Selecione o serviço.');
  if (!validInterval) errors.push('O término deve ser após o início.');
  if (service?.requiresInstructor && !f.instructor) errors.push('Este serviço exige instrutor.');
  if (service?.requiresRoom && !f.room) errors.push('Selecione a sala.');
  if (need > selectedSims) errors.push(`Selecione ${need} simulador(es).`);

  const submit = async () => {
    if (errors.length) return toast.error(errors[0]);
    setSaving(true);
    const body = {
      client: f.client._id,
      service: f.service,
      package: f.package || null,
      instructor: f.instructor || null,
      room: f.room || null,
      resources: f.resources,
      quantity: f.quantity,
      start,
      end,
      contractedAmount: f.contractedAmount,
      origin: f.origin,
      notes: f.notes,
    };
    try {
      let data;
      if (editing) {
        ({ data } = await api.patch(`/appointments/${appointment._id}`, body));
        toast.success('Agendamento atualizado.', data.code);
      } else {
        const sale = f.createSale && !f.package && f.contractedAmount > 0 && can('sales:manage');
        ({ data } = await api.post('/appointments', {
          ...body,
          status: f.status,
          sale: f.package && f.sale ? f.sale : null,
          createSale: sale,
          initialPayment:
            sale && f.payNow && f.payAmount > 0 ? { method: f.payMethod, amount: f.payAmount, receiveNow: true } : undefined,
        }));
        toast.success('Agendamento confirmado na agenda.', `${data.code}${data.sale ? ` · venda ${data.sale.code}` : ''}`);
      }
      onSaved?.(data);
      onClose();
    } catch (err) {
      const details = errorDetails(err);
      if (details?.conflicts) setCheck({ state: 'conflict', conflicts: details.conflicts });
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const ResourceChip = ({ r }) => {
    const selected = f.resources.includes(r._id);
    const conflict = conflictFor('resource', r._id);
    const unavailable = r.status !== 'disponivel';
    const busy = !selected && busyResource[r._id];
    return (
      <button
        type="button"
        disabled={unavailable}
        onClick={() => set({ resources: selected ? f.resources.filter((x) => x !== r._id) : [...f.resources, r._id] })}
        title={unavailable ? 'Em manutenção / inativo' : busy ? `Ocupado: ${busy.title}` : r.name}
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          selected && !conflict && 'border-zinc-900 bg-zinc-900 text-white',
          selected && conflict && 'border-red-500 bg-red-50 text-red-700',
          !selected && !unavailable && !busy && 'border-line-strong bg-white text-zinc-700 hover:border-zinc-400',
          !selected && busy && 'border-dashed border-amber-300 bg-amber-50/60 text-amber-800',
          unavailable && 'cursor-not-allowed border-line bg-zinc-50 text-zinc-400 line-through',
        )}
      >
        {unavailable && <Wrench className="size-3" />}
        {busy && <Clock className="size-3" />}
        {r.code}
      </button>
    );
  };

  const checkPanel = (
    <div className="rounded-lg border border-line bg-zinc-50/60 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Disponibilidade</p>
      {check.state === 'idle' && <p className="text-sm text-zinc-500">Selecione horário, instrutor, sala e equipamentos para verificar.</p>}
      {check.state === 'checking' && (
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="size-4 animate-spin" /> Verificando…
        </p>
      )}
      {check.state === 'ok' && (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-4" /> Instrutor, sala e equipamentos disponíveis.
        </p>
      )}
      {check.state === 'conflict' && (
        <ul className="space-y-2">
          {check.conflicts.map((c, i) => (
            <li key={i} className="flex gap-2 text-sm text-red-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
              {c.message}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
        <div className="flex justify-between text-zinc-500">
          <span>Duração</span>
          <span className="tabular text-zinc-900">{validInterval ? minutesLabel(diffMinutes(start, end)) : '—'}</span>
        </div>
        {service && (
          <div className="flex justify-between text-zinc-500">
            <span>Preço de referência</span>
            <span className="tabular text-zinc-900">{money(priceFor(service, f.quantity))}</span>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <span>Valor contratado</span>
          <span className="tabular">{f.package ? 'Incluso no pacote' : money(f.contractedAmount)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title={editing ? `Editar / remanejar ${appointment.code}` : 'Novo agendamento'}
        description="A disponibilidade de instrutor, sala e cada equipamento é verificada antes de salvar."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={check.state === 'conflict'}>
              {editing ? 'Salvar alterações' : 'Confirmar agendamento'}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Field label="Cliente" required>
              <ClientPicker value={f.client} onChange={(c) => set({ client: c })} onCreateNew={can('clients:manage') ? (q) => setNewClient(q || ' ') : undefined} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Serviço" required>
                <Select value={f.service} onChange={(e) => onServiceChange(e.target.value)} placeholder="Selecione…" options={activeServices.map((s) => ({ value: s._id, label: s.name }))} />
              </Field>
              <Field label="Pacote" hint={pkgOptions.length ? 'Use quando a sessão faz parte de um pacote' : 'Nenhum pacote inclui este serviço'}>
                <Select
                  value={f.package}
                  disabled={!pkgOptions.length}
                  onChange={(e) => set({ package: e.target.value, sale: '', contractedAmount: e.target.value ? 0 : priceFor(service, f.quantity) })}
                  placeholder="Sessão avulsa"
                  options={pkgOptions.map((p) => ({ value: p._id, label: p.name }))}
                />
              </Field>
            </div>

            {f.package && !editing && can('sales:view') && (
              <Field
                label="Venda do pacote"
                hint={packageSales.length ? 'Vincula esta sessão à venda já registrada do pacote.' : 'Nenhuma venda deste pacote para o cliente. Registre a venda do pacote em Financeiro › Vendas.'}
              >
                <Select
                  value={f.sale}
                  onChange={(e) => set({ sale: e.target.value })}
                  placeholder={packageSales.length ? 'Selecione a venda…' : 'Sem venda vinculada'}
                  disabled={!packageSales.length}
                  options={packageSales.map((s) => ({ value: s._id, label: `${s.code} · ${date(s.saleDate)} · ${s.appointments.length} sessão(ões) agendada(s)` }))}
                />
              </Field>
            )}

            {service?.pricingMode === 'por_quantidade' && (
              <Field label={`Quantidade de ${service.quantityLabel}es`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {service.priceTiers.map((t) => (
                    <button
                      key={t.quantity}
                      type="button"
                      onClick={() => onQuantityChange(t.quantity)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-left transition-colors',
                        f.quantity === t.quantity ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-line-strong bg-white hover:border-zinc-400',
                      )}
                    >
                      <p className="text-sm font-semibold">{t.label || `${t.quantity} ${service.quantityLabel}`}</p>
                      <p className={cn('text-xs tabular', f.quantity === t.quantity ? 'text-zinc-300' : 'text-zinc-500')}>{money(t.price)}</p>
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Data" required>
                <DateInput value={f.date} onChange={(v) => v && set({ date: v })}/>
              </Field>
              <Field label="Início" required>
                <TimeInput value={f.startTime} onChange={(v) => v && onStartChange(v)}/>
              </Field>
              <Field label="Término" required error={!validInterval ? 'Após o início' : undefined}>
                <TimeInput value={f.endTime} onChange={(v) => v && set({ endTime: v })}/>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Instrutor${service?.requiresInstructor ? '' : ' (opcional)'}`} required={service?.requiresInstructor} error={conflictFor('instructor', f.instructor)?.message}>
                <Select
                  value={f.instructor}
                  onChange={(e) => set({ instructor: e.target.value })}
                  placeholder={service?.requiresInstructor ? 'Selecione…' : 'Sem instrutor'}
                  options={catalog.instructors.filter((i) => i.active || i._id === f.instructor).map((i) => ({ value: i._id, label: `${i.name} — ${i.specialty}` }))}
                  invalid={Boolean(conflictFor('instructor', f.instructor))}
                />
              </Field>
              <Field label={`Sala${service?.requiresRoom ? '' : ' (opcional)'}`} required={service?.requiresRoom} error={conflictFor('room', f.room)?.message}>
                <Select
                  value={f.room}
                  onChange={(e) => set({ room: e.target.value, resources: autoPickResources(service, f.quantity, e.target.value) })}
                  placeholder="Sem sala"
                  options={compatibleRooms.map((r) => ({ value: r._id, label: `${r.name}${r.shared ? ' · compartilhada' : ''}`, disabled: r.status !== 'ativa' }))}
                  invalid={Boolean(conflictFor('room', f.room))}
                />
              </Field>
            </div>

            <Field
              label="Equipamentos e simuladores"
              hint={need ? `Este serviço requer ${need} simulador(es) — ${selectedSims} selecionado(s).` : 'Opcional. Tracejado = ocupado no horário.'}
            >
              <div className="flex flex-wrap gap-1.5">
                {roomResources.map((r) => (
                  <ResourceChip key={r._id} r={r} />
                ))}
              </div>
              {f.room && otherResources.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800">Equipamentos de outras salas</summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {otherResources.map((r) => (
                      <ResourceChip key={r._id} r={r} />
                    ))}
                  </div>
                </details>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Valor contratado">
                <MoneyInput value={f.contractedAmount} onChange={(v) => set({ contractedAmount: v })} disabled={Boolean(f.package)} />
              </Field>
              <Field label="Origem">
                <Select value={f.origin} onChange={(e) => set({ origin: e.target.value })} options={options(ORIGIN)} />
              </Field>
              {!editing && (
                <Field label="Status inicial">
                  <Select
                    value={f.status}
                    onChange={(e) => set({ status: e.target.value })}
                    options={[
                      { value: 'solicitado', label: 'Solicitado' },
                      { value: 'agendado', label: 'Agendado' },
                      { value: 'confirmado', label: 'Confirmado' },
                    ]}
                  />
                </Field>
              )}
            </div>

            <Field label="Observações" hint="Visíveis para o instrutor no portal.">
              <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
            </Field>

            {!editing && can('sales:manage') && !f.package && (
              <div className="space-y-3 rounded-lg border border-line p-4">
                <Checkbox
                  checked={f.createSale}
                  onChange={(v) => set({ createSale: v })}
                  label="Registrar venda vinculada no financeiro"
                  description="Cria a venda com o valor contratado (preço fica registrado no histórico)."
                />
                {f.createSale && (
                  <>
                    <Checkbox
                      checked={f.payNow}
                      onChange={(v) => set({ payNow: v, payAmount: v ? f.contractedAmount : 0 })}
                      label="Pagamento recebido agora"
                      description="Ex.: Pix ou dinheiro antecipado. Parcelamentos podem ser lançados depois na venda."
                    />
                    {f.payNow && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Forma">
                          <Select value={f.payMethod} onChange={(e) => set({ payMethod: e.target.value })} options={options(PAYMENT_METHOD).filter((o) => o.value !== 'cartao_credito' && o.value !== 'boleto')} />
                        </Field>
                        <Field label="Valor recebido">
                          <MoneyInput value={f.payAmount} onChange={(v) => set({ payAmount: Math.min(v, f.contractedAmount) })} />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            {checkPanel}
            {f.client?.confidential && (
              <Callout tone="neutral" icon={Lock}>
                Cliente confidencial: a agenda exibirá apenas o nome de exibição.
              </Callout>
            )}
            {editing && (
              <Callout tone="info">Alterar data, horário, instrutor, sala ou equipamentos registra um remanejamento na auditoria.</Callout>
            )}
          </div>
        </div>
      </Modal>

      <ClientFormModal
        open={newClient !== null}
        initialName={newClient?.trim() || ''}
        onClose={() => setNewClient(null)}
        onSaved={(c) => set({ client: c })}
      />
    </>
  );
}
