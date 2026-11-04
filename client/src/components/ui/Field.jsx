import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from './cn.js';

const control =
  'w-full rounded-md border border-line-strong bg-white px-3 text-sm text-zinc-900 shadow-card transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500';

export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-700">
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, prefix, ...props }, ref) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">{prefix}</span>
        <input ref={ref} className={cn(control, 'h-9 pl-9', invalid && 'border-red-400', className)} {...props} />
      </div>
    );
  }
  return <input ref={ref} className={cn(control, 'h-9', invalid && 'border-red-400', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-2 leading-relaxed', invalid && 'border-red-400', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, invalid, options = [], placeholder, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-9 appearance-none pr-8', invalid && 'border-red-400', className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
});

/**
 * Data no formato DD/MM/AAAA, independente do idioma do navegador/sistema.
 * value/onChange usam a chave 'AAAA-MM-DD'. O botão abre o calendário nativo.
 */
export function DateInput({ value, onChange, className, invalid, ...props }) {
  const toText = (key) => (key ? key.split('-').reverse().join('/') : '');
  const [text, setText] = useState(toText(value));
  const picker = useRef(null);
  useEffect(() => setText(toText(value)), [value]);

  const onType = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    const masked = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    setText(masked);
    if (d.length === 8) {
      const key = `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
      const dt = new Date(`${key}T12:00:00Z`);
      if (!Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === key) onChange(key);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        className={cn(control, 'h-9 pr-9 tabular', invalid && 'border-red-400')}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => setText(toText(value))}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => picker.current?.showPicker?.()}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-400 hover:text-zinc-700"
        aria-label="Abrir calendário"
      >
        <Calendar className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={value || ''}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </div>
  );
}

const TIME_SLOTS = Array.from({ length: (24 - 6) * 4 }, (_, i) => {
  const m = 6 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

/** Horário em 24h (intervalos de 15 min), independente do idioma do navegador. */
export function TimeInput({ value, onChange, className, invalid, ...props }) {
  const slots = value && !TIME_SLOTS.includes(value) ? [...TIME_SLOTS, value].sort() : TIME_SLOTS;
  return (
    <Select
      className={cn('tabular', className)}
      invalid={invalid}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={slots.map((t) => ({ value: t, label: t }))}
      {...props}
    />
  );
}

/** Campo monetário: valor em CENTAVOS; digitação preenche da direita para a esquerda. */
export function MoneyInput({ value, onChange, className, invalid, ...props }) {
  const display = ((value || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400">R$</span>
      <input
        inputMode="numeric"
        className={cn(control, 'h-9 pl-9 text-right tabular', invalid && 'border-red-400', className)}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
          onChange(Number(digits || 0));
        }}
        onFocus={(e) => requestAnimationFrame(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length))}
        {...props}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-zinc-900' : 'bg-zinc-300',
        )}
      >
        <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-zinc-800">{label}</span>}
          {description && <span className="text-xs text-zinc-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-zinc-300 accent-zinc-900"
      />
      <span className="flex flex-col">
        <span className="text-sm text-zinc-800">{label}</span>
        {description && <span className="text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  );
}

/** Grupo de botões segmentados (ex.: Dia/Semana/Mês). */
export function Segmented({ value, onChange, options, size = 'md' }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-white p-0.5 shadow-card" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
