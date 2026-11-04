import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarPlus, Eye, EyeOff, Lock, Pencil, ShieldCheck } from 'lucide-react';
import { ClientFormModal } from '../../components/ClientFormModal.jsx';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfidentialTag,
  DataTable,
  DescriptionList,
  ErrorState,
  Spinner,
  StatCard,
  StatusBadge,
  Tabs,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { date, money, timeRange } from '../../utils/format.js';
import { APPOINTMENT_STATUS, INSTALLMENT_STATUS, ORIGIN, PAYMENT_METHOD, SALE_PAYMENT_STATUS } from '../../utils/labels.js';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('agendamentos');
  const [revealed, setRevealed] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const client = useApi(`/clients/${id}`);
  const appts = useApi(can('appointments:view') ? `/clients/${id}/appointments` : null);
  const finance = useApi(can('sales:view') ? `/clients/${id}/finance` : null);

  if (client.error) return <ErrorState message={client.error} onRetry={client.reload} />;
  if (!client.data) return <Spinner />;
  const c = client.data;
  const shown = revealed || c;

  const reveal = async () => {
    setRevealing(true);
    try {
      const { data } = await api.post(`/clients/${id}/reveal`);
      setRevealed(data);
      if (c.confidential) toast.info('Dados revelados', 'Este acesso foi registrado na auditoria.');
      return data;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setRevealing(false);
    }
  };

  const edit = async () => {
    if (c.confidential && !revealed) {
      const data = await reveal();
      if (!data) return;
    }
    setEditOpen(true);
  };

  const apptColumns = [
    { key: 'date', header: 'Data', render: (a) => <span className="tabular">{date(a.start)}</span> },
    { key: 'time', header: 'Horário', render: (a) => <span className="tabular text-zinc-600">{timeRange(a.start, a.end)}</span> },
    { key: 'service', header: 'Serviço', render: (a) => a.service?.name },
    { key: 'instructor', header: 'Instrutor', hideOn: 'md', render: (a) => a.instructor?.name || '—' },
    { key: 'origin', header: 'Origem', hideOn: 'lg', render: (a) => ORIGIN[a.origin] },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge map={APPOINTMENT_STATUS} value={a.status} /> },
  ];

  const saleColumns = [
    { key: 'code', header: 'Venda', render: (s) => <span className="font-medium">{s.code}</span> },
    { key: 'date', header: 'Data', render: (s) => <span className="tabular">{date(s.saleDate)}</span> },
    { key: 'desc', header: 'Descrição', className: 'max-w-xs', render: (s) => <span className="line-clamp-1">{s.description}</span> },
    { key: 'total', header: 'Contratado', align: 'right', render: (s) => <span className="tabular">{money(s.total)}</span> },
    { key: 'received', header: 'Recebido', align: 'right', hideOn: 'sm', render: (s) => <span className="tabular">{money(s.amountReceived)}</span> },
    {
      key: 'status',
      header: 'Situação',
      render: (s) => (s.status === 'cancelada' ? <Badge tone="zinc">Cancelada</Badge> : <StatusBadge map={SALE_PAYMENT_STATUS} value={s.paymentStatus} />),
    },
  ];

  const instColumns = [
    { key: 'due', header: 'Vencimento', render: (i) => <span className="tabular">{date(i.dueDate)}</span> },
    { key: 'method', header: 'Forma', render: (i) => PAYMENT_METHOD[i.method] },
    { key: 'n', header: 'Parcela', render: (i) => `${i.number}/${i.totalInstallments}` },
    { key: 'amount', header: 'Valor', align: 'right', render: (i) => <span className="tabular">{money(i.amount)}</span> },
    { key: 'status', header: 'Situação', render: (i) => <StatusBadge map={INSTALLMENT_STATUS} value={i.status} /> },
    { key: 'recv', header: 'Recebida em', hideOn: 'sm', render: (i) => <span className="tabular">{i.receivedAt ? date(i.receivedAt) : '—'}</span> },
  ];

  return (
    <>
      <button onClick={() => navigate('/clientes')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Clientes
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-zinc-900 text-base font-semibold text-white">
            {c.confidential ? <Lock className="size-5 text-brand" /> : `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">{c.displayName}</h1>
              {c.confidential && <ConfidentialTag />}
            </div>
            <p className="text-sm text-zinc-500">
              {c.code} · cliente desde {date(c.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.confidential && can('clients:confidential') && (
            revealed ? (
              <Button variant="secondary" icon={EyeOff} onClick={() => setRevealed(null)}>Ocultar dados</Button>
            ) : (
              <Button variant="secondary" icon={Eye} loading={revealing} onClick={reveal}>Revelar dados</Button>
            )
          )}
          {can('clients:manage') && (!c.confidential || can('clients:confidential')) && (
            <Button variant="secondary" icon={Pencil} onClick={edit}>Editar</Button>
          )}
          {can('appointments:manage') && <Button variant="primary" icon={CalendarPlus} to="/agenda?novo=1">Agendar</Button>}
        </div>
      </div>

      {c.confidential && (
        <Callout tone={revealed ? 'warning' : 'neutral'} icon={ShieldCheck} className="mb-6" title={revealed ? 'Dados pessoais visíveis' : 'Cliente confidencial'}>
          {revealed
            ? 'O acesso foi registrado na auditoria com seu usuário, data e horário. Oculte os dados ao terminar.'
            : 'Nome real e telefone ficam ocultos em toda a plataforma. Dashboards e relatórios exibem apenas o nome de exibição.'}
        </Callout>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card padded className="lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Dados do cliente</h2>
          <DescriptionList
            columns={1}
            items={[
              c.confidential && { label: 'Nome de exibição', value: shown.alias || c.displayName },
              { label: 'Nome completo', value: shown.firstName ? `${shown.firstName} ${shown.lastName}` : <span className="text-zinc-400">Protegido</span> },
              { label: 'Telefone', value: shown.phone || shown.phoneMasked || <span className="text-zinc-400">Protegido</span> },
              { label: 'Observações internas', value: shown.notes || '—' },
            ]}
          />
        </Card>
        {finance.data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
            <StatCard label="Total contratado" value={money(finance.data.summary.contracted)} hint={`${finance.data.summary.salesCount} venda(s) ativa(s)`} />
            <StatCard label="Total recebido" value={money(finance.data.summary.received)} accent />
            <StatCard label="Saldo pendente" value={money(finance.data.summary.outstanding)} tone={finance.data.summary.outstanding > 0 ? 'warning' : 'default'} />
          </div>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          can('appointments:view') && { value: 'agendamentos', label: 'Agendamentos', count: appts.data?.length },
          can('sales:view') && { value: 'financeiro', label: 'Histórico financeiro', count: finance.data?.sales.length },
        ].filter(Boolean)}
      />

      {tab === 'agendamentos' && can('appointments:view') && (
        <Card>
          <DataTable columns={apptColumns} rows={appts.data} loading={appts.loading} error={appts.error} onRowClick={(a) => navigate(`/agenda?ag=${a._id}`)} />
        </Card>
      )}

      {tab === 'financeiro' && finance.data && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Vendas" />
            <DataTable columns={saleColumns} rows={finance.data.sales} onRowClick={(s) => navigate(`/financeiro/vendas/${s._id}`)} />
          </Card>
          <Card>
            <CardHeader title="Parcelas e recebimentos" />
            <DataTable columns={instColumns} rows={finance.data.installments} />
          </Card>
        </div>
      )}

      <ClientFormModal
        open={editOpen}
        client={revealed || c}
        onClose={() => setEditOpen(false)}
        onSaved={(data) => {
          setRevealed(data.revealed ? data : null);
          client.reload();
        }}
      />
      <Link to="/clientes" className="sr-only">Voltar</Link>
    </>
  );
}
