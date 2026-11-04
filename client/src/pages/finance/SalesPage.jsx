import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HandCoins, Lock, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  PeriodFilter,
  SearchInput,
  Segmented,
  StatCard,
  StatusBadge,
  Toolbar,
  usePeriod,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { date, money } from '../../utils/format.js';
import { SALE_PAYMENT_STATUS } from '../../utils/labels.js';
import { SaleForm } from './SaleForm.jsx';

export default function SalesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = usePeriod('90d');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ativa');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const { data, loading, error, reload } = useApi('/sales', {
    params: { from: period.from, to: period.to, q: debounced || undefined, status, paymentStatus: pay || undefined, page, limit: 25 },
  });

  const columns = [
    { key: 'code', header: 'Venda', render: (s) => <span className="font-medium text-zinc-900">{s.code}</span> },
    { key: 'date', header: 'Data', render: (s) => <span className="tabular text-zinc-600">{date(s.saleDate)}</span> },
    {
      key: 'client',
      header: 'Cliente',
      render: (s) =>
        s.client ? (
          <span className="flex items-center gap-1.5">
            {s.client.confidential && <Lock className="size-3 text-zinc-500" />}
            {s.client.displayName}
          </span>
        ) : (
          <span className="text-zinc-400">Receita avulsa</span>
        ),
    },
    { key: 'desc', header: 'Descrição', hideOn: 'lg', className: 'max-w-[260px]', render: (s) => <span className="line-clamp-1 text-zinc-600">{s.description}</span> },
    { key: 'total', header: 'Contratado', align: 'right', render: (s) => <span className="tabular">{money(s.total)}</span> },
    { key: 'received', header: 'Recebido', align: 'right', hideOn: 'md', render: (s) => <span className="tabular">{money(s.amountReceived)}</span> },
    {
      key: 'outstanding',
      header: 'Pendente',
      align: 'right',
      hideOn: 'sm',
      render: (s) => <span className={s.amountOutstanding > 0 && s.status === 'ativa' ? 'tabular font-medium text-zinc-900' : 'tabular text-zinc-400'}>{s.status === 'ativa' ? money(s.amountOutstanding) : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Situação',
      render: (s) => (s.status === 'cancelada' ? <Badge tone="zinc">Cancelada</Badge> : <StatusBadge map={SALE_PAYMENT_STATUS} value={s.paymentStatus} />),
    },
  ];

  const t = data?.totals;
  return (
    <>
      <PageHeader
        title="Vendas"
        description="Serviços, pacotes, locações e combinações personalizadas, com seus pagamentos."
        actions={can('sales:manage') && <Button variant="primary" icon={Plus} onClick={() => setParams({ nova: '1' })}>Nova venda</Button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={status === 'cancelada' ? 'Total cancelado' : 'Total contratado'} value={money(t?.total)} hint={`${data?.total ?? 0} venda(s) no filtro`} loading={!data} />
        <StatCard label="Recebido" value={money(t?.received)} accent loading={!data} />
        <StatCard label="Saldo pendente" value={money(t?.outstanding)} tone={t?.outstanding > 0 ? 'warning' : 'default'} loading={!data} />
      </div>

      <Toolbar>
        <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
        <Segmented size="sm" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'ativa', label: 'Ativas' }, { value: 'cancelada', label: 'Canceladas' }]} />
        {status === 'ativa' && (
          <Segmented
            size="sm"
            value={pay}
            onChange={(v) => { setPay(v); setPage(1); }}
            options={[{ value: '', label: 'Todas' }, { value: 'em_aberto', label: 'Em aberto' }, { value: 'parcial', label: 'Parciais' }, { value: 'quitada', label: 'Quitadas' }]}
          />
        )}
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Código ou descrição…" className="sm:ml-auto sm:w-60" />
      </Toolbar>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(s) => navigate(`/financeiro/vendas/${s._id}`)}
          rowClassName={(s) => (s.status === 'cancelada' ? 'text-zinc-400' : '')}
          empty={<EmptyState icon={HandCoins} title="Nenhuma venda no período" description="Altere o período ou registre uma nova venda." />}
        />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} label="vendas" />
      </Card>

      <SaleForm open={params.get('nova') === '1'} onClose={() => setParams({})} onSaved={(s) => navigate(`/financeiro/vendas/${s._id}`)} />
    </>
  );
}
