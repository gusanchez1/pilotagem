import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  ClientPicker,
  Field,
  Input,
  Modal,
  MoneyInput,
  Select,
  DateInput,
} from '../../components/ui/index.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useCatalog } from '../../hooks/useCatalog.js';
import { api, errorMessage } from '../../services/api.js';
import { toDateKey } from '../../utils/dates.js';
import { money } from '../../utils/format.js';
import { PAYMENT_METHOD, PAYMENT_TERMS, SALE_ITEM_TYPE, options } from '../../utils/labels.js';

const newItem = () => ({ key: Math.random(), type: 'servico', service: '', package: '', tier: '', description: '', quantity: 1, unitPrice: 0, discount: 0 });

/** Nova venda: serviço, pacote, locação ou combinação personalizada. */
export function SaleForm({ open, onClose, onSaved, defaults }) {
  const toast = useToast();
  const catalog = useCatalog({ include: ['services', 'packages', 'categories'] });
  const [client, setClient] = useState(null);
  const [noClient, setNoClient] = useState(false);
  const [items, setItems] = useState([newItem()]);
  const [meta, setMeta] = useState({});
  const [pay, setPay] = useState({ enabled: false, method: 'pix', receiveNow: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient(defaults?.client || null);
    setNoClient(false);
    setItems([newItem()]);
    setMeta({ discount: 0, saleDate: toDateKey(), dueDate: toDateKey(), category: '', paymentTerms: 'antecipado', notes: '' });
    setPay({ enabled: false, method: 'pix', receiveNow: true });
  }, [open, defaults]);

  const updateItem = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const onPick = (it, field, id) => {
    if (field === 'service') {
      const s = catalog.services.find((x) => x._id === id);
      const tiered = s?.pricingMode === 'por_quantidade';
      updateItem(it.key, {
        service: id,
        tier: tiered ? String(s.priceTiers[0]?.quantity ?? '') : '',
        description: s ? (tiered ? `${s.name} — ${s.priceTiers[0]?.label}` : s.name) : '',
        unitPrice: s ? (tiered ? s.priceTiers[0]?.price : s.basePrice) : 0,
        quantity: 1,
      });
    } else {
      const p = catalog.packages.find((x) => x._id === id);
      updateItem(it.key, { package: id, description: p?.name || '', unitPrice: p?.price || 0, quantity: 1 });
    }
  };

  const lineTotal = (it) => Math.max(0, it.quantity * it.unitPrice - (it.discount || 0));
  const subtotal = items.reduce((a, it) => a + lineTotal(it), 0);
  const total = Math.max(0, subtotal - (meta.discount || 0));
  const revenueCats = useMemo(() => catalog.categories.filter((c) => c.type === 'receita' && c.active), [catalog.categories]);

  const submit = async () => {
    if (!noClient && !client) return toast.error('Selecione o cliente ou marque “Receita avulsa”.');
    if (items.some((it) => !it.description.trim() || it.unitPrice <= 0)) return toast.error('Preencha descrição e valor de todos os itens.');
    if (total <= 0) return toast.error('O total da venda deve ser maior que zero.');
    setBusy(true);
    try {
      const { data } = await api.post('/sales', {
        client: noClient ? null : client._id,
        items: items.map((it) => ({
          type: it.type,
          service: ['servico', 'locacao'].includes(it.type) && it.service ? it.service : null,
          package: it.type === 'pacote' && it.package ? it.package : null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || 0,
        })),
        discount: meta.discount || 0,
        saleDate: meta.saleDate,
        dueDate: meta.dueDate,
        category: meta.category || null,
        paymentTerms: meta.paymentTerms,
        notes: meta.notes,
        payments: pay.enabled ? [{ method: pay.method, amount: total, installmentsCount: 1, receiveNow: pay.receiveNow, firstDueDate: meta.saleDate }] : [],
      });
      toast.success('Venda registrada.', data.code);
      onSaved(data);
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
      size="xl"
      title="Nova venda"
      description="O preço registrado fica preservado no histórico, mesmo que o catálogo mude depois."
      footer={
        <>
          <span className="mr-auto text-sm text-zinc-500">
            Total contratado: <strong className="tabular text-zinc-950">{money(total)}</strong>
          </span>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>Registrar venda</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Cliente" required={!noClient}>
            <ClientPicker value={client} onChange={setClient} disabled={noClient} />
          </Field>
          <div className="pb-2">
            <Checkbox checked={noClient} onChange={setNoClient} label="Receita avulsa (sem cliente)" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700">Itens da venda</p>
          <div className="space-y-3">
            {items.map((it) => {
              const svc = catalog.services.find((s) => s._id === it.service);
              return (
                <div key={it.key} className="rounded-lg border border-line p-3">
                  <div className="grid gap-3 md:grid-cols-[150px_1fr_1fr]">
                    <Select value={it.type} onChange={(e) => updateItem(it.key, { ...newItem(), key: it.key, type: e.target.value })} options={options(SALE_ITEM_TYPE)} aria-label="Tipo" />
                    {['servico', 'locacao'].includes(it.type) && (
                      <Select
                        value={it.service}
                        onChange={(e) => onPick(it, 'service', e.target.value)}
                        placeholder={it.type === 'locacao' ? 'Serviço de locação (opcional)' : 'Selecione o serviço…'}
                        options={catalog.services.filter((s) => s.active).map((s) => ({ value: s._id, label: s.name }))}
                        aria-label="Serviço"
                      />
                    )}
                    {it.type === 'pacote' && (
                      <Select
                        value={it.package}
                        onChange={(e) => onPick(it, 'package', e.target.value)}
                        placeholder="Selecione o pacote…"
                        options={catalog.packages.filter((p) => p.active).map((p) => ({ value: p._id, label: `${p.name} — ${money(p.price)}` }))}
                        aria-label="Pacote"
                      />
                    )}
                    {svc?.pricingMode === 'por_quantidade' ? (
                      <Select
                        value={it.tier}
                        onChange={(e) => {
                          const t = svc.priceTiers.find((x) => String(x.quantity) === e.target.value);
                          updateItem(it.key, { tier: e.target.value, unitPrice: t.price, description: `${svc.name} — ${t.label}` });
                        }}
                        options={svc.priceTiers.map((t) => ({ value: String(t.quantity), label: `${t.label} — ${money(t.price)}` }))}
                        aria-label="Opção"
                      />
                    ) : (
                      <Input value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} placeholder="Descrição do item" aria-label="Descrição" className={it.type === 'personalizado' ? 'md:col-span-2' : ''} />
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-[100px_1fr_1fr_1fr_auto] md:items-end">
                    <Field label="Qtd.">
                      <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                    <Field label="Valor unitário">
                      <MoneyInput value={it.unitPrice} onChange={(v) => updateItem(it.key, { unitPrice: v })} />
                    </Field>
                    <Field label="Desconto do item">
                      <MoneyInput value={it.discount} onChange={(v) => updateItem(it.key, { discount: v })} />
                    </Field>
                    <div className="pb-2 text-right">
                      <p className="text-[11px] text-zinc-500">Total do item</p>
                      <p className="font-semibold tabular">{money(lineTotal(it))}</p>
                    </div>
                    <Button size="icon" variant="ghost" disabled={items.length === 1} onClick={() => setItems(items.filter((x) => x.key !== it.key))} aria-label="Remover item" className="mb-0.5">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => setItems([...items, newItem()])}>
            Adicionar item
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Desconto geral">
            <MoneyInput value={meta.discount} onChange={(v) => setMeta({ ...meta, discount: v })} />
          </Field>
          <Field label="Data da venda">
            <DateInput value={meta.saleDate} onChange={(v) => v && setMeta({ ...meta, saleDate: v })}/>
          </Field>
          <Field label="Vencimento">
            <DateInput value={meta.dueDate} onChange={(v) => v && setMeta({ ...meta, dueDate: v })}/>
          </Field>
          <Field label="Condição de pagamento">
            <Select value={meta.paymentTerms} onChange={(e) => setMeta({ ...meta, paymentTerms: e.target.value })} options={options(PAYMENT_TERMS)} />
          </Field>
          <Field label="Categoria de receita" className="sm:col-span-2" hint="Em branco: definida automaticamente pelo tipo do item.">
            <Select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} placeholder="Automática" options={revenueCats.map((c) => ({ value: c._id, label: c.name }))} />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Input value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-zinc-50/60 p-4">
          <Checkbox checked={pay.enabled} onChange={(v) => setPay({ ...pay, enabled: v })} label="Registrar pagamento integral agora" description="Para pagamentos parciais ou parcelados, use “Registrar pagamento” na venda após salvar." />
          {pay.enabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Forma">
                <Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value, receiveNow: ['pix', 'dinheiro', 'cartao_debito'].includes(e.target.value) })} options={options(PAYMENT_METHOD)} />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox checked={pay.receiveNow} onChange={(v) => setPay({ ...pay, receiveNow: v })} label="Valor já recebido" />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
