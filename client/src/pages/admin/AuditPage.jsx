import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  PeriodFilter,
  SearchInput,
  Select,
  Toolbar,
  usePeriod,
} from '../../components/ui/index.js';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { dateTime } from '../../utils/format.js';
import { ROLE } from '../../utils/labels.js';

const ENTITIES = {
  User: 'Usuários e acesso',
  Client: 'Clientes',
  Appointment: 'Agendamentos',
  Reservation: 'Reservas',
  Sale: 'Vendas',
  Payment: 'Pagamentos',
  Installment: 'Parcelas',
  Expense: 'Despesas',
  FinancialCategory: 'Categorias',
  Service: 'Serviços',
  Package: 'Pacotes',
  Room: 'Salas',
  Resource: 'Equipamentos',
  Instructor: 'Instrutores',
  Report: 'Relatórios',
  Settings: 'Configurações',
  System: 'Sistema',
};

function tone(action) {
  if (/cancel|reverse|deactivate|login_failed|undo/.test(action)) return 'red';
  if (/reveal|view_confidential|confidentiality|role_change|password/.test(action)) return 'violet';
  if (/reschedule|status/.test(action)) return 'amber';
  if (/create|receive|pay|login$/.test(action)) return 'green';
  return 'zinc';
}

function Details({ details }) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details);
  if (!entries.length) return null;
  const show = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'));
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800">Detalhes</summary>
      <dl className="mt-1 space-y-0.5 rounded-md bg-zinc-50 p-2 text-xs">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 font-medium text-zinc-600">{k}:</dt>
            <dd className="break-all text-zinc-700">{v && typeof v === 'object' && 'de' in v ? `${show(v.de)} → ${show(v.para)}` : show(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export default function AuditPage() {
  const [period, setPeriod] = usePeriod('30d');
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const { data, loading, error, reload } = useApi('/audit', {
    params: { from: period.from, to: period.to, entity: entity || undefined, q: debounced || undefined, page, limit: 40 },
  });

  const columns = [
    { key: 'when', header: 'Data e hora', className: 'whitespace-nowrap', render: (a) => <span className="tabular text-zinc-600">{dateTime(a.createdAt)}</span> },
    {
      key: 'user',
      header: 'Usuário',
      render: (a) => (
        <div>
          <p className="font-medium text-zinc-900">{a.userName}</p>
          <p className="text-xs text-zinc-500">{ROLE[a.userRole] || 'Sistema'}</p>
        </div>
      ),
    },
    { key: 'action', header: 'Operação', hideOn: 'md', render: (a) => <Badge tone={tone(a.action)}>{a.action}</Badge> },
    {
      key: 'summary',
      header: 'Descrição',
      render: (a) => (
        <div className="max-w-xl">
          <p className="text-zinc-800">{a.summary}</p>
          <Details details={a.details} />
        </div>
      ),
    },
    { key: 'entity', header: 'Registro', hideOn: 'lg', render: (a) => <span className="text-xs text-zinc-500">{ENTITIES[a.entity] || a.entity}{a.entityLabel ? ` · ${a.entityLabel}` : ''}</span> },
  ];

  return (
    <>
      <PageHeader title="Auditoria" description="Trilha imutável das operações relevantes: acessos, alterações, remanejamentos, estornos e consultas a dados confidenciais." />
      <Toolbar>
        <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPage(1); }} presets={['mes', 'anterior', '30d', '90d']} />
        <div className="w-52">
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} placeholder="Todos os módulos" options={Object.entries(ENTITIES).map(([value, label]) => ({ value, label }))} aria-label="Módulo" />
        </div>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por descrição ou usuário…" className="sm:ml-auto" />
      </Toolbar>
      <Card>
        <DataTable columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState icon={ShieldCheck} title="Nenhum registro no período" />} />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} label="registros" />
      </Card>
    </>
  );
}
