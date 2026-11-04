import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, ClipboardList, Lock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  StatCard,
  StatusBadge,
  Toolbar,
  DateInput,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { toDateKey } from '../../utils/dates.js';
import { date, money } from '../../utils/format.js';
import { INSTALLMENT_STATUS, PAYMENT_METHOD, options } from '../../utils/labels.js';

export default function ReceivablesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [view, setView] = useState(params.get('filtro') === 'vencidas' ? 'vencidas' : 'pendentes');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [receiving, setReceiving] = useState(null);
  const [day, setDay] = useState(toDateKey());
  const [busy, setBusy] = useState(false);
  const summary = useApi('/finance/summary');

  const query = {
    page,
    limit: 30,
    method: method || undefined,
    status: view === 'recebidas' ? 'recebida' : 'pendente',
    overdue: view === 'vencidas' ? true : undefined,
  };
  const { data, loading, error, reload } = useApi('/installments', { params: query });
  const todayStart = new Date(`${toDateKey()}T03:00:00Z`);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/installments/${receiving._id}/receive`, { receivedAt: day });
      toast.success('Recebimento confirmado.', `${money(receiving.amount)} · ${receiving.sale?.code}`);
      setReceiving(null);
      reload();
      summary.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'due',
      header: 'Vencimento',
      render: (i) => (
        <span className="flex items-center gap-2">
          <span className="tabular">{date(i.dueDate)}</span>
          {i.status === 'pendente' && new Date(i.dueDate) < todayStart && <Badge tone="red">Vencida</Badge>}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (i) =>
        i.client ? (
          <span className="flex items-center gap-1.5">
            {i.client.confidential && <Lock className="size-3 text-zinc-500" />}
            {i.client.displayName}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'sale', header: 'Venda', render: (i) => <span className="text-zinc-600">{i.sale?.code}</span> },
    { key: 'desc', header: 'Descrição', hideOn: 'lg', className: 'max-w-[240px]', render: (i) => <span className="line-clamp-1 text-zinc-500">{i.sale?.description}</span> },
    { key: 'method', header: 'Forma', hideOn: 'md', render: (i) => PAYMENT_METHOD[i.method] },
    { key: 'n', header: 'Parcela', hideOn: 'sm', render: (i) => <span className="tabular">{i.number}/{i.totalInstallments}</span> },
    { key: 'amount', header: 'Valor', align: 'right', render: (i) => <span className="tabular font-medium">{money(i.amount)}</span> },
    view === 'recebidas'
      ? { key: 'recv', header: 'Recebida em', align: 'right', render: (i) => <span className="tabular">{date(i.receivedAt)}</span> }
      : {
          key: 'act',
          header: '',
          align: 'right',
          render: (i) =>
            can('payments:manage') ? (
              <Button
                size="xs"
                variant="secondary"
                icon={CheckCircle2}
                onClick={(e) => {
                  e.stopPropagation();
                  setDay(toDateKey());
                  setReceiving(i);
                }}
              >
                Recebido
              </Button>
            ) : (
              <StatusBadge map={INSTALLMENT_STATUS} value={i.status} />
            ),
        },
  ];

  const s = summary.data;
  return (
    <>
      <PageHeader title="Contas a receber" description="Parcelas programadas e recebimentos. Confirme cada recebimento quando o valor entrar no caixa." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saldo a receber" value={money(s?.receivable)} hint={`${s?.receivableCount ?? 0} vendas com saldo`} loading={!s} />
        <StatCard label="Programado em parcelas" value={money(s?.scheduled)} hint="Cartão, boleto e outros a receber" loading={!s} />
        <StatCard label="Em atraso" value={money(s?.overdue)} hint={`${s?.overdueCount ?? 0} pendência(s)`} tone={s?.overdue > 0 ? 'negative' : 'default'} loading={!s} />
        <StatCard label="Recebido no mês" value={money(s?.received)} accent loading={!s} />
      </div>

      <Toolbar>
        <Segmented
          size="sm"
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
          options={[
            { value: 'pendentes', label: 'A receber' },
            { value: 'vencidas', label: 'Vencidas' },
            { value: 'recebidas', label: 'Recebidas' },
          ]}
        />
        <div className="w-48">
          <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} placeholder="Todas as formas" options={options(PAYMENT_METHOD)} aria-label="Forma de pagamento" />
        </div>
        <span className="text-sm text-zinc-500 sm:ml-auto">
          Total na lista: <strong className="tabular text-zinc-900">{money(data?.totals?.[view === 'recebidas' ? 'recebida' : 'pendente']?.total)}</strong>
        </span>
      </Toolbar>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(i) => navigate(`/financeiro/vendas/${i.sale?._id}`)}
          empty={<EmptyState icon={ClipboardList} title={view === 'vencidas' ? 'Nenhuma parcela vencida' : 'Nada por aqui'} description="As parcelas aparecem conforme os pagamentos são registrados nas vendas." />}
        />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} label="parcelas" />
      </Card>

      <Modal
        open={Boolean(receiving)}
        onClose={() => setReceiving(null)}
        size="sm"
        title="Confirmar recebimento"
        description={receiving ? `${receiving.sale?.code} · parcela ${receiving.number}/${receiving.totalInstallments} · ${money(receiving.amount)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceiving(null)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={confirm}>Confirmar</Button>
          </>
        }
      >
        <Field label="Data efetiva do recebimento">
          <DateInput value={day} onChange={(v) => v && setDay(v)}/>
        </Field>
      </Modal>
    </>
  );
}
