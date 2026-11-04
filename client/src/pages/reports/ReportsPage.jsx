import { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  PeriodFilter,
  Select,
  Spinner,
  Toolbar,
  cn,
  usePeriod,
} from '../../components/ui/index.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCatalog } from '../../hooks/useCatalog.js';
import { downloadFile, errorMessage } from '../../services/api.js';
import { date, dateKeyLabel, dateTime, decimal, money, number, percent } from '../../utils/format.js';

const fmt = (value, type) => {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return money(value);
    case 'date':
      return date(value);
    case 'datetime':
      return dateTime(value);
    case 'percent':
      return percent(value);
    case 'hours':
      return `${decimal(value)} h`;
    case 'number':
      return number(value);
    default:
      return value;
  }
};
const numeric = (t) => ['money', 'number', 'percent', 'hours'].includes(t);

export default function ReportsPage() {
  const toast = useToast();
  const list = useApi('/reports', { initial: [] });
  const catalog = useCatalog({ include: ['services', 'instructors', 'categories'] });
  const [key, setKey] = useState(null);
  const [period, setPeriod] = usePeriod('mes');
  const [filters, setFilters] = useState({ category: '', service: '', instructor: '', status: '' });
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    if (!key && list.data.length) setKey(list.data[0].key);
  }, [list.data, key]);

  const report = list.data.find((r) => r.key === key);
  const params = report
    ? {
        ...(report.filters.includes('period') ? { from: period.from, to: period.to } : {}),
        ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && report.filters.includes(k))),
      }
    : null;
  const result = useApi(report ? `/reports/${report.key}` : null, { params });

  const exportAs = async (format) => {
    setExporting(format);
    try {
      await downloadFile(`/reports/${report.key}/export`, { ...params, format }, `relatorio.${format}`);
      toast.success(`Relatório exportado em ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const groups = [
    { id: 'financeiro', label: 'Financeiros' },
    { id: 'operacional', label: 'Operacionais' },
  ];

  const columns = (report?.columns || []).map((c) => ({
    key: c.key,
    header: c.label,
    align: numeric(c.type) ? 'right' : undefined,
    className: cn('whitespace-nowrap', numeric(c.type) && 'tabular'),
    headerClassName: 'whitespace-nowrap',
    render: (row) => (
      <span className={c.width >= 2 ? 'block max-w-[150px] truncate' : ''} title={c.width >= 2 ? String(row[c.key] ?? '') : undefined}>
        {fmt(row[c.key], c.type)}
      </span>
    ),
  }));

  const totals = result.data?.totals || {};
  const footer =
    Object.keys(totals).length > 0 ? (
      <tr className="border-t-2 border-line bg-zinc-50 font-semibold">
        {report.columns.map((c, i) => (
          <td key={c.key} className={cn('whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5', numeric(c.type) && 'text-right tabular')}>
            {c.key in totals ? fmt(totals[c.key], c.type) : i === 0 ? 'Total' : ''}
          </td>
        ))}
      </tr>
    ) : null;

  const selectReport = (k) => {
    setKey(k);
    setFilters({ category: '', service: '', instructor: '', status: '' });
  };

  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Relatórios gerenciais calculados a partir dos registros, com exportação em CSV e PDF."
        actions={
          <div className="w-full sm:w-80 2xl:hidden">
            <select
              aria-label="Escolher relatório"
              value={key || ''}
              onChange={(e) => selectReport(e.target.value)}
              className="h-9 w-full rounded-md border border-line-strong bg-white px-3 text-sm font-medium shadow-card focus:border-zinc-900 focus:outline-none"
            >
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {list.data.filter((r) => r.group === g.id).map((r) => (
                    <option key={r.key} value={r.key}>{r.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid gap-6 2xl:grid-cols-[220px_1fr]">
        <nav className="hidden space-y-5 2xl:block" aria-label="Relatórios">
          {groups.map((g) => {
            const items = list.data.filter((r) => r.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id}>
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{g.label}</p>
                <ul className="space-y-0.5">
                  {items.map((r) => (
                    <li key={r.key}>
                      <button
                        onClick={() => selectReport(r.key)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                          key === r.key ? 'bg-white font-medium text-zinc-950 shadow-card ring-1 ring-line' : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900',
                        )}
                      >
                        <FileText className={cn('size-3.5 shrink-0', key === r.key ? 'text-zinc-900' : 'text-zinc-400')} />
                        {r.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="min-w-0">
          {!report ? (
            <Spinner />
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">{report.title}</h2>
                  <p className="text-sm text-zinc-500">{report.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" icon={FileSpreadsheet} loading={exporting === 'csv'} onClick={() => exportAs('csv')} disabled={!result.data}>CSV</Button>
                  <Button variant="dark" icon={FileDown} loading={exporting === 'pdf'} onClick={() => exportAs('pdf')} disabled={!result.data}>PDF</Button>
                </div>
              </div>

              <Toolbar>
                {report.filters.includes('period') && <PeriodFilter value={period} onChange={setPeriod} />}
                {report.filters.includes('category') && (
                  <div className="w-52">
                    <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} placeholder="Todas as categorias" options={catalog.categories.filter((c) => (report.key === 'despesas' ? c.type === 'despesa' : c.type === 'receita')).map((c) => ({ value: c._id, label: c.name }))} aria-label="Categoria" />
                  </div>
                )}
                {report.filters.includes('service') && catalog.services.length > 0 && (
                  <div className="w-52">
                    <Select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })} placeholder="Todos os serviços" options={catalog.services.map((s) => ({ value: s._id, label: s.name }))} aria-label="Serviço" />
                  </div>
                )}
                {report.filters.includes('instructor') && catalog.instructors.length > 0 && (
                  <div className="w-48">
                    <Select value={filters.instructor} onChange={(e) => setFilters({ ...filters, instructor: e.target.value })} placeholder="Todos os instrutores" options={catalog.instructors.map((i) => ({ value: i._id, label: i.name }))} aria-label="Instrutor" />
                  </div>
                )}
                {report.filters.includes('status') && report.statusOptions && (
                  <div className="w-52">
                    <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} placeholder={report.statusLabel ? `${report.statusLabel}: padrão` : 'Status: padrão'} options={report.statusOptions} aria-label={report.statusLabel || 'Status'} />
                  </div>
                )}
              </Toolbar>

              <Card>
                <div className="flex items-center justify-between border-b border-line px-5 py-2.5 text-xs text-zinc-500">
                  <span>
                    {result.data?.period ? `Período: ${dateKeyLabel(result.data.period.from)} a ${dateKeyLabel(result.data.period.to)}` : 'Posição atual'}
                  </span>
                  <span className="tabular">{result.data ? `${result.data.rows.length} registro(s)` : ''}</span>
                </div>
                <DataTable
                  columns={columns}
                  rows={result.data?.rows?.map((r, i) => ({ ...r, _id: i }))}
                  loading={result.loading}
                  error={result.error}
                  onRetry={result.reload}
                  dense
                  footer={footer}
                  empty={<EmptyState title="Sem registros para os filtros selecionados" />}
                />
              </Card>
              <Callout tone="neutral" icon={ShieldCheck} className="mt-4">
                Clientes confidenciais aparecem apenas pelo nome de exibição. Cada exportação é registrada na auditoria.
              </Callout>
            </>
          )}
        </div>
      </div>
    </>
  );
}
