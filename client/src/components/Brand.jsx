import symbol from '../assets/brand/simbolo-amarelo.png';
import { cn } from './ui/cn.js';

/**
 * Marca do produto: símbolo Pilotech (proporção original 600×348 preservada) + nome PILOTAGEM.
 */
export function Brand({ className, size = 'md', tagline }) {
  const h = size === 'lg' ? 'h-7' : 'h-[18px]';
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={symbol} alt="" className={cn(h, 'w-auto')} />
      <div className="leading-none">
        <span
          className={cn(
            'font-display font-bold italic tracking-[0.06em] text-white',
            size === 'lg' ? 'text-2xl' : 'text-[15px]',
          )}
        >
          PILOTAGEM
        </span>
        {tagline && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{tagline}</p>}
      </div>
    </div>
  );
}
