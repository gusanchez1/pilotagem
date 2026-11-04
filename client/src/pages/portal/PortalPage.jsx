import { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Lock, MapPin, StickyNote } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  Tabs,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { addDays, startOfWeek, toDateKey } from '../../utils/dates.js';
import { capitalize, dayMonth, longDate, time } from '../../utils/format.js';
import { APPOINTMENT_STATUS } from '../../utils/labels.js';
import { AppointmentDrawer } from '../agenda/AppointmentDrawer.jsx';
import { TimeGrid, weekDays } from '../agenda/CalendarViews.jsx';

/** Cartão de sessão do instrutor: tudo o que ele precisa, sem dados financeiros. */
function SessionCard({ appt, onOpen, onStatus, canStatus, busy }) {
  const next = { agendado: 'em_andamento', confirmado: 'em_andamento', em_andamento: 'concluido' }[appt.status];
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <button onClick={() => onOpen(appt)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
        <div className="w-16 shrink-0">
          <p className="text-lg font-semibold tabular leading-none text-zinc-950">{time(appt.start)}</p>
          <p className="mt-1 text-xs tabular text-zinc-400">até {time(appt.end)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium text-zinc-900">
            {appt.client?.confidential && <Lock className="size-3.5 text-zinc-500" />}
            {appt.client?.displayName}
          </p>
          <p className="text-sm text-zinc-600">
            {appt.service?.name}
            {appt.quantity > 1 && ` · ${appt.quantity} simuladores`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {appt.room && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {appt.room.name}
              </span>
            )}
            {appt.resources?.length > 0 && <span>{appt.resources.map((r) => r.code).join(', ')}</span>}
            {appt.notes && (
              <span className="flex items-center gap-1 text-amber-700">
                <StickyNote className="size-3" /> {appt.notes}
              </span>
            )}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2 pl-20 sm:pl-0">
        <StatusBadge map={APPOINTMENT_STATUS} value={appt.status} />
        {canStatus && next && (
          <Button size="sm" variant={next === 'concluido' ? 'primary' : 'dark'} loading={busy === appt._id} onClick={() => onStatus(appt, next)}>
            {next === 'concluido' ? 'Concluir' : 'Iniciar'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('hoje');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(toDateKey()));
  const summary = useApi('/portal/summary');
  const week = useApi(tab === 'calendario' ? '/portal/agenda' : null, { params: { from: weekCursor, to: addDays(weekCursor, 6) } });
  const canStatus = can('appointments:update_status');

  const refresh = () => {
    summary.reload();
    if (tab === 'calendario') week.reload();
  };

  const onStatus = async (appt, status) => {
    setBusy(appt._id);
    try {
      const { data } = await api.post(`/portal/appointments/${appt._id}/status`, { status });
      toast.success(status === 'concluido' ? 'Sessão concluída.' : 'Sessão iniciada.');
      refresh();
      if (selected?._id === data._id) setSelected(data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const upcomingByDay = useMemo(() => {
    const groups = {};
    for (const a of summary.data?.upcoming || []) (groups[toDateKey(a.start)] ??= []).push(a);
    return Object.entries(groups);
  }, [summary.data]);

  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.reload} />;
  const s = summary.data;
  const remaining = s?.today.filter((a) => ['agendado', 'confirmado', 'em_andamento'].includes(a.status)).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={capitalize(longDate(new Date()))}
        title={`Olá, ${user.name.split(' ')[0]}`}
        description={s?.instructor ? `${s.instructor.specialty} · seus treinamentos, salas e equipamentos reservados.` : undefined}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Treinamentos hoje" value={s ? s.today.length : '—'} hint={s ? `${remaining} a realizar` : ''} icon={CalendarDays} accent loading={!s} />
        <StatCard label="Próximos agendados" value={s ? s.upcoming.length : '—'} hint="A partir de amanhã" icon={CalendarClock} loading={!s} />
        <StatCard label="Concluídos no mês" value={s ? s.completedThisMonth : '—'} icon={CalendarCheck2} loading={!s} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'hoje', label: 'Hoje', count: s?.today.length },
          { value: 'proximos', label: 'Próximos', count: s?.upcoming.length },
          { value: 'calendario', label: 'Calendário' },
        ]}
      />

      {!s && <Spinner />}

      {s && tab === 'hoje' && (
        <Card>
          {s.today.length ? (
            <div className="divide-y divide-line">
              {s.today.map((a) => (
                <SessionCard key={a._id} appt={a} onOpen={setSelected} onStatus={onStatus} canStatus={canStatus} busy={busy} />
              ))}
            </div>
          ) : (
            <EmptyState icon={CircleCheck} title="Nenhum treinamento hoje" description="Aproveite para revisar as observações das últimas sessões." />
          )}
        </Card>
      )}

      {s && tab === 'proximos' && (
        <div className="space-y-4">
          {upcomingByDay.length === 0 && (
            <Card>
              <EmptyState title="Nenhum treinamento futuro agendado" />
            </Card>
          )}
          {upcomingByDay.map(([day, items]) => (
            <Card key={day}>
              <CardHeader title={capitalize(longDate(`${day}T15:00:00Z`))} description={`${items.length} treinamento(s)`} />
              <div className="divide-y divide-line">
                {items.map((a) => (
                  <SessionCard key={a._id} appt={a} onOpen={setSelected} onStatus={onStatus} canStatus={false} busy={busy} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'calendario' && (
        <Card>
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Button size="icon" variant="ghost" onClick={() => setWeekCursor(addDays(weekCursor, -7))} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekCursor(startOfWeek(toDateKey()))}>
              Esta semana
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setWeekCursor(addDays(weekCursor, 7))} aria-label="Próxima semana">
              <ChevronRight className="size-4" />
            </Button>
            <span className="ml-1 text-sm font-semibold text-zinc-900">
              {dayMonth(`${weekCursor}T15:00:00Z`)} – {dayMonth(`${addDays(weekCursor, 6)}T15:00:00Z`)}
            </span>
          </div>
          {week.loading && !week.data ? (
            <Spinner />
          ) : (
            <TimeGrid days={weekDays(weekCursor)} events={(week.data || []).filter((a) => a.status !== 'cancelado')} onEventClick={setSelected} />
          )}
        </Card>
      )}

      <AppointmentDrawer
        portal
        appointment={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={(a) => {
          setSelected(a);
          refresh();
        }}
      />
    </>
  );
}
