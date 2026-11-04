import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Checkbox,
  Field,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  DateInput,
} from '../../components/ui/index.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { api, errorMessage } from '../../services/api.js';
import { toDateKey } from '../../utils/dates.js';
import { dateKeyLabel, money } from '../../utils/format.js';
import { PAYMENT_METHOD, options } from '../../utils/labels.js';

const INSTANT = ['pix', 'dinheiro', 'cartao_debito'];

function addMonthsKey(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Prévia das parcelas (mesma regra do servidor: diferença de centavos na 1ª). */
function preview(amount, count, firstDue) {
  if (!amount || !count) return [];
  const base = Math.floor(amount / count);
  const rest = amount - base * count;
  return Array.from({ length: count }, (_, i) => ({ n: i + 1, amount: base + (i === 0 ? rest : 0), due: addMonthsKey(firstDue, i) }));
}

/**
 * Registro de pagamento: integral, parcial, parcelado, antecipado ou posterior.
 * O sistema apenas REGISTRA o que foi informado — não processa cobranças.
 */
export function PaymentForm({ open, onClose, sale, onSaved }) {
  const toast = useToast();
  const available = sale?.amountUnallocated ?? 0;
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (open) {
      setF({
        method: 'pix',
        amount: available,
        installmentsCount: 1,
        firstDueDate: toDateKey(),
        receiveNow: true,
        receivedAt: toDateKey(),
        receiptReference: '',
        notes: '',
      });
    }
  }, [open, available]);

  const schedule = useMemo(() => preview(f.amount, f.installmentsCount, f.firstDueDate || toDateKey()), [f.amount, f.installmentsCount, f.firstDueDate]);
  const parcelable = ['cartao_credito', 'boleto', 'outro'].includes(f.method);

  const onMethod = (method) => {
    const instant = INSTANT.includes(method);
    set({ method, receiveNow: instant, installmentsCount: instant ? 1 : f.installmentsCount });
  };

  const submit = async () => {
    if (!f.amount || f.amount <= 0) return toast.error('Informe o valor do pagamento.');
    if (f.amount > available) return toast.error(`O valor excede o saldo disponível (${money(available)}).`);
    setBusy(true);
    try {
      const { data } = await api.post(`/sales/${sale._id}/payments`, {
        method: f.method,
        amount: f.amount,
        installmentsCount: f.installmentsCount,
        firstDueDate: f.firstDueDate,
        receiveNow: f.receiveNow,
        receivedAt: f.receiveNow ? f.receivedAt : undefined,
        receiptReference: f.receiptReference,
        notes: f.notes,
      });
      toast.success('Pagamento registrado.', `Recebido: ${money(data.amountReceived)} · Saldo: ${money(data.amountOutstanding)}`);
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!sale) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Registrar pagamento"
      description={`Venda ${sale.code} · disponível para pagamento: ${money(available)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>Registrar pagamento</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Forma de pagamento" required>
          <Select value={f.method} onChange={(e) => onMethod(e.target.value)} options={options(PAYMENT_METHOD)} />
        </Field>
        <Field label="Valor" required hint={f.amount < available ? 'Pagamento parcial' : 'Pagamento integral do saldo'}>
          <MoneyInput value={f.amount} onChange={(v) => set({ amount: v })} />
        </Field>
        {parcelable && (
          <Field label="Parcelas">
            <Select
              value={f.installmentsCount}
              onChange={(e) => set({ installmentsCount: Number(e.target.value), receiveNow: Number(e.target.value) === 1 ? f.receiveNow : false })}
              options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: i === 0 ? 'À vista (1x)' : `${i + 1}x` }))}
            />
          </Field>
        )}
        <Field label={f.installmentsCount > 1 ? '1º vencimento' : 'Vencimento'} hint={f.method === 'cartao_credito' ? 'Data prevista do repasse da operadora' : undefined}>
          <DateInput value={f.firstDueDate} onChange={(v) => v && set({ firstDueDate: v })}/>
        </Field>

        <div className="rounded-lg border border-line bg-zinc-50/60 p-4 sm:col-span-2">
          <Checkbox
            checked={f.receiveNow}
            onChange={(v) => set({ receiveNow: v })}
            label={f.installmentsCount > 1 ? 'A 1ª parcela já foi recebida' : 'Valor já recebido pela empresa'}
            description="Desmarque para registrar como valor a receber (ex.: cartão aguardando repasse, boleto em aberto)."
          />
          {f.receiveNow && (
            <Field label="Data do recebimento" className="mt-3 max-w-48">
              <DateInput value={f.receivedAt} onChange={(v) => v && set({ receivedAt: v })}/>
            </Field>
          )}
        </div>

        {schedule.length > 1 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-zinc-500">Parcelas previstas</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {schedule.map((p) => (
                <div key={p.n} className="rounded-md border border-line px-3 py-2">
                  <p className="text-[11px] text-zinc-500">
                    {p.n}/{schedule.length} · {dateKeyLabel(p.due)}
                  </p>
                  <p className="text-sm font-medium tabular">{money(p.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Referência do comprovante" className="sm:col-span-2" hint="Ex.: “Pix enviado no WhatsApp da recepção em 03/11, ID E1234…”. O arquivo pode ser anexado depois.">
          <Input value={f.receiptReference} onChange={(e) => set({ receiptReference: e.target.value })} maxLength={500} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </Field>
        {f.method === 'cartao_credito' && (
          <Callout tone="info" className="sm:col-span-2">
            Valores no cartão de crédito ficam como <strong>programados</strong> até a confirmação do recebimento de cada parcela —
            o sistema não confunde valor parcelado com dinheiro em caixa.
          </Callout>
        )}
      </div>
    </Modal>
  );
}
