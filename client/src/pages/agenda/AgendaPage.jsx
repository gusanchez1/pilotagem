import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, LayoutGrid, List, Lock, Rows3 } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  PageHeader,
  Segmented,
  Select,
  Spinner,
  StatusBadge,
  ErrorState,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCatalog } from '../../hooks/useCatalog.js';
import { addDays, addMonths, endOfMonth, monthGrid, startOfMonth, startOfWeek, toDateKey } from '../../utils/dates.js';
import { capitalize, date, dayMonth, longDate, money, monthLabel, timeRange } from '../../utils/format.js';
import { APPOINTMENT_STATUS, ORIGIN, options } from '../../utils/labels.js';
import { AppointmentDrawer } from './AppointmentDrawer.jsx';
import { AppointmentForm } from './AppointmentForm.jsx';
import { MonthGrid, TimeGrid, weekDays } from './CalendarViews.jsx';

const VIEWS = [
  { value: 'dia', label: 'Dia', icon: Rows3 },
  { value: 'semana', label: 'Semana', icon: CalendarDays },
  { value: 'mes', label: 'Mês', icon: LayoutGrid },
  { value: 'lista', label: 'Lista', icon: List },
];

function rangeFor(view, cursor) {
  if (view === 'dia') return { from: cursor, to: cursor };
  if (view === 'semana') {
    const s = startOfWeek(cursor);
    return { from: s, to: addDays(s, 6) };
  }
  if (view === 'mes') {
    const grid = monthGrid(cursor);
    return { from: grid[0], to: grid[grid.length - 1] };
  }
  return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
}

function rangeTitle(view, cursor) {
  if (view === 'dia') return capitalize(longDate(`${cursor}T15:00:00Z`));
  if (view === 'semana') {
    const s = startOfWeek(cursor);
    return `${dayMonth(`${s}T15:00:00Z`)} – ${dayMonth(`${addDays(s, 6)}T15:00:00Z`)}`;
  }
  return monthLabel(cursor.slice(0, 7));
}

