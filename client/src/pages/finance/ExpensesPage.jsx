import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Plus, Receipt, Tags } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Menu,
  Modal,
  MoneyInput,
  PageHeader,
  Pagination,
  PeriodFilter,
  SearchInput,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toolbar,
  usePeriod,
  DateInput,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi, useDebounce } from '../../hooks/useApi.js';
import { api, errorMessage } from '../../services/api.js';
import { toDateKey } from '../../utils/dates.js';
import { date, money } from '../../utils/format.js';
import { EXPENSE_STATUS, PAYMENT_METHOD, options } from '../../utils/labels.js';

function ExpenseForm({ open, onClose, expense, categories, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(
      expense
        ? {
            description: expense.description,
            category: expense.category?._id,
            amount: expense.amount,
            dueDate: toDateKey(expense.dueDate),
            paid: expense.status === 'paga',
            paidAt: expense.paidAt ? toDateKey(expense.paidAt) : toDateKey(),
            method: expense.method || 'pix',
            supplier: expense.supplier,
            notes: expense.notes,
            receiptReference: expense.receiptReference,
          }
        : { description: '', category: '', amount: 0, dueDate: toDateKey(), paid: false, paidAt: toDateKey(), method: 'pix', supplier: '', notes: '', receiptReference: '' },
    );
  }, [open, expense]);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));

  const submit = async () => {
    if (!f.description?.trim() || !f.category || !f.amount) return toast.error('Preencha descrição, categoria e valor.');
    setBusy(true);
    const body = {
      description: f.description,
      category: f.category,
      amount: f.amount,
      dueDate: f.dueDate,
      paidAt: f.paid ? f.paidAt : null,
      method: f.paid ? f.method : null,
      supplier: f.supplier,
      notes: f.notes,
      receiptReference: f.receiptReference,
    };
    try {
      const { data } = expense ? await api.patch(`/expenses/${expense._id}`, body) : await api.post('/expenses', body);
      toast.success(expense ? 'Despesa atualizada.' : 'Despesa registrada.', data.code);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={expense ? `Editar despesa ${expense.code}` : 'Nova despesa'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição" required className="sm:col-span-2">
          <Input value={f.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Categoria" required>
          <Select value={f.category || ''} onChange={(e) => set({ category: e.target.value })} placeholder="Selecione…" options={categories.map((c) => ({ value: c._id, label: c.name }))} />
        </Field>
        <Field label="Valor" required>
          <MoneyInput value={f.amount} onChange={(v) => set({ amount: v })} />
        </Field>
        <Field label="Vencimento" required>
          <DateInput value={f.dueDate || ''} onChange={(v) => v && set({ dueDate: v })}/>
        </Field>
        <Field label="Fornecedor">
          <Input value={f.supplier || ''} onChange={(e) => set({ supplier: e.target.value })} />
        </Field>
        <div className="rounded-lg border border-line bg-zinc-50/60 p-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input type="checkbox" checked={Boolean(f.paid)} onChange={(e) => set({ paid: e.target.checked })} className="size-4 accent-zinc-900" />
            Despesa já paga
          </label>
          {f.paid && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Data do pagamento">
                <DateInput value={f.paidAt} onChange={(v) => v && set({ paidAt: v })}/>
              </Field>
              <Field label="Forma de pagamento">
                <Select value={f.method} onChange={(e) => set({ method: e.target.value })} options={options(PAYMENT_METHOD)} />
              </Field>
            </div>
          )}
        </div>
        <Field label="Referência do comprovante" className="sm:col-span-2">
          <Input value={f.receiptReference || ''} onChange={(e) => set({ receiptReference: e.target.value })} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

function PayModal({ expense, onClose, onDone }) {
  const toast = useToast();
  const [paidAt, setPaidAt] = useState(toDateKey());
  const [method, setMethod] = useState('pix');
  const [busy, setBusy] = useState(false);
  if (!expense) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Registrar pagamento da despesa"
      description={`${expense.description} · ${money(expense.amount)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/expenses/${expense._id}/pay`, { paidAt, method });
                toast.success('Despesa paga.');
                onDone();
                onClose();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data do pagamento">
          <DateInput value={paidAt} onChange={(v) => v && setPaidAt(v)}/>
        </Field>
        <Field label="Forma">
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={options(PAYMENT_METHOD)} />
        </Field>
      </div>
    </Modal>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const { data, loading, reload } = useApi('/categories');
  const [editing, setEditing] = useState(null);
  const save = async () => {
    try {
      if (editing._id) await api.patch(`/categories/${editing._id}`, { name: editing.name, color: editing.color });
      else await api.post('/categories', editing);
      toast.success('Categoria salva.');
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const toggle = async (c) => {
    try {
      await api.patch(`/categories/${c._id}`, { active: !c.active });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const columns = [
    { key: 'name', header: 'Categoria', render: (c) => <span className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-sm" style={{ background: c.color }} />{c.name}</span> },
    { key: 'type', header: 'Tipo', render: (c) => <Badge tone={c.type === 'receita' ? 'blue' : 'amber'}>{c.type === 'receita' ? 'Receita' : 'Despesa'}</Badge> },
    { key: 'active', header: 'Situação', render: (c) => (c.active ? <Badge tone="green">Ativa</Badge> : <Badge tone="zinc">Inativa</Badge>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => setEditing({ ...c })}>Editar</Button>
          <Button size="xs" variant="ghost" onClick={() => toggle(c)}>{c.active ? 'Desativar' : 'Ativar'}</Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" icon={Plus} onClick={() => setEditing({ name: '', type: 'despesa', color: '#71717a' })}>Nova categoria</Button>
      </div>
      <Card>
        <DataTable columns={columns} rows={data} loading={loading} />
      </Card>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="sm"
        title={editing?._id ? 'Editar categoria' : 'Nova categoria'}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="dark" onClick={save}>Salvar</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            {!editing._id && (
              <Field label="Tipo">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} options={[{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }]} />
              </Field>
            )}
            <Field label="Cor">
              <input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-9 w-16 cursor-pointer rounded border border-line" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ExpensesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState('despesas');
  const [period, setPeriod] = usePeriod('mes');
  const [status, setStatus] = useState(params.get('filtro') === 'vencidas' ? 'vencidas' : '');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, expense: null });
  const [paying, setPaying] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const debounced = useDebounce(q);
  const cats = useApi('/categories', { params: { type: 'despesa' }, initial: [] });
  const overdue = status === 'vencidas';
  const { data, loading, error, reload } = useApi('/expenses', {
    params: {
      from: overdue ? undefined : period.from,
      to: overdue ? undefined : period.to,
      status: !overdue && status ? status : undefined,
      overdue: overdue || undefined,
      category: category || undefined,
      q: debounced || undefined,
      page,
      limit: 30,
    },
  });
  const manage = can('expenses:manage');
  const totals = data?.totals || {};

  const columns = [
    { key: 'due', header: 'Vencimento', render: (e) => <span className="tabular">{date(e.dueDate)}</span> },
    {
      key: 'desc',
      header: 'Descrição',
      render: (e) => (
        <div>
          <p className="font-medium text-zinc-900">{e.description}</p>
          <p className="text-xs text-zinc-500">{e.code}{e.supplier ? ` · ${e.supplier}` : ''}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Categoria', hideOn: 'md', render: (e) => <span className="flex items-center gap-1.5 text-zinc-600"><span className="size-2 rounded-sm" style={{ background: e.category?.color }} />{e.category?.name}</span> },
    {
      key: 'status',
      header: 'Situação',
      render: (e) => (
        <span className="flex items-center gap-1.5">
          <StatusBadge map={EXPENSE_STATUS} value={e.status} />
          {e.status === 'pendente' && new Date(e.dueDate) < new Date(`${toDateKey()}T03:00:00Z`) && <Badge tone="red">Vencida</Badge>}
        </span>
      ),
    },
    { key: 'paid', header: 'Pago em', hideOn: 'lg', render: (e) => <span className="tabular text-zinc-500">{e.paidAt ? `${date(e.paidAt)} · ${PAYMENT_METHOD[e.method]}` : '—'}</span> },
    { key: 'amount', header: 'Valor', align: 'right', render: (e) => <span className={e.status === 'cancelada' ? 'tabular text-zinc-400 line-through' : 'tabular font-medium'}>{money(e.amount)}</span> },
    manage && {
      key: 'act',
      header: '',
      align: 'right',
      render: (e) =>
        e.status !== 'cancelada' && (
          <Menu
            trigger={<Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal className="size-4" /></Button>}
            items={[
              { label: 'Registrar pagamento', icon: CheckCircle2, onClick: () => setPaying(e), hidden: e.status !== 'pendente' },
              { label: 'Editar', icon: Pencil, onClick: () => setForm({ open: true, expense: e }) },
              { label: e.status === 'paga' ? 'Estornar' : 'Cancelar', icon: Ban, danger: true, onClick: () => setCancelling(e) },
            ]}
          />
        ),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Despesas"
        description="Contas a pagar e despesas pagas, por categoria."
        actions={manage && tab === 'despesas' && <Button variant="primary" icon={Plus} onClick={() => setForm({ open: true, expense: null })}>Nova despesa</Button>}
      />
      {can('categories:manage') && (
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'despesas', label: 'Despesas', icon: Receipt }, { value: 'categorias', label: 'Categorias financeiras', icon: Tags }]} />
      )}

      {tab === 'categorias' ? (
        <CategoriesTab />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Pagas" value={money(totals.paga?.total)} hint={`${totals.paga?.count ?? 0} despesa(s)`} loading={!data} />
            <StatCard label="Pendentes" value={money(totals.pendente?.total)} hint={`${totals.pendente?.count ?? 0} despesa(s)`} tone={totals.pendente?.total ? 'warning' : 'default'} loading={!data} />
            <StatCard label="Canceladas/estornadas" value={money(totals.cancelada?.total)} hint="Não entram nos indicadores" loading={!data} />
          </div>
          <Toolbar>
            {!overdue && <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />}
            <div className="w-40">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="Todas as situações" options={[...options(EXPENSE_STATUS), { value: 'vencidas', label: 'Vencidas (todas)' }]} aria-label="Situação" />
            </div>
            <div className="w-52">
              <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="Todas as categorias" options={cats.data.map((c) => ({ value: c._id, label: c.name }))} aria-label="Categoria" />
            </div>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Descrição ou fornecedor…" className="sm:ml-auto sm:w-60" />
          </Toolbar>
          <Card>
            <DataTable
              columns={columns}
              rows={data?.items}
              loading={loading}
              error={error}
              onRetry={reload}
              empty={<EmptyState icon={Receipt} title="Nenhuma despesa encontrada" />}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} label="despesas" />
          </Card>
        </>
      )}

      <ExpenseForm open={form.open} expense={form.expense} categories={cats.data.filter((c) => c.active)} onClose={() => setForm({ open: false, expense: null })} onSaved={reload} />
      <PayModal expense={paying} onClose={() => setPaying(null)} onDone={reload} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={cancelling?.status === 'paga' ? 'Estornar despesa' : 'Cancelar despesa'}
        description="A despesa não é apagada: fica registrada como cancelada, com motivo, e deixa de compor os indicadores."
        confirmLabel="Confirmar"
        requireReason
        onConfirm={async (reason) => {
          try {
            await api.post(`/expenses/${cancelling._id}/cancel`, { reason });
            toast.success('Despesa cancelada.');
            reload();
          } catch (err) {
            toast.error(errorMessage(err));
            throw err;
          }
        }}
      />
    </>
  );
}
