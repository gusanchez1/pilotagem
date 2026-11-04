import { AlertCircle, AlertTriangle, Info, Loader2, Lock, RefreshCcw } from 'lucide-react';
import { cn } from './cn.js';

const TONES = {
  zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  brand: 'bg-brand-soft text-zinc-900 ring-yellow-300',
};
const DOTS = {
  zinc: 'bg-zinc-400',
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  brand: 'bg-yellow-400',
};

export function Badge({ tone = 'zinc', dot = true, children, className }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

/** Badge a partir de um mapa { valor: { label, tone } } */
export function StatusBadge({ map, value, className }) {
  const item = map[value];
  if (!item) return null;
  return (
    <Badge tone={item.tone} className={className}>
      {item.label}
    </Badge>
  );
}

export function ConfidentialTag({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand', className)} title="Cliente confidencial">
      <Lock className="size-2.5" /> Confidencial
    </span>
  );
}

export function Spinner({ className, label = 'Carregando…' }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-sm text-zinc-500', className)} role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded bg-zinc-200/70', className)} />;
}

export function EmptyState({ icon: Icon = Info, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-line bg-zinc-50">
        <Icon className="size-5 text-zinc-400" />
      </div>
      <p className="font-medium text-zinc-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)} role="alert">
      <AlertCircle className="mb-2 size-6 text-red-500" />
      <p className="font-medium text-zinc-900">Não foi possível carregar</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 underline-offset-4 hover:underline">
          <RefreshCcw className="size-3.5" /> Tentar novamente
        </button>
      )}
    </div>
  );
}

const ALERT_TONES = {
  info: { box: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info, iconColor: 'text-blue-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconColor: 'text-amber-600' },
  danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: AlertCircle, iconColor: 'text-red-600' },
  neutral: { box: 'border-line bg-zinc-50 text-zinc-800', icon: Info, iconColor: 'text-zinc-500' },
};

export function Callout({ tone = 'info', title, children, className, icon }) {
  const t = ALERT_TONES[tone];
  const Icon = icon || t.icon;
  return (
    <div className={cn('flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm', t.box, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', t.iconColor)} />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}