export default function AgendaPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || (window.innerWidth < 768 ? 'lista' : 'semana');
  const cursor = params.get('data') || toDateKey();
  const [instructor, setInstructor] = useState('');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [showCancelled, setShowCancelled] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formDefaults, setFormDefaults] = useState(null);
  const catalog = useCatalog({ include: ['instructors', 'rooms'] });

  // Atualização funcional: várias chamadas seguidas não se sobrescrevem
  const setParam = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
        return next;
      },
      { replace: true },
    );

  const range = rangeFor(view, cursor);
  const query = { from: range.from, to: range.to, instructor: instructor || undefined, room: room || undefined, status: status || undefined };
  const { data, loading, error, reload } = useApi('/appointments', { params: query });

  const events = useMemo(
    () => (data?.items || []).filter((a) => showCancelled || status || !['cancelado', 'nao_compareceu'].includes(a.status)),
    [data, showCancelled, status],
  );

  const shift = (dir) => {
    const step = { dia: (d) => addDays(d, dir), semana: (d) => addDays(d, 7 * dir), mes: (d) => addMonths(d, dir), lista: (d) => addMonths(d, dir) }[view];
    setParam({ data: step(cursor) });
  };

  const openNew = (d, t) => {
    if (!can('appointments:manage')) return;
    setEditing(null);
    setFormDefaults({ date: d, time: t });
    setParam({ novo: '1' });
  };

  const formOpen = params.get('novo') === '1' || Boolean(editing);
  const drawerId = params.get('ag');

  const listColumns = [
    { key: 'date', header: 'Data', render: (a) => <span className="tabular">{date(a.start)}</span> },
    { key: 'time', header: 'Horário', render: (a) => <span className="tabular text-zinc-600">{timeRange(a.start, a.end)}</span> },
    {
      key: 'client',
      header: 'Cliente',
      render: (a) => (
        <span className="flex items-center gap-1.5 font-medium text-zinc-900">
          {a.client?.confidential && <Lock className="size-3 text-zinc-500" />}
          {a.client?.displayName}
        </span>
      ),
    },
    { key: 'service', header: 'Serviço', render: (a) => `${a.service?.name}${a.quantity > 1 ? ` (${a.quantity})` : ''}` },
    {
      key: 'instructor',
      header: 'Instrutor',
      hideOn: 'md',
      render: (a) =>
        a.instructor ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: a.instructor.color }} />
            {a.instructor.name}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    { key: 'room', header: 'Sala', hideOn: 'lg', render: (a) => a.room?.name || '—' },
    { key: 'origin', header: 'Origem', hideOn: 'lg', render: (a) => <span className="text-zinc-600">{ORIGIN[a.origin]}</span> },
    can('sales:view') && { key: 'amount', header: 'Valor', align: 'right', hideOn: 'md', render: (a) => <span className="tabular">{a.package ? 'Pacote' : money(a.contractedAmount)}</span> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge map={APPOINTMENT_STATUS} value={a.status} /> },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Fonte única de horários: recepção, sites, telefone e WhatsApp em um só lugar."
        actions={can('appointments:manage') && <Button variant="primary" icon={CalendarPlus} onClick={() => openNew(view === 'dia' ? cursor : toDateKey(), '10:00')}>Novo agendamento</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setParam({ data: toDateKey() })}>
                Hoje
              </Button>
              <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Próximo">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <h2 className="min-w-44 text-[15px] font-semibold text-zinc-900">{rangeTitle(view, cursor)}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Select value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Todos os instrutores" options={catalog.instructors.map((i) => ({ value: i._id, label: i.name }))} aria-label="Instrutor" />
            </div>
            {can('rooms:view') && (
              <div className="w-44">
                <Select value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Todas as salas" options={catalog.rooms.map((r) => ({ value: r._id, label: r.name }))} aria-label="Sala" />
              </div>
            )}
            <div className="w-40">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Todos os status" options={options(APPOINTMENT_STATUS)} aria-label="Status" />
            </div>
            <Segmented value={view} onChange={(v) => setParam({ view: v })} options={VIEWS} size="sm" />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data && loading ? (
          <Spinner />
        ) : (
          <div className={loading ? 'opacity-70 transition-opacity' : ''}>
            {view === 'dia' && <TimeGrid days={[cursor]} events={events} onEventClick={(a) => setParam({ ag: a._id })} onSlotClick={can('appointments:manage') ? openNew : undefined} />}
            {view === 'semana' && (
              <TimeGrid days={weekDays(startOfWeek(cursor))} events={events} onEventClick={(a) => setParam({ ag: a._id })} onSlotClick={can('appointments:manage') ? openNew : undefined} />
            )}
            {view === 'mes' && <MonthGrid cursor={cursor} events={events} onEventClick={(a) => setParam({ ag: a._id })} onDayClick={(d) => setParam({ view: 'dia', data: d })} />}
            {view === 'lista' && <DataTable columns={listColumns} rows={events} loading={loading} onRowClick={(a) => setParam({ ag: a._id })} />}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            {catalog.instructors.filter((i) => i.active).map((i) => (
              <span key={i._id} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: i.color }} /> {i.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-zinc-400" /> Sem instrutor
            </span>
          </div>
          {!status && <Checkbox checked={showCancelled} onChange={setShowCancelled} label="Mostrar cancelados e ausências" />}
        </div>
      </Card>

      <AppointmentForm
        open={formOpen}
        appointment={editing}
        defaults={formDefaults}
        onClose={() => {
          setEditing(null);
          setParam({ novo: null });
        }}
        onSaved={(a) => {
          reload();
          if (!editing) setParam({ novo: null, data: toDateKey(a.start) });
        }}
      />

      <AppointmentDrawer
        id={drawerId}
        open={Boolean(drawerId)}
        onClose={() => setParam({ ag: null })}
        onEdit={(a) => {
          setParam({ ag: null });
          setEditing(a);
        }}
        onChanged={reload}
      />
    </>
  );
}
