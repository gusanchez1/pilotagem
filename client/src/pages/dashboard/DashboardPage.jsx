import { useNavigate } from 'react-router';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Info,
  Users,
  Wallet,
} from 'lucide-react';
import { AppointmentRow } from '../../components/AppointmentRow.jsx';
import { BarList, ChartLegend, ChartTooltip, SERIES, axisProps, gridProps } from '../../components/charts/ChartKit.jsx';
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, PeriodFilter, Skeleton, StatCard, cn, usePeriod } from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { dateKeyLabel, dayMonth, money, moneyCompact, monthShort, monthLabel, number } from '../../utils/format.js';
import { PAYMENT_METHOD } from '../../utils/labels.js';

function bucketLabel(row, bucket) {
  if (bucket === 'semana') return `Sem. ${dayMonth(row.start)}`;
  return dayMonth(row.start);
}

function Alerts({ alerts }) {
  const navigate = useNavigate();
  if (!alerts?.length) return null;
  const icon = { danger: CircleAlert, warning: AlertTriangle, info: Info };
  const color = { danger: 'text-red-600', warning: 'text-amber-600', info: 'text-blue-600' };
  return (
    <div className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {alerts.map((a) => {
        const Icon = icon[a.level];
        return (
          <button
            key={a.title}
            onClick={() => navigate(a.link)}
            className="group flex items-start gap-3 rounded-lg border border-line bg-white px-4 py-3 text-left shadow-card transition-colors hover:border-zinc-300"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', color[a.level])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">{a.title}</p>
              <p className="truncate text-xs text-zinc-500">{a.description}</p>
            </div>
            <ChevronRight className="mt-0.5 size-4 text-zinc-300 group-hover:text-zinc-500" />
          </button>
        );
      })}
    </div>
  );
}

function FinancialKpis({ s, loading }) {
  const navigate = useNavigate();
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Vendido no período" value={money(s?.sold)} hint={`${number(s?.salesCount)} vendas ativas`} loading={loading} />
      <StatCard label="Recebido no período" value={money(s?.received)} hint="Entradas efetivas (caixa)" accent loading={loading} />
      <StatCard label="Despesas pagas" value={money(s?.expensesPaid)} hint={`${money(s?.expensesPending)} a pagar`} loading={loading} />
      <StatCard
        label="Resultado operacional"
        value={money(s?.operatingResult)}
        hint="Recebido − despesas pagas"
        tone={s?.operatingResult < 0 ? 'negative' : 'positive'}
        loading={loading}
      />
      <StatCard
        label="A receber"
        value={money(s?.receivable)}
        hint={`${money(s?.scheduled)} programados`}
        loading={loading}
        onClick={() => navigate('/financeiro/contas-a-receber')}
      />
      <StatCard
        label="Em atraso"
        value={money(s?.overdue)}
        hint={`${number(s?.overdueCount)} pendência(s)`}
        tone={s?.overdue > 0 ? 'negative' : 'default'}
        loading={loading}
        onClick={() => navigate('/financeiro/contas-a-receber?filtro=vencidas')}
      />
    </div>
  );
}

function OperationalKpis({ k, loading }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard label="Agendamentos hoje" value={number(k?.appointmentsToday)} icon={CalendarDays} loading={loading} accent />
      <StatCard label="Concluídos no período" value={number(k?.completedInPeriod)} icon={CalendarCheck2} loading={loading} />
      <StatCard label="Próximos 7 dias" value={number(k?.upcomingWeek)} icon={CalendarClock} loading={loading} />
      <StatCard
        label="Salas ocupadas agora"
        value={k ? `${k.roomsOccupied} de ${k.roomsOccupied + k.roomsAvailable}` : '—'}
        hint={k ? `${k.roomsAvailable} disponíveis${k.roomsUnavailable ? ` · ${k.roomsUnavailable} indisponíveis` : ''}` : ''}
        icon={Building2}
        loading={loading}
      />
      <StatCard label="Clientes cadastrados" value={number(k?.clients)} icon={Users} loading={loading} />
    </div>
  );
}

function ChartCard({ title, description, legend, children, className }) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
        {legend}
      </div>
      <div className="px-3 pb-3 pt-2">{children}</div>
    </Card>
  );
}

function MonthlyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...axisProps} tickFormatter={monthShort} />
        <YAxis {...axisProps} width={64} tickFormatter={moneyCompact} />
        <Tooltip cursor={{ fill: '#f4f4f5' }} content={<ChartTooltip formatter={money} labelFormatter={monthLabel} />} />
        <Bar dataKey="received" name="Recebido" fill={SERIES.received} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expenses" name="Despesas pagas" fill={SERIES.expenses} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line dataKey="result" name="Resultado" type="monotone" stroke={SERIES.ink} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES.ink }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ReceiptsChart({ data }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-zinc-500">Nenhum recebimento no período.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="recv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.received} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES.received} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="start" {...axisProps} tickFormatter={dayMonth} minTickGap={24} />
        <YAxis {...axisProps} width={64} tickFormatter={moneyCompact} />
        <Tooltip
          cursor={{ stroke: '#a1a1aa', strokeDasharray: '3 3' }}
          content={<ChartTooltip formatter={money} labelFormatter={(l) => dayMonth(l)} />}
        />
        <Area dataKey="cumulative" name="Acumulado recebido" type="monotone" stroke={SERIES.received} strokeWidth={2} fill="url(#recv)" activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrainingsChart({ data, bucket }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-zinc-500">Nenhum treinamento concluído no período.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="18%">
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="bucket" {...axisProps} tickFormatter={(_, i) => bucketLabel(data[i] || {}, bucket)} minTickGap={16} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip cursor={{ fill: '#f4f4f5' }} content={<ChartTooltip labelFormatter={(_, p) => (p?.[0] ? bucketLabel(p[0].payload, bucket) : '')} />} />
        <Bar dataKey="count" name="Treinamentos concluídos" fill={SERIES.ink} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Transactions({ items }) {
  const navigate = useNavigate();
  if (!items.length) return <EmptyState title="Sem movimentações" className="py-8" />;
  return (
    <ul className="divide-y divide-line">
      {items.map((t) => (
        <li key={t._id}>
          <button
            onClick={() => t.saleId && navigate(`/financeiro/vendas/${t.saleId}`)}
            className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left', t.saleId && 'hover:bg-zinc-50')}
          >
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', t.type === 'entrada' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700')}>
              {t.type === 'entrada' ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-900">{t.description}</p>
              <p className="truncate text-xs text-zinc-500">
                {dayMonth(t.date)} · {t.counterpart} · {PAYMENT_METHOD[t.method] || '—'}
              </p>
            </div>
            <span className={cn('shrink-0 text-sm font-medium tabular', t.type === 'entrada' ? 'text-zinc-900' : 'text-zinc-500')}>
              {t.type === 'entrada' ? '+' : '−'} {money(t.amount)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PendingPayments({ items }) {
  const navigate = useNavigate();
  if (!items.length) return <EmptyState title="Nenhum pagamento pendente" className="py-8" />;
  return (
    <ul className="divide-y divide-line">
      {items.map((p) => (
        <li key={p._id}>
          <button onClick={() => navigate(`/financeiro/vendas/${p.saleId}`)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-zinc-50">
            <div className="w-16 shrink-0 text-center">
              <p className={cn('whitespace-nowrap text-sm font-semibold tabular', p.overdue ? 'text-red-700' : 'text-zinc-900')}>{dayMonth(p.dueDate)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-900">{p.client}</p>
              <p className="truncate text-xs text-zinc-500">
                {p.saleCode} · {PAYMENT_METHOD[p.method]}
                {p.totalInstallments > 1 && ` · ${p.number}/${p.totalInstallments}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular text-zinc-900">{money(p.amount)}</p>
              {p.overdue && <Badge tone="red">Vencida</Badge>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RoomsNow({ rooms }) {
  return (
    <ul className="grid gap-2 p-4 sm:grid-cols-2">
      {rooms.map((r) => (
        <li key={r._id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-zinc-900">{r.name}</p>
            <p className="text-[11px] text-zinc-500">{r.code}</p>
          </div>
          {r.status !== 'ativa' ? (
            <Badge tone="zinc">Indisponível</Badge>
          ) : r.occupied ? (
            <Badge tone="amber">Ocupada</Badge>
          ) : (
            <Badge tone="green">Livre</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = usePeriod('30d');
  const { data, loading, error, reload } = useApi('/dashboard', { params: { from: period.from, to: period.to } });
  const ops = data?.operational;
  const fin = data?.financial;
  const firstName = user?.name?.split(' ')[0];
  const openAppt = (a) => navigate(`/agenda?ag=${a._id}`);

  return (
    <>
      <PageHeader
        eyebrow={`Olá, ${firstName}`}
        title="Visão geral"
        description={`Indicadores de ${dateKeyLabel(period.from)} a ${dateKeyLabel(period.to)}, calculados a partir dos registros do sistema.`}
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {!error && (
        <>
          <Alerts alerts={data?.alerts} />

          {(fin || (loading && !data)) && user.role !== 'recepcao' && <FinancialKpis s={fin?.summary} loading={loading && !data} />}

          {fin && (
            <>
              <div className="mb-6 grid gap-4 xl:grid-cols-3">
                <ChartCard
                  className="xl:col-span-2"
                  title="Receitas recebidas × despesas pagas"
                  description="Evolução mensal em regime de caixa"
                  legend={
                    <ChartLegend
                      items={[
                        { label: 'Recebido', color: SERIES.received },
                        { label: 'Despesas pagas', color: SERIES.expenses },
                        { label: 'Resultado', color: SERIES.ink, line: true },
                      ]}
                    />
                  }
                >
                  <MonthlyChart data={fin.monthly} />
                </ChartCard>
                <ChartCard title="Faturamento por modalidade" description="Vendas ativas no período">
                  <div className="px-2 py-2">
                    <BarList items={fin.revenueByModality.map((m) => ({ label: m.modality, value: m.total }))} valueFormatter={money} />
                  </div>
                </ChartCard>
              </div>

              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <ChartCard title="Evolução dos recebimentos" description="Valor acumulado recebido no período">
                  <ReceiptsChart data={fin.receiptsEvolution} />
                </ChartCard>
                <ChartCard title="Despesas por categoria" description="Despesas pagas no período">
                  <div className="px-2 py-2">
                    <BarList
                      items={fin.expensesByCategory.map((c) => ({ label: c.category, value: c.total }))}
                      valueFormatter={money}
                      color={SERIES.expenses}
                    />
                  </div>
                </ChartCard>
              </div>
            </>
          )}

          {(ops || (loading && !data)) && <OperationalKpis k={ops?.kpis} loading={loading && !data} />}

          {ops && (
            <div className="mb-6 grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader
                  title={fin ? 'Próximos agendamentos' : 'Agenda de hoje'}
                  description={fin ? 'Os próximos treinamentos confirmados e agendados' : `${ops.today.length} agendamento(s) para hoje`}
                  actions={
                    <button onClick={() => navigate('/agenda')} className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
                      Abrir agenda →
                    </button>
                  }
                />
                <div className="divide-y divide-line">
                  {(fin ? ops.upcoming : ops.today).map((a) => (
                    <AppointmentRow key={a._id} appt={a} onClick={() => openAppt(a)} showDate={Boolean(fin)} dateLabel={dayMonth(a.start)} />
                  ))}
                  {!(fin ? ops.upcoming : ops.today).length && <EmptyState title="Nenhum agendamento" className="py-8" />}
                </div>
              </Card>
              <div className="space-y-4">
                {!fin && (
                  <Card>
                    <CardHeader title="Salas agora" description="Ocupação neste momento" />
                    <RoomsNow rooms={ops.rooms} />
                  </Card>
                )}
                <ChartCard title="Treinamentos realizados" description={`Concluídos por ${ops.trainingsBucket}`}>
                  <TrainingsChart data={ops.trainingsSeries} bucket={ops.trainingsBucket} />
                </ChartCard>
              </div>
            </div>
          )}

          {ops && !fin && (
            <Card className="mb-6">
              <CardHeader title="Próximos agendamentos" />
              <div className="divide-y divide-line">
                {ops.upcoming.map((a) => (
                  <AppointmentRow key={a._id} appt={a} onClick={() => openAppt(a)} showDate dateLabel={dayMonth(a.start)} />
                ))}
              </div>
            </Card>
          )}

          {fin && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Últimas movimentações" icon={Wallet} description="Entradas recebidas e despesas pagas" />
                <Transactions items={fin.recentTransactions} />
              </Card>
              <Card>
                <CardHeader
                  title="Pagamentos pendentes"
                  description="Próximos vencimentos e parcelas em atraso"
                  actions={
                    <button onClick={() => navigate('/financeiro/contas-a-receber')} className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
                      Ver todos →
                    </button>
                  }
                />
                <PendingPayments items={fin.pendingPayments} />
              </Card>
            </div>
          )}

          {loading && !data && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          )}
        </>
      )}
    </>
  );
}
