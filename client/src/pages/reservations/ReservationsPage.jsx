import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, CalendarRange, ChevronLeft, ChevronRight, CirclePlay, Flag, LayoutList, Lock, MoreHorizontal, Pencil, Plus, Rows3 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Menu,
  PageHeader,
  PeriodFilter,
  Segmented,
  Select,
  Spinner,
  StatusBadge,
  Toolbar,
  cn,
  usePeriod,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { addDays, minutesOfDay, toDateKey } from '../../utils/dates.js';
import { capitalize, date, longDate, money, time, timeRange } from '../../utils/format.js';
import { RESERVATION_STATUS, RESOURCE_CATEGORY, USAGE_TYPE, options } from '../../utils/labels.js';
import { ReservationForm } from './ReservationForm.jsx';

const START = 7;
const END = 23;
const SPAN = (END - START) * 60;

const USAGE_COLOR = {
  treinamento: 'bg-blue-100 border-blue-400 text-blue-900',
  locacao: 'bg-teal-100 border-teal-500 text-teal-900',
  evento: 'bg-violet-100 border-violet-500 text-violet-900',
  uso_interno: 'bg-zinc-200 border-zinc-500 text-zinc-800',
  manutencao: 'bg-red-50 border-red-400 text-red-800 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgba(239,68,68,.12)_6px_12px)]',
};

