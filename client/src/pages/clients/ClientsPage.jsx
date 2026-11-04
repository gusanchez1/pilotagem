import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Lock, UserPlus, Users } from 'lucide-react';
import { ClientFormModal } from '../../components/ClientFormModal.jsx';
import {
  Button,
  Card,
  ConfidentialTag,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Segmented,
  Toolbar,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { date } from '../../utils/format.js';

export default function ClientsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q);
  const { data, loading, error, reload } = useApi('/clients', {
    params: { q: debounced || undefined, page, limit: 20, confidential: filter === 'confidenciais' ? true : undefined },
  });
  const formOpen = params.get('novo') === '1';

  const columns = [
    { key: 'code', header: 'Código', render: (c) => <span className="font-mono text-xs text-zinc-500">{c.code}</span> },
    {
      key: 'name',
      header: 'Cliente',
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600">
            {c.confidential ? <Lock className="size-3.5" /> : `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`}
          </span>
          <span className="font-medium text-zinc-900">{c.displayName}</span>
          {c.confidential && <ConfidentialTag />}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (c) => <span className="tabular text-zinc-600">{c.phone || c.phoneMasked || <span className="text-zinc-400">Protegido</span>}</span>,
    },
    { key: 'notes', header: 'Observações', hideOn: 'lg', className: 'max-w-xs', render: (c) => <span className="line-clamp-1 text-zinc-500">{c.notes || '—'}</span> },
    { key: 'createdAt', header: 'Cadastro', align: 'right', hideOn: 'sm', render: (c) => <span className="tabular text-zinc-500">{date(c.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro mínimo (nome, sobrenome e telefone) com proteção para clientes confidenciais."
        actions={can('clients:manage') && <Button variant="primary" icon={UserPlus} onClick={() => setParams({ novo: '1' })}>Novo cliente</Button>}
      />
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Buscar por nome, telefone ou código…"
        />
        <Segmented
          size="sm"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'confidenciais', label: 'Confidenciais', icon: Lock },
          ]}
        />
      </Toolbar>
      <Card>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(c) => navigate(`/clientes/${c._id}`)}
          empty={
            <EmptyState
              icon={Users}
              title={q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              description={q ? 'Tente buscar pelo telefone ou pelo código do cliente.' : undefined}
            />
          }
        />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} label="clientes" />
      </Card>
      <ClientFormModal open={formOpen} onClose={() => setParams({})} onSaved={(c) => navigate(`/clientes/${c._id}`)} />
    </>
  );
}
