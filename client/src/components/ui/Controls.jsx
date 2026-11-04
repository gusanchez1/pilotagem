import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, Check, Loader2, Lock, Plus, Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { periodPresets } from '../../utils/dates.js';
import { cn } from './cn.js';
import { DateInput, Input, Select } from './Field.jsx';

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className }) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-line-strong bg-white pl-9 pr-8 text-sm shadow-card placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700" aria-label="Limpar busca">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Filtro de período: presets + intervalo personalizado. value = { from, to, preset } */
export function PeriodFilter({ value, onChange, presets = ['mes', 'anterior', '30d', '90d', '6m', 'ano'] }) {
  const all = useMemo(() => periodPresets(), []);
  const list = all.filter((p) => presets.includes(p.id));
  const custom = value.preset === 'custom';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <Select
          aria-label="Período"
          value={value.preset}
          onChange={(e) => {
            const p = all.find((x) => x.id === e.target.value);
            onChange(p ? { from: p.from, to: p.to, preset: p.id } : { ...value, preset: 'custom' });
          }}
          options={[...list.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Personalizado…' }]}
        />
      </div>
      {custom && (
        <div className="flex items-center gap-1.5">
          <CalendarRange className="size-4 text-zinc-400" />
          <DateInput className="w-[150px]" value={value.from} onChange={(v) => v && onChange({ ...value, from: v })} aria-label="Data inicial"/>
          <span className="text-zinc-400">até</span>
          <DateInput className="w-[150px]" value={value.to} onChange={(v) => v && onChange({ ...value, to: v })} aria-label="Data final"/>
        </div>
      )}
    </div>
  );
}

export function usePeriod(presetId = 'mes') {
  const initial = periodPresets().find((p) => p.id === presetId);
  return useState({ from: initial.from, to: initial.to, preset: presetId });
}

/**
 * Seleção de cliente com busca no servidor (respeita confidencialidade).
 * value: objeto cliente ({ _id, displayName, ... }) ou null.
 */
export function ClientPicker({ value, onChange, onCreateNew, invalid, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const anchor = useRef(null);
  const debounced = useDebounce(q, 250);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .get('/clients', { params: { q: debounced || undefined, limit: 8 } })
      .then((r) => !cancelled && setItems(r.data.items))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => setRect(anchor.current?.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const choose = (c) => {
    onChange(c);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={anchor} className="relative">
      {value && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-white px-3 text-left text-sm shadow-card hover:border-zinc-300',
            invalid && 'border-red-400',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value.confidential && <Lock className="size-3.5 shrink-0 text-zinc-500" />}
            <span className="truncate font-medium">{value.displayName}</span>
            <span className="text-xs text-zinc-400">{value.code}</span>
          </span>
          {!disabled && <span className="text-xs text-zinc-500">Trocar</span>}
        </button>
      ) : (
        <Input
          prefix={<Search className="size-4" />}
          invalid={invalid}
          autoFocus={open}
          disabled={disabled}
          placeholder="Buscar cliente por nome, telefone ou código…"
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            if (e.key === 'Enter' && items[active]) {
              e.preventDefault();
              choose(items[active]);
            }
          }}
        />
      )}
      {open &&
        rect &&
        createPortal(
          <div
            className="fixed z-[60] max-h-72 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-pop scroll-thin"
            style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && items.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">Nenhum cliente encontrado.</p>}
            {items.map((c, i) => (
              <button
                key={c._id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
                className={cn('flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm', i === active && 'bg-zinc-100')}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.confidential && <Lock className="size-3.5 shrink-0 text-zinc-500" />}
                  <span className="truncate">{c.displayName}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400 tabular">{c.phone || c.phoneMasked || c.code}</span>
                {value?._id === c._id && <Check className="size-4 text-zinc-900" />}
              </button>
            ))}
            {onCreateNew && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateNew(q);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-line px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                <Plus className="size-4" /> Cadastrar novo cliente{q ? ` “${q}”` : ''}
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Menu suspenso simples. items: [{ label, icon, onClick, danger, hidden }] */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative">
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div className={cn('absolute z-40 mt-1 min-w-48 animate-pop-in rounded-lg border border-line bg-white p-1 shadow-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {visible.map((it) =>
            it.divider ? (
              <div key={it.label} className="my-1 border-t border-line" />
            ) : (
              <button
                key={it.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
                  it.danger ? 'text-red-700 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-100',
                )}
              >
                {it.icon && <it.icon className="size-4 opacity-70" />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
