import { cn } from './cn.js';

export function PageHeader({ title, description, actions, children, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-zinc-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, padded = false, ...props }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface shadow-card', padded && 'p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className, icon: Icon }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-5 py-3.5', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="size-4 text-zinc-400" />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Indicador numérico. `accent` destaca o KPI principal com o traço inclinado da marca.
 */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', accent, loading, onClick }) {
  const toneClass = {
    default: 'text-zinc-950',
    positive: 'text-emerald-700',
    negative: 'text-red-700',
    warning: 'text-amber-700',
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-surface p-4 text-left shadow-card',
        onClick && 'transition-colors hover:border-zinc-300',
      )}
    >
      {accent && <span className="absolute left-0 top-0 h-[3px] w-14 origin-left skew-mark bg-brand" aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-500">{label}</p>
        {Icon && <Icon className="size-4 text-zinc-400" />}
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-28 animate-pulse rounded bg-zinc-200/70" />
      ) : (
        <p className={cn('mt-1.5 text-[22px] font-semibold tracking-tight tabular', toneClass)}>{value}</p>
      )}
      {hint && <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>}
    </Comp>
  );
}

export function DescriptionList({ items, columns = 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '')}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className={cn('min-w-0', it.full && 'sm:col-span-full')}>
          <dt className="text-xs font-medium text-zinc-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm text-zinc-900">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors',
            value === t.value ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count !== undefined && (
            <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] tabular text-zinc-600">{t.count}</span>
          )}
          {value === t.value && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zinc-900" />}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children, className }) {
  return <div className={cn('mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>;
}
