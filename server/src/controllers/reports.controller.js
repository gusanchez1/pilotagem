import { LABELS } from '../config/constants.js';
import { FinancialCategory, Instructor, Service } from '../models/index.js';
import { audit } from '../services/audit.service.js';
import { buildDashboard } from '../services/dashboard.service.js';
import { computeTotals, findReport, REPORTS } from '../services/reports/registry.js';
import { toCSV, toPDF } from '../services/reports/exporters.js';
import { getSettings } from '../services/settings.service.js';
import { AppError } from '../utils/AppError.js';
import { resolvePeriod } from '../utils/dates.js';

export async function getDashboard(req, res) {
  res.json(await buildDashboard(req.user, req.validQuery));
}

/** Relatórios disponíveis para o usuário (filtrados por permissão). */
export async function listReports(req, res) {
  const allowed = REPORTS.filter((r) => req.user.permissions.includes(r.permission));
  res.json(
    allowed.map(({ key, title, description, group, filters, statusOptions, statusLabel, columns }) => ({
      key,
      title,
      description,
      group,
      filters,
      statusOptions,
      statusLabel,
      columns,
    })),
  );
}

async function runReport(req) {
  const report = findReport(req.validParams.key);
  if (!report) throw AppError.notFound('Relatório não encontrado.');
  if (!req.user.permissions.includes(report.permission)) throw AppError.forbidden('Você não tem acesso a este relatório.');

  const q = req.validQuery;
  const period = resolvePeriod(q.from, q.to);
  const filters = { ...q, ...period };
  const rows = await report.run(filters, { user: req.user, settings: await getSettings() });
  return {
    report,
    result: {
      key: report.key,
      title: report.title,
      period: report.filters.includes('period') ? { from: period.fromKey, to: period.toKey } : null,
      columns: report.columns,
      rows,
      totals: computeTotals(report, rows),
    },
  };
}

export async function getReport(req, res) {
  const { result } = await runReport(req);
  res.json(result);
}

async function describeFilters(q, report) {
  const parts = [];
  if (q.category) parts.push(`Categoria: ${(await FinancialCategory.findById(q.category).lean())?.name ?? '—'}`);
  if (q.service) parts.push(`Serviço: ${(await Service.findById(q.service).lean())?.name ?? '—'}`);
  if (q.instructor) parts.push(`Instrutor: ${(await Instructor.findById(q.instructor).lean())?.name ?? '—'}`);
  if (q.status && q.status !== 'todos') {
    const opt = report.statusOptions?.find((o) => o.value === q.status);
    parts.push(`${report.statusLabel || 'Status'}: ${opt?.label ?? LABELS.appointmentStatus[q.status] ?? q.status}`);
  }
  return parts;
}

export async function exportReport(req, res) {
  const { report, result } = await runReport(req);
  const format = req.validQuery.format || 'csv';
  const suffix = result.period ? `${result.period.from}_${result.period.to}` : 'atual';
  const filename = `pilotagem-${report.key}-${suffix}.${format}`;

  await audit(req, {
    action: 'report.export',
    entity: 'Report',
    entityLabel: report.key,
    summary: `Relatório "${report.title}" exportado em ${format.toUpperCase()} (${result.rows.length} registros)`,
    details: { filtros: req.validQuery },
  });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(toCSV(result));
  } else {
    res.setHeader('Content-Type', 'application/pdf');
    toPDF(result, { userName: req.user.name, filtersText: await describeFilters(req.validQuery, report) }, res);
  }
}