function Lane({ label, sub, bookings, dayKey, status, onBook, onOpen, color }) {
  const pos = (b) => {
    const s = toDateKey(b.start) < dayKey ? 0 : Math.max(0, minutesOfDay(b.start) - START * 60);
    const e = toDateKey(b.end) > dayKey ? SPAN : Math.min(SPAN, minutesOfDay(b.end) - START * 60);
    return { left: `${(s / SPAN) * 100}%`, width: `${Math.max(0.8, ((e - s) / SPAN) * 100)}%` };
  };
  return (
    <div className="grid grid-cols-[180px_1fr] border-b border-line last:border-0">
      <div className="flex min-w-0 items-center gap-2 border-r border-line px-3 py-2">
        {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-900">{label}</p>
          <p className="truncate text-[11px] text-zinc-500">{sub}</p>
        </div>
      </div>
      <div
        className={cn('relative h-12', status && status !== 'ativa' && status !== 'disponivel' && 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,#f4f4f5_6px_12px)]', onBook && 'cursor-copy')}
        onClick={(e) => {
          if (!onBook) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const min = Math.floor((((e.clientX - rect.left) / rect.width) * SPAN) / 60) * 60 + START * 60;
          onBook(`${String(Math.floor(min / 60)).padStart(2, '0')}:00`);
        }}
      >
        {Array.from({ length: END - START }, (_, i) => (
          <span key={i} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${(i / (END - START)) * 100}%` }} />
        ))}
        {bookings.map((b) => (
          <button
            key={b._id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(b);
            }}
            className={cn('absolute top-1.5 bottom-1.5 overflow-hidden rounded border-l-[3px] px-1.5 text-left text-[11px] leading-tight hover:z-10 hover:shadow-pop', USAGE_COLOR[b.usageType || 'treinamento'])}
            style={pos(b)}
            title={`${timeRange(b.start, b.end)} · ${b.title}`}
          >
            <span className="block truncate font-semibold">
              {b.client?.confidential && <Lock className="mr-0.5 inline size-2.5" />}
              {b.client?.displayName || b.title}
            </span>
            <span className="block truncate opacity-75">{time(b.start)}–{time(b.end)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Board({ dayKey, data, canManage, onBook, onOpen }) {
  const hours = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const section = (title) => <div className="border-b border-line bg-zinc-50/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</div>;
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[180px_1fr] border-b border-line">
          <div />
          <div className="relative h-7">
            {hours.map((h, i) => (
              <span key={h} className="absolute top-1.5 -translate-x-1/2 text-[10px] tabular text-zinc-400" style={{ left: `${(i / (END - START)) * 100}%` }}>
                {i > 0 && i < hours.length - 1 ? `${h}h` : ''}
              </span>
            ))}
          </div>
        </div>
        {section('Salas')}
        {data.rooms.map((r) => (
          <Lane
            key={r._id}
            label={r.name}
            sub={`${r.code}${r.shared ? ' · compartilhada' : ''}${r.status !== 'ativa' ? ' · indisponível' : ''}`}
            bookings={r.bookings}
            dayKey={dayKey}
            status={r.status}
            onBook={canManage && r.status === 'ativa' ? (t) => onBook({ room: r._id, time: t }) : undefined}
            onOpen={onOpen}
          />
        ))}
        {section('Simuladores e equipamentos')}
        {data.resources.map((r) => (
          <Lane
            key={r._id}
            label={r.name}
            sub={`${r.code} · ${RESOURCE_CATEGORY[r.category]}${r.status !== 'disponivel' ? ' · em manutenção' : ''}`}
            bookings={r.bookings}
            dayKey={dayKey}
            status={r.status}
            onBook={canManage && r.status === 'disponivel' ? (t) => onBook({ resource: r._id, time: t }) : undefined}
            onOpen={onOpen}
          />
        ))}
        {data.instructors.length > 0 && section('Instrutores')}
        {data.instructors.map((i) => (
          <Lane key={i._id} label={i.name} sub={i.specialty} color={i.color} bookings={i.bookings} dayKey={dayKey} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState('quadro');
  const [day, setDay] = useState(toDateKey());
  const [period, setPeriod] = usePeriod('mes');
  const [usage, setUsage] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ open: false });
  const [cancelling, setCancelling] = useState(null);
  const canManage = can('reservations:manage');

  const board = useApi(view === 'quadro' ? '/availability/timeline' : null, { params: { date: day } });
  const list = useApi(view === 'lista' ? '/reservations' : null, {
    params: { from: period.from, to: period.to, usageType: usage || undefined, status: status || undefined, limit: 500 },
  });

  const reloadAll = () => {
    if (view === 'quadro') board.reload();
    else list.reload();
  };

  const openBooking = async (b) => {
    if (b.appointment) return navigate(`/agenda?ag=${b.appointment}`);
    try {
      const { data } = await api.get(`/reservations/${b._id}`);
      if (canManage && !['cancelada', 'concluida'].includes(data.status)) setForm({ open: true, reservation: data });
      else toast.info(`${data.code} · ${data.title}`, `${USAGE_TYPE[data.usageType].label} · ${timeRange(data.start, data.end)}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setResStatus = async (r, s) => {
    try {
      await api.post(`/reservations/${r._id}/status`, { status: s });
      toast.success('Status atualizado.');
      reloadAll();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    { key: 'code', header: 'Reserva', render: (r) => <span className="font-medium text-zinc-900">{r.code}</span> },
    { key: 'date', header: 'Data', render: (r) => <span className="tabular">{date(r.start)}</span> },
    { key: 'time', header: 'Horário', render: (r) => <span className="tabular text-zinc-600">{timeRange(r.start, r.end)}</span> },
    { key: 'title', header: 'Descrição', className: 'max-w-[280px]', render: (r) => <span className="line-clamp-1">{r.title}</span> },
    { key: 'usage', header: 'Tipo', render: (r) => <StatusBadge map={USAGE_TYPE} value={r.usageType} /> },
    {
      key: 'targets',
      header: 'Salas / equipamentos',
      hideOn: 'lg',
      className: 'max-w-[240px]',
      render: (r) => <span className="line-clamp-1 text-zinc-600">{[...r.rooms.map((x) => x.name), ...r.resources.map((x) => x.code)].join(', ')}</span>,
    },
    can('sales:view') && { key: 'amount', header: 'Valor', align: 'right', hideOn: 'md', render: (r) => <span className="tabular">{r.amount ? money(r.amount) : '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge map={RESERVATION_STATUS} value={r.status} /> },
    canManage && {
      key: 'act',
      header: '',
      align: 'right',
      render: (r) =>
        r.appointment ? (
          <Badge tone="zinc" dot={false}>Via agenda</Badge>
        ) : (
          !['cancelada', 'concluida'].includes(r.status) && (
            <Menu
              trigger={<Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal className="size-4" /></Button>}
              items={[
                { label: 'Editar / remanejar', icon: Pencil, onClick: () => setForm({ open: true, reservation: r }) },
                { label: 'Marcar em uso', icon: CirclePlay, onClick: () => setResStatus(r, 'em_uso'), hidden: r.status === 'em_uso' },
                { label: 'Concluir', icon: Flag, onClick: () => setResStatus(r, 'concluida') },
                { label: 'Cancelar reserva', icon: Ban, danger: true, onClick: () => setCancelling(r) },
              ]}
            />
          )
        ),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Reservas e salas"
        description="Ocupação de salas, simuladores, equipamentos e instrutores em um só quadro."
        actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setForm({ open: true, defaults: { date: view === 'quadro' ? day : toDateKey() } })}>Nova reserva</Button>}
      />

      <Toolbar>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'quadro', label: 'Quadro do dia', icon: Rows3 },
            { value: 'lista', label: 'Lista', icon: LayoutList },
          ]}
        />
        {view === 'quadro' ? (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setDay(addDays(day, -1))} aria-label="Dia anterior"><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="secondary" onClick={() => setDay(toDateKey())}>Hoje</Button>
            <Button size="icon" variant="ghost" onClick={() => setDay(addDays(day, 1))} aria-label="Próximo dia"><ChevronRight className="size-4" /></Button>
            <span className="ml-2 text-sm font-semibold text-zinc-900">{capitalize(longDate(`${day}T15:00:00Z`))}</span>
          </div>
        ) : (
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            <div className="w-40"><Select value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="Todos os tipos" options={options(USAGE_TYPE)} aria-label="Tipo" /></div>
            <div className="w-40"><Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Todos os status" options={options(RESERVATION_STATUS)} aria-label="Status" /></div>
          </>
        )}
      </Toolbar>

      <Card>
        {view === 'quadro' &&
          (board.error ? (
            <ErrorState message={board.error} onRetry={board.reload} />
          ) : !board.data ? (
            <Spinner />
          ) : (
            <>
              <Board dayKey={day} data={board.data} canManage={canManage} onOpen={openBooking} onBook={(d) => setForm({ open: true, defaults: { date: day, time: d.time, endTime: `${String(Math.min(23, Number(d.time.slice(0, 2)) + 2)).padStart(2, '0')}:00`, room: d.room, resource: d.resource } })} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-zinc-600">
                {Object.entries(USAGE_TYPE).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1.5"><span className={cn('size-3 rounded-sm border-l-[3px]', USAGE_COLOR[k])} />{v.label}</span>
                ))}
                {canManage && <span className="ml-auto text-zinc-400">Clique em um horário livre para reservar</span>}
              </div>
            </>
          ))}
        {view === 'lista' && (
          <DataTable
            columns={columns}
            rows={list.data?.items}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty={<EmptyState icon={CalendarRange} title="Nenhuma reserva no período" />}
          />
        )}
      </Card>

      <ReservationForm open={form.open} reservation={form.reservation} defaults={form.defaults} onClose={() => setForm({ open: false })} onSaved={reloadAll} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancelar reserva"
        description="O horário será liberado para outras reservas. O registro permanece no histórico."
        confirmLabel="Cancelar reserva"
        requireReason
        onConfirm={async (reason) => {
          try {
            await api.post(`/reservations/${cancelling._id}/cancel`, { reason });
            toast.success('Reserva cancelada.');
            reloadAll();
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </>
  );
}
