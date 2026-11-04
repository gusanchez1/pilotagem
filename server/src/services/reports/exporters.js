import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDate, formatDateKey, formatDateTime } from '../../utils/dates.js';
import { formatBRL, formatDecimal } from '../../utils/money.js';

const logoPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'simbolo-amarelo.png');

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Formata um valor de célula para exibição/exportação. */
export function formatCell(value, type, { csv = false } = {}) {
  if (value === null || value === undefined || value === '') return csv ? '' : '—';
  switch (type) {
    case 'money':
      return csv ? formatDecimal(value) : formatBRL(value);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    case 'percent':
      return `${number.format(value)}%`;
    case 'hours':
      return csv ? number.format(value) : `${number.format(value)} h`;
    case 'number':
      return number.format(value);
    default:
      return String(value);
  }
}

/* ───────────────────────────────── CSV ───────────────────────────────────── */

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV no padrão do Excel em português: separador ";", decimais com vírgula e BOM UTF-8
 * (para acentos aparecerem corretamente).
 */
export function toCSV(result) {
  const cols = result.columns;
  const header = cols.map((c) => csvEscape(c.type === 'money' ? `${c.label} (R$)` : c.label)).join(';');
  const lines = result.rows.map((row) => cols.map((c) => csvEscape(formatCell(row[c.key], c.type, { csv: true }))).join(';'));
  if (Object.keys(result.totals).length) {
    lines.push(
      cols
        .map((c, i) => (i === 0 ? 'TOTAL' : c.key in result.totals ? csvEscape(formatCell(result.totals[c.key], c.type, { csv: true })) : ''))
        .join(';'),
    );
  }
  const BOM = String.fromCharCode(0xfeff);
  return `${BOM}${[header, ...lines].join('\r\n')}\r\n`;
}

/* ───────────────────────────────── PDF ───────────────────────────────────── */

const INK = '#0A0A0A';
const MUTED = '#71717A';
const LINE = '#E4E4E7';
const BRAND = '#FFED00';

export function toPDF(result, meta, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, bottom: 40, left: 36, right: 36 },
    bufferPages: true,
    info: { Title: `PILOTAGEM — ${result.title}`, Author: 'PILOTAGEM', Creator: 'PILOTAGEM' },
  });
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // Cabeçalho
  doc.rect(0, 0, doc.page.width, 64).fill(INK);
  if (existsSync(logoPath)) doc.image(logoPath, left, 20, { height: 24 });
  doc.fillColor('#FFFFFF').font('Helvetica-BoldOblique').fontSize(15).text('PILOTAGEM', left + 52, 22, { characterSpacing: 1.2 });
  doc.fillColor('#A1A1AA').font('Helvetica').fontSize(8).text('Gestão financeira e operacional', left + 52, 40);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica')
    .fontSize(8)
    .text(`Gerado em ${formatDateTime(new Date())} por ${meta.userName}`, left, 28, { width, align: 'right' });
  doc.rect(0, 64, doc.page.width, 3).fill(BRAND);

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(result.title, left, 84);
  const periodText = result.period ? `Período: ${formatDateKey(result.period.from)} a ${formatDateKey(result.period.to)}` : 'Posição atual';
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text([periodText, ...(meta.filtersText || [])].join('   ·   '), left, 104);

  // Tabela
  const cols = result.columns;
  const totalWeight = cols.reduce((a, c) => a + (c.width || 1), 0);
  const widths = cols.map((c) => ((c.width || 1) / totalWeight) * width);
  const isRight = (c) => ['money', 'number', 'percent', 'hours'].includes(c.type);
  let y = 126;

  const drawHeader = () => {
    doc.rect(left, y, width, 20).fill('#F4F4F5');
    let x = left;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#52525B');
    cols.forEach((c, i) => {
      doc.text(c.label.toUpperCase(), x + 5, y + 6.5, { width: widths[i] - 10, align: isRight(c) ? 'right' : 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    y += 20;
  };

  const drawRow = (values, { bold = false, fill = null } = {}) => {
    const rowH = 18;
    if (y + rowH > doc.page.height - doc.page.margins.bottom - 10) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    if (fill) doc.rect(left, y, width, rowH).fill(fill);
    let x = left;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(INK);
    cols.forEach((c, i) => {
      doc.text(values[i], x + 5, y + 5.5, { width: widths[i] - 10, align: isRight(c) ? 'right' : 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowH;
  };

  drawHeader();
  if (!result.rows.length) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Nenhum registro encontrado para os filtros selecionados.', left, y + 12);
  }
  result.rows.forEach((row) => drawRow(cols.map((c) => formatCell(row[c.key], c.type))));
  if (result.rows.length && Object.keys(result.totals).length) {
    drawRow(
      cols.map((c, i) => (c.key in result.totals ? formatCell(result.totals[c.key], c.type) : i === 0 ? 'Total' : '')),
      { bold: true, fill: '#FAFAFA' },
    );
  }

  // Rodapé com paginação
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const fy = doc.page.height - 28;
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    doc.text(
      `${result.rows.length} registro(s) · Clientes confidenciais exibidos pelo nome de exibição · Valores em R$`,
      left,
      fy,
      { width: width * 0.75, lineBreak: false },
    );
    doc.text(`Página ${i + 1} de ${range.count}`, left, fy, { width, align: 'right', lineBreak: false });
  }
  doc.end();
}
