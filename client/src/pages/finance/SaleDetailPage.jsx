import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Lock, Paperclip, Plus, RotateCcw, Undo2, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  ErrorState,
  Field,
  Input,
  Modal,
  Spinner,
  StatCard,
  StatusBadge,
  cn,
  DateInput,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, errorMessage, openFile } from '../../services/api.js';
import { toDateKey } from '../../utils/dates.js';
import { date, dateTime, money } from '../../utils/format.js';
import { APPOINTMENT_STATUS, INSTALLMENT_STATUS, PAYMENT_METHOD, PAYMENT_TERMS, SALE_ITEM_TYPE, SALE_PAYMENT_STATUS } from '../../utils/labels.js';
import { PaymentForm } from './PaymentForm.jsx';

/** Barra segmentada: recebido · programado · sem forma de pagamento. */
function PaymentProgress({ sale }) {
  const total = sale.total || 1;
  const seg = [
    { label: 'Recebido', value: sale.amountReceived, className: 'bg-[#2a78d6]' },
    { label: 'Programado (a receber)', value: sale.amountScheduled, className: 'bg-[#2a78d6]/35' },
    { label: 'Sem pagamento registrado', value: sale.amountUnallocated, className: 'bg-zinc-200' },
  ];
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {seg.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className={cn('h-full first:rounded-l-full last:rounded-r-full', s.className)} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${money(s.value)}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
        {seg.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', s.className)} />
            {s.label}: <span className="tabular font-medium text-zinc-900">{money(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReceiveModal({ inst, onClose, onDone }) {
  const toast = useToast();
  const [day, setDay] = useState(toDateKey());
  const [busy, setBusy] = useState(false);
  if (!inst) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/installments/${inst._id}/receive`, { receivedAt: day });
      toast.success('Recebimento confirmado.');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Confirmar recebimento"
      description={`Parcela ${inst.number}/${inst.totalInstallments} · ${money(inst.amount)} · ${PAYMENT_METHOD[inst.method]}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>Confirmar recebimento</Button>
        </>
      }
    >
      <Field label="Data efetiva do recebimento" hint="Data em que o valor entrou na conta/caixa da empresa.">
        <DateInput value={day} onChange={(v) => v && setDay(v)}/>
      </Field>
    </Modal>
  );
}

export default function SaleDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: sale, error, reload, setData } = useApi(`/sales/${id}`);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reverse, setReverse] = useState(null);
  const [undo, setUndo] = useState(null);
  const [receive, setReceive] = useState(null);
  const fileInput = useRef(null);
  const [uploadFor, setUploadFor] = useState(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!sale) return <Spinner />;

  const active = sale.status === 'ativa';
  const canPay = can('payments:manage') && active;

  const upload = async (file) => {
    if (!file || !uploadFor) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const { data } = await api.post(`/payments/${uploadFor}/receipts`, body);
      setData(data);
      toast.success('Comprovante anexado.', 'Arquivo armazenado localmente, com acesso restrito.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploadFor(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const itemColumns = [
    { key: 'type', header: 'Tipo', render: (i) => <Badge tone="zinc" dot={false}>{SALE_ITEM_TYPE[i.type]}</Badge> },
    { key: 'desc', header: 'Descrição', render: (i) => <span className="font-medium text-zinc-900">{i.description}</span> },
    { key: 'mod', header: 'Modalidade', hideOn: 'md', render: (i) => <span className="text-zinc-600">{i.modality}</span> },
    { key: 'qty', header: 'Qtd.', align: 'right', render: (i) => <span className="tabular">{i.quantity}</span> },
    { key: 'unit', header: 'Unitário', align: 'right', hideOn: 'sm', render: (i) => <span className="tabular">{money(i.unitPrice)}</span> },
    { key: 'disc', header: 'Desconto', align: 'right', hideOn: 'sm', render: (i) => <span className="tabular text-zinc-500">{i.discount ? `− ${money(i.discount)}` : '—'}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (i) => <span className="tabular font-medium">{money(i.total)}</span> },
  ];

  return (
    <>
      <button onClick={() => navigate('/financeiro/vendas')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Vendas
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">Venda {sale.code}</h1>
            {active ? <StatusBadge map={SALE_PAYMENT_STATUS} value={sale.paymentStatus} /> : <Badge tone="zinc">Cancelada</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
            {sale.client ? (
              <Link to={`/clientes/${sale.client._id}`} className="inline-flex items-center gap-1 font-medium text-zinc-800 hover:underline">
                {sale.client.confidential && <Lock className="size-3" />}
                {sale.client.displayName}
              </Link>
            ) : (
              'Receita avulsa'
            )}
            · {date(sale.saleDate)} · {sale.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('sales:manage') && active && (
            <Button variant="danger" icon={XCircle} onClick={() => setCancelOpen(true)}>Cancelar venda</Button>
          )}
          {canPay && sale.amountUnallocated > 0 && (
            <Button variant="primary" icon={Plus} onClick={() => setPayOpen(true)}>Registrar pagamento</Button>
          )}
        </div>
      </div>

      {!active && (
        <Callout tone="neutral" className="mb-6" title="Venda cancelada">
          {sale.cancelReason} — por {sale.cancelledBy?.name || '—'} em {dateTime(sale.cancelledAt)}. Vendas canceladas não entram nos indicadores.
        </Callout>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Valor contratado" value={money(sale.total)} hint={sale.discount ? `Desconto geral de ${money(sale.discount)}` : `Vencimento ${date(sale.dueDate)}`} />
        <StatCard label="Recebido" value={money(sale.amountReceived)} accent />
        <StatCard label="Programado" value={money(sale.amountScheduled)} hint="Parcelas a receber" />
        <StatCard label="Saldo pendente" value={money(sale.amountOutstanding)} tone={sale.amountOutstanding > 0 && active ? 'warning' : 'default'} hint={sale.amountUnallocated > 0 && active ? `${money(sale.amountUnallocated)} sem pagamento registrado` : 'Contratado − recebido'} />
      </div>

      <Card padded className="mb-6">
        <PaymentProgress sale={sale} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Pagamentos" description="Cada pagamento pode ter várias parcelas. Estornos ficam registrados no histórico." />
            {sale.payments.length === 0 && <p className="px-5 py-8 text-center text-sm text-zinc-500">Nenhum pagamento registrado.</p>}
            <div className="divide-y divide-line">
              {sale.payments.map((p) => (
                <div key={p._id} className={cn('px-5 py-4', p.status === 'estornado' && 'bg-zinc-50/80')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={cn('font-medium text-zinc-900', p.status === 'estornado' && 'text-zinc-500 line-through')}>
                        {money(p.amount)} · {PAYMENT_METHOD[p.method]}
                        {p.installmentsCount > 1 && ` em ${p.installmentsCount}x`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Registrado por {p.createdBy?.name || '—'} em {dateTime(p.createdAt)}
                      </p>
                      {p.status === 'estornado' && (
                        <p className="mt-1 text-xs text-red-700">
                          Estornado em {dateTime(p.reversedAt)} por {p.reversedBy?.name || '—'}: {p.reverseReason}
                        </p>
                      )}
                      {p.receiptReference && <p className="mt-1 text-xs text-zinc-600">Comprovante: {p.receiptReference}</p>}
                      {p.notes && <p className="mt-1 text-xs text-zinc-600">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.status === 'estornado' ? (
                        <Badge tone="red">Estornado</Badge>
                      ) : (
                        canPay && (
                          <>
                            <Button size="xs" variant="ghost" icon={Paperclip} onClick={() => { setUploadFor(p._id); fileInput.current?.click(); }}>
                              Anexar comprovante
                            </Button>
                            <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => setReverse(p)}>
                              Estornar
                            </Button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                  {p.receipts?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.receipts.map((r) => (
                        <button
                          key={r._id}
                          onClick={() => openFile(`/payments/${p._id}/receipts/${r._id}`).catch((e) => toast.error(errorMessage(e)))}
                          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          <FileText className="size-3.5" /> {r.originalName}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 overflow-hidden rounded-md border border-line">
                    <table className="w-full text-[13px]">
                      <tbody>
                        {p.installments.map((i) => (
                          <tr key={i._id} className="border-b border-line last:border-0">
                            <td className="px-3 py-2 tabular text-zinc-500">{i.number}/{i.totalInstallments}</td>
                            <td className="px-3 py-2 tabular">Vence {date(i.dueDate)}</td>
                            <td className="px-3 py-2 text-right tabular font-medium">{money(i.amount)}</td>
                            <td className="px-3 py-2">
                              <StatusBadge map={INSTALLMENT_STATUS} value={i.status} />
                              {i.status === 'pendente' && new Date(i.dueDate) < new Date(`${toDateKey()}T03:00:00Z`) && <Badge tone="red" className="ml-1.5">Vencida</Badge>}
                            </td>
                            <td className="hidden px-3 py-2 text-xs text-zinc-500 sm:table-cell">{i.receivedAt ? `Recebida em ${date(i.receivedAt)}` : ''}</td>
                            <td className="px-3 py-2 text-right">
                              {canPay && i.status === 'pendente' && p.status === 'ativo' && (
                                <Button size="xs" variant="secondary" icon={CheckCircle2} onClick={() => setReceive(i)}>Recebido</Button>
                              )}
                              {canPay && i.status === 'recebida' && can('finance:view') && (
                                <Button size="xs" variant="ghost" icon={Undo2} onClick={() => setUndo(i)} title="Desfazer recebimento">Desfazer</Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Itens contratados" description="Preços registrados no momento da venda" />
            <DataTable columns={itemColumns} rows={sale.items} dense />
          </Card>
        </div>

        <div className="space-y-6">
          <Card padded>
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Detalhes</h2>
            <DescriptionList
              columns={1}
              items={[
                { label: 'Data da venda', value: date(sale.saleDate) },
                { label: 'Vencimento', value: date(sale.dueDate) },
                { label: 'Condição de pagamento', value: PAYMENT_TERMS[sale.paymentTerms] },
                { label: 'Categoria', value: sale.category?.name || '—' },
                { label: 'Subtotal / desconto', value: `${money(sale.subtotal)} / ${money(sale.discount)}` },
                { label: 'Registrada por', value: sale.createdBy?.name || '—' },
                sale.reservation && { label: 'Reserva vinculada', value: `${sale.reservation.code} · ${sale.reservation.title}` },
                { label: 'Observações', value: sale.notes || '—' },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Agendamentos vinculados" icon={CalendarDays} />
            {sale.appointments?.length ? (
              <ul className="divide-y divide-line">
                {sale.appointments.map((a) => (
                  <li key={a._id}>
                    <Link to={`/agenda?ag=${a._id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-zinc-50">
                      <div>
                        <p className="text-[13px] font-medium text-zinc-900">{a.service?.name}</p>
                        <p className="text-xs text-zinc-500">{a.code} · {dateTime(a.start)}</p>
                      </div>
                      <StatusBadge map={APPOINTMENT_STATUS} value={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-zinc-500">Nenhum agendamento vinculado.</p>
            )}
          </Card>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

      <PaymentForm open={payOpen} onClose={() => setPayOpen(false)} sale={sale} onSaved={setData} />
      <ReceiveModal inst={receive} onClose={() => setReceive(null)} onDone={reload} />

      <ConfirmDialog
        open={Boolean(reverse)}
        onClose={() => setReverse(null)}
        title="Estornar pagamento"
        description={reverse ? `O pagamento de ${money(reverse.amount)} (${PAYMENT_METHOD[reverse.method]}) e suas parcelas serão cancelados. O registro permanece no histórico.` : ''}
        confirmLabel="Estornar"
        requireReason
        reasonPlaceholder="Ex.: valor devolvido ao cliente, lançamento duplicado…"
        onConfirm={async (reason) => {
          try {
            const { data } = await api.post(`/payments/${reverse._id}/reverse`, { reason });
            setData(data);
            toast.success('Pagamento estornado.');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(undo)}
        onClose={() => setUndo(null)}
        title="Desfazer recebimento"
        description="A parcela volta a ficar pendente. Use apenas para corrigir lançamentos. A correção fica registrada na auditoria."
        confirmLabel="Desfazer recebimento"
        requireReason
        onConfirm={async (reason) => {
          try {
            await api.post(`/installments/${undo._id}/undo-receive`, { reason });
            reload();
            toast.success('Recebimento desfeito.');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar venda"
        description="Pagamentos pendentes serão estornados automaticamente. Se houver valores já recebidos, estorne-os antes. A venda permanece no histórico como cancelada."
        confirmLabel="Cancelar venda"
        requireReason
        onConfirm={async (reason) => {
          try {
            const { data } = await api.post(`/sales/${sale._id}/cancel`, { reason });
            setData(data);
            toast.success('Venda cancelada.');
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </>
  );
}
