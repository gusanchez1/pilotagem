import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from './Feedback.jsx';
import { cn } from './cn.js';

/**
 * Tabela de dados.
 * columns: [{ key, header, render?(row), align?, className?, hideOn? ('sm'|'md'|'lg') }]
 */
export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  onRowClick,
  rowKey = (r) => r._id,
  empty,
  footer,
  dense,
  rowClassName,
}) {
  const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };
  const align = { right: 'text-right', center: 'text-center' };

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-zinc-50/70">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'h-9 whitespace-nowrap text-left text-xs font-medium text-zinc-500 first:pl-5 last:pr-5',
                  dense ? 'px-3' : 'px-4',
                  align[c.align],
                  c.hideOn && hide[c.hideOn],
                  c.headerClassName,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line/70">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 first:pl-5 last:pr-5', c.hideOn && hide[c.hideOn])}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line/70 transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-zinc-50',
                    loading && 'opacity-60',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'align-middle text-zinc-800 first:pl-5 last:pr-5',
                        dense ? 'px-3' : 'px-4',
                        dense ? 'py-2' : 'py-3',
                        align[c.align],
                        c.hideOn && hide[c.hideOn],
                        c.className,
                      )}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {footer && rows?.length > 0 && <tfoot>{footer}</tfoot>}
      </table>
      {!loading && rows?.length === 0 && (empty || <EmptyState icon={Inbox} title="Nenhum registro encontrado" description="Ajuste os filtros ou cadastre um novo registro." />)}
    </div>
  );
}

export function Pagination({ page, pages, total, onChange, label = 'registros' }) {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-zinc-500">
      <span className="tabular">
        {total} {label}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="rounded-md p-1.5 hover:bg-zinc-100 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular px-1">
            {page} de {pages}
          </span>
          <button
            className="rounded-md p-1.5 hover:bg-zinc-100 disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
