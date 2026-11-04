import { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../components/ui/index.js';
import { addDays, minutesOfDay, monthGrid, toDateKey } from '../../utils/dates.js';
import { time, weekday } from '../../utils/format.js';

export const START_HOUR = 7;
export const END_HOUR = 23;
const HOUR_PX = 52;

const muted = (s) => ['cancelado', 'nao_compareceu'].includes(s);

function hexToRgba(hex, alpha) {
  const h = (hex || '#71717a').replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Distribui eventos sobrepostos em colunas lado a lado. */
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start) || new Date(b.end) - new Date(a.end));
  const out = [];
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = [];
    for (const ev of cluster) {
      let col = cols.findIndex((end) => end <= new Date(ev.start).getTime());
      if (col === -1) {
        col = cols.length;
        cols.push(0);
      }
      cols[col] = new Date(ev.end).getTime();
      out.push({ ev, col });
    }
    for (const item of out.slice(out.length - cluster.length)) item.cols = cols.length;
    cluster = [];
  };
  for (const ev of sorted) {
    const s = new Date(ev.start).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, new Date(ev.end).getTime());
  }
  if (cluster.length) flush();
  return out;
}

function EventBlock({ ev, style, onClick, compact }) {
  const color = ev.instructor?.color || '#71717a';
  const m = muted(ev.status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(ev);
      }}
      className={cn(
        'absolute overflow-hidden rounded-[5px] border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow hover:z-10 hover:shadow-pop',
        m && 'opacity-50',
      )}
      style={{ ...style, borderColor: color, background: hexToRgba(color, m ? 0.06 : 0.12) }}
      title={`${time(ev.start)}–${time(ev.end)} · ${ev.client?.displayName} · ${ev.service?.name}`}
    >
      <p className={cn('truncate font-semibold text-zinc-900', m && 'line-through')}>
        {ev.client?.confidential && <Lock className="mr-0.5 inline size-2.5" />}
        {ev.client?.displayName}
      </p>
      {!compact && (
        <>
          <p className="truncate text-zinc-600">{ev.service?.name}</p>
          <p className="truncate tabular text-zinc-500">
            {time(ev.start)}–{time(ev.end)}
          </p>
        </>
      )}
    </button>
  );
}

function NowLine({ dayKey }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  if (toDateKey(now) !== dayKey) return null;
  const min = minutesOfDay(now) - START_HOUR * 60;
  if (min < 0 || min > (END_HOUR - START_HOUR) * 60) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (min / 60) * HOUR_PX }}>
      <div className="relative h-px bg-red-500">
        <span className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

/** Visão de dia/semana com grade de horários. */
export function TimeGrid({ days, events, onEventClick, onSlotClick }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const byDay = useMemo(() => {
    const map = Object.fromEntries(days.map((d) => [d, []]));
    for (const ev of events) {
      const k = toDateKey(ev.start);
      if (map[k]) map[k].push(ev);
    }
    return map;
  }, [days, events]);
  const today = toDateKey();
  const compact = days.length > 1;

  return (
    <div className="overflow-x-auto scroll-thin">
      <div style={{ minWidth: days.length > 1 ? 820 : 0 }}>
        <div className="sticky top-0 z-20 grid border-b border-line bg-white" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <div key={d} className="border-l border-line px-2 py-2 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{weekday(`${d}T12:00:00Z`)}</p>
              <p
                className={cn(
                  'mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular',
                  d === today ? 'bg-brand text-ink' : 'text-zinc-900',
                )}
              >
                {Number(d.slice(8))}
              </p>
            </div>
          ))}
        </div>
        <div className="relative grid pt-2" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="relative pr-2 text-right text-[11px] tabular text-zinc-400" style={{ height: HOUR_PX }}>
                <span className="relative -top-2">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l border-line">
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => onSlotClick?.(d, `${String(h).padStart(2, '0')}:00`)}
                  className={cn('border-b border-line/70', onSlotClick && 'cursor-pointer hover:bg-zinc-50')}
                  style={{ height: HOUR_PX }}
                />
              ))}
              <NowLine dayKey={d} />
              {layoutDay(byDay[d] || []).map(({ ev, col, cols }) => {
                const startMin = Math.max(0, minutesOfDay(ev.start) - START_HOUR * 60);
                const endMin = toDateKey(ev.end) === d ? minutesOfDay(ev.end) - START_HOUR * 60 : (END_HOUR - START_HOUR) * 60;
                const top = (startMin / 60) * HOUR_PX;
                const height = Math.max(22, ((Math.min(endMin, (END_HOUR - START_HOUR) * 60) - startMin) / 60) * HOUR_PX - 2);
                return (
                  <EventBlock
                    key={ev._id}
                    ev={ev}
                    compact={compact && height < 40}
                    onClick={onEventClick}
                    style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Visão mensal. */
export function MonthGrid({ cursor, events, onEventClick, onDayClick }) {
  const days = monthGrid(cursor);
  const month = cursor.slice(0, 7);
  const today = toDateKey();
  const byDay = useMemo(() => {
    const map = {};
    for (const ev of events) (map[toDateKey(ev.start)] ??= []).push(ev);
    for (const k of Object.keys(map)) map[k].sort((a, b) => new Date(a.start) - new Date(b.start));
    return map;
  }, [events]);

  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-line bg-zinc-50/70">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const list = byDay[d] || [];
            const visible = list.filter((e) => !muted(e.status));
            return (
              <div
                key={d}
                onClick={() => onDayClick(d)}
                className={cn('min-h-28 cursor-pointer border-b border-r border-line p-1.5 transition-colors hover:bg-zinc-50', d.slice(0, 7) !== month && 'bg-zinc-50/60')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-medium tabular',
                      d === today ? 'bg-brand font-semibold text-ink' : d.slice(0, 7) !== month ? 'text-zinc-400' : 'text-zinc-700',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {visible.length > 0 && <span className="text-[10px] tabular text-zinc-400">{visible.length}</span>}
                </div>
                <div className="space-y-0.5">
                  {visible.slice(0, 3).map((ev) => (
                    <button
                      key={ev._id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-zinc-100"
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: ev.instructor?.color || '#a1a1aa' }} />
                      <span className="tabular text-zinc-500">{time(ev.start)}</span>
                      <span className="truncate text-zinc-800">{ev.client?.displayName}</span>
                    </button>
                  ))}
                  {visible.length > 3 && <p className="px-1 text-[11px] font-medium text-zinc-500">+{visible.length - 3} mais</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function weekDays(cursor) {
  return Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
}
