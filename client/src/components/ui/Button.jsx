import { forwardRef } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cn } from './cn.js';

const VARIANTS = {
  primary:
    'bg-brand text-ink hover:bg-brand-hover active:bg-brand-press shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] font-semibold',
  dark: 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 font-medium',
  secondary: 'bg-white text-zinc-800 border border-line-strong hover:bg-zinc-50 hover:border-zinc-300 font-medium shadow-card',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-300 font-medium',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700 font-medium',
};

const SIZES = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  icon: 'size-8 justify-center rounded-md',
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, className, children, to, ...props },
  ref,
) {
  const classes = cn(
    'inline-flex shrink-0 select-none items-center whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} /> : null}
      {children}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
});
