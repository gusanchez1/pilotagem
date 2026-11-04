/**
 * Convenções de gráficos (skill de dataviz):
 *  - cores por função: série 1 = azul, série 2 = laranja (paleta validada para daltonismo);
 *    série única = tinta (cor da marca); amarelo da marca NÃO é usado como dado (contraste baixo).
 *  - marcas finas, cantos de 4px no topo das barras, grade horizontal recessiva;
 *  - legenda sempre presente com ≥ 2 séries; tooltip em todos os gráficos;
 *  - texto sempre em tons de cinza, nunca na cor da série.
 */
export const SERIES = {
  received: '#2a78d6',
  expenses: '#eb6834',
  ink: '#27272a',
  inkSoft: '#a1a1aa',
};

export const axisProps = {
  tick: { fontSize: 11, fill: '#71717a' },
  tickLine: false,
  axisLine: false,
};

export const gridProps = { stroke: '#ededeb', vertical: false };

export function ChartTooltip({ active, payload, label, formatter = (v) => v, labelFormatter = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium text-zinc-900">{labelFormatter(label, payload)}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="size-2 rounded-sm" style={{ background: p.color || p.payload?.fill }} />
              {p.name}
            </span>
            <span className="font-medium tabular text-zinc-900">{formatter(p.value, p)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.line ? (
            <span className="h-0.5 w-3 rounded" style={{ background: it.color }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontais simples em HTML — mais legíveis que pizza para categorias. */
export function BarList({ items, valueFormatter, color = SERIES.ink, emptyText = 'Sem dados no período.' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!items.length) return <p className="py-8 text-center text-sm text-zinc-500">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} className="group" title={`${it.label}: ${valueFormatter(it.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-zinc-700">{it.label}</span>
            <span className="shrink-0 tabular text-zinc-900">
              {valueFormatter(it.value)}
              <span className="ml-1.5 text-xs text-zinc-400">{total ? Math.round((it.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-2 rounded-full transition-[width] duration-500 group-hover:opacity-80"
              style={{ width: `${(it.value / max) * 100}%`, background: it.color || color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
