import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, CheckCircle2, CirclePlay, Lock, Pencil, Receipt, UserX, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DescriptionList,
  Drawer,
  ErrorState,
  Spinner,
  StatusBadge,
  Textarea,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { api, errorMessage } from '../../services/api.js';
import { capitalize, dateTime, longDate, money, timeRange } from '../../utils/format.js';
import { APPOINTMENT_STATUS, APPOINTMENT_TRANSITIONS, ORIGIN, SALE_PAYMENT_STATUS } from '../../utils/labels.js';

const ACTIONS = {
  confirmado: { label: 'Confirmar', icon: CheckCircle2, variant: 'secondary' },
  agendado: { label: 'Voltar para agendado', icon: CalendarClock, variant: 'ghost' },
  em_andamento: { label: 'Iniciar sessão', icon: CirclePlay, variant: 'dark' },
  concluido: { label: 'Concluir', icon: CheckCircle2, variant: 'primary' },
  nao_compareceu: { label: 'Não compareceu', icon: UserX, variant: 'ghost' },
};

/**
 * Detalhes do agendamento. `portal` = modo instrutor (usa rotas /portal e oculta finanças).
 */
export function AppointmentDrawer({ id, appointment, open, onClose, onEdit, onChanged, portal = false }) {
  const { can } = useAuth();
  const toast = useToast();
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const base = portal ? '/portal/appointments' : '/appointments';
  const canManage = !portal && can('appointments:manage');
  const canStatus = portal ? can('appointments:update_status') : canManage;
  const canNote = portal || canManage;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNote('');
    // No portal do instrutor o agendamento já vem carregado (a rota /appointments/:id é da recepção)
    if (portal) {
      setAppt(appointment || null);
      return;
    }
    if (!id) return;
    setAppt(null);
    api.get(`/appointments/${id}`).then((r) => setAppt(r.data)).catch((e) => setError(errorMessage(e)));
  }, [id, open, portal, appointment]);

  const update = (data) => {
    setAppt(data);
    onChanged?.(data);
  };

  const changeStatus = async (status, reason) => {
    setBusy(status);
    try {
      const { data } = await api.post(`${base}/${appt._id}/status`, { status, reason });
      update(data);
      toast.success(`Status alterado para “${APPOINTMENT_STATUS[status].label}”.`);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    } finally {
      setBusy(null);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy('note');
    try {
      const { data } = await api.post(`${base}/${appt._id}/notes`, { text: note.trim() });
      update(data);
      setNote('');
      toast.success('Observação registrada.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createSale = async () => {
    setBusy('sale');
    try {
      const { data } = await api.post('/sales', {
        client: appt.client._id,
        items: [{ type: 'servico', service: appt.service._id, description: appt.service.name, quantity: 1, unitPrice: appt.contractedAmount }],
        appointments: [appt._id],
      });
      toast.success('Venda registrada.', data.code);
      const { data: fresh } = await api.get(`/appointments/${appt._id}`);
      update(fresh);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const transitions = appt ? APPOINTMENT_TRANSITIONS[appt.status].filter((s) => s !== 'cancelado') : [];
  const allowedPortal = ['em_andamento', 'concluido', 'nao_compareceu', 'confirmado'];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        subtitle={appt?.code}
        title={appt ? appt.service?.name : 'Agendamento'}
        footer={
          appt &&
          canManage && (
            <>
              {APPOINTMENT_TRANSITIONS[appt.status].includes('cancelado') && (
                <Button variant="danger" icon={XCircle} onClick={() => setCancelOpen(true)}>
                  Cancelar
                </Button>
              )}
              {!['cancelado', 'concluido'].includes(appt.status) && (
                <Button variant="dark" icon={Pencil} onClick={() => onEdit(appt)}>
                  Editar / remanejar
                </Button>
              )}
            </>
          )
        }
      >
        {error && <ErrorState message={error} />}
        {!appt && !error && <Spinner />}
        {appt && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge map={APPOINTMENT_STATUS} value={appt.status} />
              <Badge tone="zinc" dot={false}>{ORIGIN[appt.origin]}</Badge>
              {appt.package && <Badge tone="brand" dot={false}>Pacote: {appt.package.name}</Badge>}
            </div>

            <div className="rounded-lg border border-line p-4">
              <p className="text-xs font-medium text-zinc-500">{capitalize(longDate(appt.start))}</p>
              <p className="mt-0.5 text-xl font-semibold tabular text-zinc-950">{timeRange(appt.start, appt.end)}</p>
              <div className="mt-3 flex items-center gap-2">
                {appt.client?.confidential && <Lock className="size-4 text-zinc-500" />}
                {!portal && can('clients:view') ? (
                  <Link to={`/clientes/${appt.client?._id}`} className="font-medium text-zinc-900 hover:underline">
                    {appt.client?.displayName}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900">{appt.client?.displayName}</span>
                )}
                {appt.client?.phone && <span className="text-sm text-zinc-500">{appt.client.phone}</span>}
              </div>
            </div>

            {canStatus && transitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transitions
                  .filter((s) => !portal || allowedPortal.includes(s))
                  .filter((s) => ACTIONS[s])
                  .map((s) => (
                    <Button key={s} size="sm" variant={ACTIONS[s].variant} icon={ACTIONS[s].icon} loading={busy === s} onClick={() => changeStatus(s).catch(() => {})}>
                      {ACTIONS[s].label}
                    </Button>
                  ))}
              </div>
            )}

            <DescriptionList
              items={[
                { label: 'Serviço', value: `${appt.service?.name}${appt.quantity > 1 ? ` · ${appt.quantity} simuladores` : ''}` },
                { label: 'Instrutor', value: appt.instructor?.name || 'Sem instrutor' },
                { label: 'Sala', value: appt.room ? `${appt.room.name} (${appt.room.code})` : 'Sem sala' },
                { label: 'Equipamentos', value: appt.resources?.length ? appt.resources.map((r) => r.code).join(', ') : 'Nenhum' },
                !portal && appt.contractedAmount !== undefined && { label: 'Valor contratado', value: appt.package ? 'Incluso no pacote' : money(appt.contractedAmount) },
                appt.cancelReason && { label: 'Motivo do cancelamento', value: appt.cancelReason, full: true },
                { label: 'Observações', value: appt.notes || '—', full: true },
              ]}
            />

            {!portal && can('sales:view') && (
              <div className="rounded-lg border border-line p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Receipt className="size-3.5" /> Financeiro
                </p>
                {appt.sale ? (
                  <Link to={`/financeiro/vendas/${appt.sale._id}`} className="flex items-center justify-between gap-3 rounded-md hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Venda {appt.sale.code}</p>
                      <p className="text-xs text-zinc-500">
                        Recebido {money(appt.sale.amountReceived)} de {money(appt.sale.total)}
                      </p>
                    </div>
                    {appt.sale.status === 'cancelada' ? <Badge tone="zinc">Cancelada</Badge> : <StatusBadge map={SALE_PAYMENT_STATUS} value={appt.sale.paymentStatus} />}
                  </Link>
                ) : appt.package ? (
                  <p className="text-sm text-zinc-500">Sessão coberta pela venda do pacote.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-500">Nenhuma venda vinculada.</p>
                    {can('sales:manage') && appt.contractedAmount > 0 && appt.status !== 'cancelado' && (
                      <Button size="sm" variant="secondary" loading={busy === 'sale'} onClick={createSale}>
                        Registrar venda
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">Observações da sessão</h3>
              {appt.sessionNotes?.length ? (
                <ul className="mb-3 space-y-2">
                  {appt.sessionNotes.map((n) => (
                    <li key={n._id} className="rounded-md bg-zinc-50 px-3 py-2">
                      <p className="text-sm text-zinc-800">{n.text}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {n.authorName} · {dateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-zinc-500">Nenhuma observação registrada.</p>
              )}
              {canNote && appt.status !== 'cancelado' && (
                <div className="space-y-2">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Evolução, pontos de atenção, próximos passos…" />
                  <div className="flex justify-end">
                    <Button size="sm" variant="dark" onClick={addNote} loading={busy === 'note'} disabled={!note.trim()}>
                      Registrar observação
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {appt.history?.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">Histórico</h3>
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...appt.history].reverse().map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-zinc-300" />
                      <p className="text-sm text-zinc-800">{h.description}</p>
                      <p className="text-xs text-zinc-500">
                        {h.byName || 'Sistema'} · {dateTime(h.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar agendamento"
        description="O horário do instrutor, da sala e dos equipamentos será liberado. A venda vinculada (se houver) não é cancelada automaticamente."
        confirmLabel="Cancelar agendamento"
        requireReason
        reasonPlaceholder="Ex.: cliente remarcou para a próxima semana"
        onConfirm={(reason) => changeStatus('cancelado', reason)}
      />
    </>
  );
}
