import { useEffect, useMemo, useState } from 'react';
import { Clock, Layers, Package as PackageIcon, Pencil, Plus, Power, Trash2, UserRound } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  Segmented,
  Select,
  Spinner,
  Tabs,
  Textarea,
  Toggle,
  cn,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useCatalog } from '../../hooks/useCatalog.js';
import { api, errorMessage } from '../../services/api.js';
import { minutesLabel, money } from '../../utils/format.js';
import { RESOURCE_CATEGORY, options } from '../../utils/labels.js';

/* ───────────────────────────── Serviços ───────────────────────────── */

const emptyService = {
  name: '',
  category: '',
  description: '',
  durationMinutes: 60,
  basePrice: 0,
  pricingMode: 'fixo',
  priceTiers: [],
  quantityLabel: 'simulador',
  requiresInstructor: false,
  requiresRoom: true,
  requiredResources: [],
  compatibleRooms: [],
  priceNote: '',
  active: true,
};

function ServiceForm({ open, onClose, service, rooms, categories, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(emptyService);
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!open) return;
    setF(
      service
        ? {
            ...emptyService,
            ...service,
            compatibleRooms: (service.compatibleRooms || []).map((r) => r._id || r),
            priceTiers: service.priceTiers.map((t) => ({ ...t })),
            requiredResources: service.requiredResources.map((r) => ({ ...r })),
          }
        : emptyService,
    );
  }, [open, service]);

  const submit = async () => {
    if (!f.name.trim() || !f.category.trim()) return toast.error('Informe nome e categoria.');
    if (f.pricingMode === 'por_quantidade' && !f.priceTiers.length) return toast.error('Cadastre ao menos uma faixa de preço.');
    setBusy(true);
    const payload = {
      name: f.name,
      category: f.category,
      description: f.description,
      durationMinutes: f.durationMinutes === null || f.durationMinutes === '' ? null : Number(f.durationMinutes),
      basePrice: f.pricingMode === 'por_quantidade' ? f.priceTiers[0]?.price ?? 0 : f.basePrice,
      pricingMode: f.pricingMode,
      priceTiers: f.pricingMode === 'por_quantidade' ? f.priceTiers.map((t) => ({ quantity: Number(t.quantity), price: t.price, label: t.label || `${t.quantity} ${f.quantityLabel}` })) : [],
      quantityLabel: f.quantityLabel,
      requiresInstructor: f.requiresInstructor,
      requiresRoom: f.requiresRoom,
      requiredResources: f.requiredResources.map((r) => ({ category: r.category, quantity: Number(r.quantity) })),
      compatibleRooms: f.compatibleRooms,
      priceNote: f.priceNote,
      active: f.active,
    };
    try {
      if (service) await api.put(`/services/${service._id}`, payload);
      else await api.post('/services', payload);
      toast.success(service ? 'Serviço atualizado.' : 'Serviço cadastrado.', 'Vendas anteriores mantêm o preço da época.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tiers = f.priceTiers;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={service ? `Editar serviço` : 'Novo serviço'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit} loading={busy}>Salvar serviço</Button></>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome" required><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Categoria / modalidade" required hint="Usada no relatório de vendas por modalidade.">
          <Input list="svc-categories" value={f.category} onChange={(e) => set({ category: e.target.value })} />
          <datalist id="svc-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Descrição" className="md:col-span-2"><Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} rows={2} /></Field>
        <Field label="Duração padrão (minutos)">
          <div className="flex items-center gap-3">
            <Input type="number" min={0} step={15} className="w-32" value={f.durationMinutes ?? ''} disabled={f.durationMinutes === null} onChange={(e) => set({ durationMinutes: e.target.value === '' ? '' : Number(e.target.value) })} />
            <Checkbox checked={f.durationMinutes === null} onChange={(v) => set({ durationMinutes: v ? null : 60 })} label="Não informada" />
          </div>
        </Field>
        <Field label="Regra de preço">
          <Segmented value={f.pricingMode} onChange={(v) => set({ pricingMode: v, priceTiers: v === 'por_quantidade' && !tiers.length ? [{ quantity: 1, price: f.basePrice, label: '' }] : tiers })} options={[{ value: 'fixo', label: 'Preço fixo' }, { value: 'por_quantidade', label: 'Por quantidade' }]} />
        </Field>

        {f.pricingMode === 'fixo' ? (
          <Field label="Preço de referência" className="md:col-span-2 md:max-w-xs"><MoneyInput value={f.basePrice} onChange={(v) => set({ basePrice: v })} /></Field>
        ) : (
          <div className="rounded-lg border border-line p-4 md:col-span-2">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Faixas de preço por quantidade</p>
                <p className="text-xs text-zinc-500">Cada valor é o preço TOTAL da opção (não multiplicado por unidade ou hora).</p>
              </div>
              <Field label="Unidade"><Input className="w-36" value={f.quantityLabel} onChange={(e) => set({ quantityLabel: e.target.value })} /></Field>
            </div>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_160px_auto] items-center gap-2">
                  <Input type="number" min={1} value={t.quantity} onChange={(e) => set({ priceTiers: tiers.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)) })} aria-label="Quantidade" />
                  <Input value={t.label} placeholder={`${t.quantity} ${f.quantityLabel}`} onChange={(e) => set({ priceTiers: tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Rótulo" />
                  <MoneyInput value={t.price} onChange={(v) => set({ priceTiers: tiers.map((x, j) => (j === i ? { ...x, price: v } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => set({ priceTiers: tiers.filter((_, j) => j !== i) })} aria-label="Remover faixa"><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => set({ priceTiers: [...tiers, { quantity: (tiers.at(-1)?.quantity || 0) + 1, price: 0, label: '' }] })}>Adicionar faixa</Button>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-line bg-zinc-50/60 p-4 md:col-span-2">
          <Toggle checked={f.requiresInstructor} onChange={(v) => set({ requiresInstructor: v })} label="Exige instrutor" />
          <Toggle checked={f.requiresRoom} onChange={(v) => set({ requiresRoom: v })} label="Exige sala" />
          <Field label="Salas compatíveis">
            <div className="flex flex-wrap gap-1.5">
              {rooms.map((r) => {
                const on = f.compatibleRooms.includes(r._id);
                return (
                  <button key={r._id} type="button" onClick={() => set({ compatibleRooms: on ? f.compatibleRooms.filter((x) => x !== r._id) : [...f.compatibleRooms, r._id] })} className={cn('rounded-md border px-2.5 py-1.5 text-xs font-medium', on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-line-strong bg-white text-zinc-700 hover:border-zinc-400')}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Recursos necessários" hint={f.pricingMode === 'por_quantidade' ? 'Para simuladores, a quantidade escolhida na venda/agendamento prevalece.' : undefined}>
            <div className="space-y-2">
              {f.requiredResources.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-52"><Select value={r.category} onChange={(e) => set({ requiredResources: f.requiredResources.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })} options={options(RESOURCE_CATEGORY)} /></div>
                  <Input type="number" min={1} className="w-20" value={r.quantity} onChange={(e) => set({ requiredResources: f.requiredResources.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => set({ requiredResources: f.requiredResources.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => set({ requiredResources: [...f.requiredResources, { category: 'simulador', quantity: 1 }] })}>Adicionar recurso</Button>
            </div>
          </Field>
        </div>
        <Field label="Observação sobre o preço" className="md:col-span-2"><Input value={f.priceNote} onChange={(e) => set({ priceNote: e.target.value })} placeholder="Ex.: valor de referência do site, não confirmado" /></Field>
        <Toggle checked={f.active} onChange={(v) => set({ active: v })} label="Serviço ativo" description="Serviços inativos não aparecem para novos agendamentos e vendas." />
      </div>
    </Modal>
  );
}

function ServicesTab({ catalog, isAdmin }) {
  const toast = useToast();
  const [form, setForm] = useState({ open: false });
  const categories = useMemo(() => [...new Set(catalog.services.map((s) => s.category))], [catalog.services]);
  const toggle = async (s) => {
    try {
      await api.patch(`/services/${s._id}/status`, { active: !s.active });
      toast.success(s.active ? 'Serviço desativado.' : 'Serviço ativado.');
      catalog.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const columns = [
    {
      key: 'name',
      header: 'Serviço',
      render: (s) => (
        <div className="max-w-sm">
          <p className="font-medium text-zinc-900">{s.name}</p>
          <p className="line-clamp-1 text-xs text-zinc-500">{s.description}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Modalidade', hideOn: 'md', render: (s) => <Badge tone="zinc" dot={false}>{s.category}</Badge> },
    { key: 'dur', header: 'Duração', hideOn: 'sm', render: (s) => <span className="flex items-center gap-1 text-zinc-600"><Clock className="size-3.5" />{minutesLabel(s.durationMinutes)}</span> },
    {
      key: 'price',
      header: 'Preço de referência',
      render: (s) =>
        s.pricingMode === 'por_quantidade' ? (
          <div className="flex flex-wrap gap-1">
            {s.priceTiers.map((t) => (
              <span key={t.quantity} className="rounded border border-line px-1.5 py-0.5 text-[11px] tabular text-zinc-700">{t.quantity}× {money(t.price)}</span>
            ))}
          </div>
        ) : (
          <span className="tabular font-medium">{money(s.basePrice)}</span>
        ),
    },
    {
      key: 'req',
      header: 'Requisitos',
      hideOn: 'lg',
      render: (s) => (
        <div className="flex flex-wrap gap-1 text-xs text-zinc-600">
          {s.requiresInstructor && <Badge tone="blue" dot={false}><UserRound className="size-3" /> Instrutor</Badge>}
          {s.requiredResources.map((r) => <Badge key={r.category} tone="zinc" dot={false}>{r.quantity}× {RESOURCE_CATEGORY[r.category]}</Badge>)}
          {s.compatibleRooms.map((r) => <Badge key={r._id} tone="zinc" dot={false}>{r.code}</Badge>)}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (s) => (s.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="zinc">Inativo</Badge>) },
    isAdmin && {
      key: 'act',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, service: s })} aria-label="Editar"><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => toggle(s)} aria-label={s.active ? 'Desativar' : 'Ativar'}><Power className="size-4" /></Button>
        </div>
      ),
    },
  ].filter(Boolean);
  return (
    <>
      {isAdmin && <div className="mb-3 flex justify-end"><Button variant="primary" icon={Plus} onClick={() => setForm({ open: true })}>Novo serviço</Button></div>}
      <Callout tone="neutral" className="mb-4">
        Preços iniciais obtidos nos sites públicos da Pilotech e da Racing Room, ainda não confirmados como tabela comercial. Alterações de preço não afetam vendas já registradas.
      </Callout>
      <Card><DataTable columns={columns} rows={catalog.services} loading={catalog.loading} rowClassName={(s) => (!s.active ? 'opacity-60' : '')} /></Card>
      <ServiceForm open={form.open} service={form.service} rooms={catalog.rooms} categories={categories} onClose={() => setForm({ open: false })} onSaved={catalog.reload} />
    </>
  );
}

/* ───────────────────────────── Pacotes ───────────────────────────── */

function PackageForm({ open, onClose, pkg, services, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    if (!open) return;
    setF(
      pkg
        ? { name: pkg.name, description: pkg.description, items: pkg.items.map((i) => ({ service: i.service?._id || i.service, quantity: i.quantity, durationMinutes: i.durationMinutes, unitPrice: i.unitPrice })), simulatorCount: pkg.simulatorCount, price: pkg.price, validityDays: pkg.validityDays, active: pkg.active }
        : { name: '', description: '', items: [], simulatorCount: 1, price: 0, validityDays: 90, active: true },
    );
  }, [open, pkg]);
  const items = f.items || [];
  const reference = items.reduce((a, i) => a + i.quantity * (i.unitPrice || 0), 0);
  const totalMin = items.reduce((a, i) => a + (i.durationMinutes || 0) * i.quantity, 0);

  const submit = async () => {
    if (!f.name?.trim() || !items.length || items.some((i) => !i.service)) return toast.error('Informe nome e ao menos um serviço.');
    setBusy(true);
    try {
      const payload = { ...f, validityDays: f.validityDays || null, items: items.map((i) => ({ ...i, durationMinutes: i.durationMinutes || null })) };
      if (pkg) await api.put(`/packages/${pkg._id}`, payload);
      else await api.post('/packages', payload);
      toast.success('Pacote salvo.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={pkg ? 'Editar pacote' : 'Novo pacote'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit} loading={busy}>Salvar pacote</Button></>}>
      <div className="space-y-4">
        <Field label="Nome" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Descrição"><Textarea rows={2} value={f.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700">Serviços incluídos</p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 sm:grid-cols-[1fr_70px_90px_140px_auto] sm:items-center">
                <Select
                  value={it.service}
                  placeholder="Serviço…"
                  onChange={(e) => {
                    const s = services.find((x) => x._id === e.target.value);
                    set({ items: items.map((x, j) => (j === i ? { ...x, service: e.target.value, unitPrice: s?.basePrice ?? 0, durationMinutes: s?.durationMinutes ?? null } : x)) });
                  }}
                  options={services.map((s) => ({ value: s._id, label: s.name }))}
                  aria-label="Serviço"
                />
                <Input type="number" min={1} value={it.quantity} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 1 } : x)) })} aria-label="Quantidade" title="Quantidade" />
                <Input type="number" min={0} step={15} value={it.durationMinutes ?? ''} placeholder="min" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, durationMinutes: e.target.value ? Number(e.target.value) : null } : x)) })} aria-label="Duração (min)" title="Duração de cada atividade (min)" />
                <MoneyInput value={it.unitPrice} onChange={(v) => set({ items: items.map((x, j) => (j === i ? { ...x, unitPrice: v } : x)) })} />
                <Button size="icon" variant="ghost" onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => set({ items: [...items, { service: '', quantity: 1, durationMinutes: null, unitPrice: 0 }] })}>Adicionar serviço</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Qtd. de simuladores"><Input type="number" min={0} value={f.simulatorCount ?? 0} onChange={(e) => set({ simulatorCount: Number(e.target.value) })} /></Field>
          <Field label="Validade (dias)"><Input type="number" min={0} value={f.validityDays ?? ''} onChange={(e) => set({ validityDays: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Preço do pacote" required><MoneyInput value={f.price || 0} onChange={(v) => set({ price: v })} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
          <div><p className="text-xs text-zinc-500">Preço de referência</p><p className="font-medium tabular">{money(reference)}</p></div>
          <div><p className="text-xs text-zinc-500">Desconto</p><p className={cn('font-medium tabular', reference - (f.price || 0) > 0 ? 'text-emerald-700' : '')}>{money(reference - (f.price || 0))}</p></div>
          <div><p className="text-xs text-zinc-500">Duração total</p><p className="font-medium tabular">{totalMin ? minutesLabel(totalMin) : '—'}</p></div>
        </div>
        <Toggle checked={Boolean(f.active)} onChange={(v) => set({ active: v })} label="Pacote ativo" />
      </div>
    </Modal>
  );
}

function PackagesTab({ catalog, isAdmin }) {
  const toast = useToast();
  const [form, setForm] = useState({ open: false });
  const toggle = async (p) => {
    try {
      await api.patch(`/packages/${p._id}/status`, { active: !p.active });
      catalog.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  if (catalog.loading && !catalog.packages.length) return <Spinner />;
  return (
    <>
      {isAdmin && <div className="mb-3 flex justify-end"><Button variant="primary" icon={Plus} onClick={() => setForm({ open: true })}>Novo pacote</Button></div>}
      {!catalog.packages.length && <Card><EmptyState icon={PackageIcon} title="Nenhum pacote cadastrado" /></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.packages.map((p) => (
          <Card key={p._id} className={cn('flex flex-col', !p.active && 'opacity-60')}>
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-zinc-950">{p.name}</h3>
                {p.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="zinc">Inativo</Badge>}
              </div>
              <p className="mt-1 text-sm text-zinc-500">{p.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.items.map((it) => (
                  <li key={it._id} className="flex justify-between gap-2">
                    <span className="text-zinc-700">{it.quantity}× {it.service?.name}</span>
                    <span className="tabular text-zinc-500">{money(it.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="zinc" dot={false}>{p.simulatorCount} simulador(es)</Badge>
                {p.totalDurationMinutes && <Badge tone="zinc" dot={false}>{minutesLabel(p.totalDurationMinutes)} no total</Badge>}
                {p.validityDays && <Badge tone="zinc" dot={false}>Validade {p.validityDays} dias</Badge>}
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-line px-5 py-3">
              <div>
                {p.discount > 0 && <p className="text-xs tabular text-zinc-400 line-through">{money(p.referencePrice)}</p>}
                <p className="text-lg font-semibold tabular text-zinc-950">{money(p.price)}</p>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, pkg: p })} aria-label="Editar"><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => toggle(p)} aria-label="Ativar/desativar"><Power className="size-4" /></Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <PackageForm open={form.open} pkg={form.pkg} services={catalog.services.filter((s) => s.active)} onClose={() => setForm({ open: false })} onSaved={catalog.reload} />
    </>
  );
}

export default function CatalogPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('servicos');
  const catalog = useCatalog({ include: ['services', 'packages', 'rooms'] });
  const isAdmin = can('catalog:manage');
  return (
    <>
      <PageHeader title="Serviços e pacotes" description="Catálogo de modalidades, regras de preço e pacotes comerciais — editável sem alterar código." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'servicos', label: 'Serviços', icon: Layers, count: catalog.services.length }, { value: 'pacotes', label: 'Pacotes', icon: PackageIcon, count: catalog.packages.length }]} />
      {tab === 'servicos' ? <ServicesTab catalog={catalog} isAdmin={isAdmin} /> : <PackagesTab catalog={catalog} isAdmin={isAdmin} />}
    </>
  );
}
