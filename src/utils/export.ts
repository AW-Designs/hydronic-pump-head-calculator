import { jsPDF } from 'jspdf';
// SECURITY NOTE (xlsx / SheetJS 0.18.5): this package carries open advisories for
// prototype pollution and ReDoS. Both are in the *parsing* path (XLSX.read of
// untrusted workbooks). This app NEVER parses spreadsheets — it only WRITES them
// here via XLSX.utils.*/XLSX.writeFile. Project import uses JSON only (store.ts).
// The vulnerable code paths are therefore not reachable. Do not introduce
// XLSX.read on user-supplied files without first replacing this dependency.
import * as XLSX from 'xlsx';
import type { TDHResults, ProjectInfo } from '../types';
import {
  FLUID_LABELS, MATERIAL_LABELS, FITTING_METHOD_LABELS, SYSTEM_TYPE_LABELS,
} from '../calc/constants';
import { sanitizeFilename } from './units';

function baseName(project: ProjectInfo): string {
  return `${sanitizeFilename(project.name)}_${sanitizeFilename(project.loopId)}_PumpCalc_${project.date}`;
}

/** Prominent one-line calculation status used across every export format. */
function statusBanner(results: TDHResults): string {
  switch (results.status) {
    case 'valid':
      return 'STATUS: COMPLETE — suitable for design use.';
    case 'provisional':
      return 'STATUS: PROVISIONAL — NOT FOR DESIGN. Resolve the issues below before using this TDH.';
    default:
      return 'STATUS: INCOMPLETE — no closed loop with pipe-run data has been traced.';
  }
}

const SEG_HEADERS = [
  '#', 'Description', 'GPM', 'Size', 'Vel (fps)', 'ft/100ft',
  'Pipe (ft)', 'Fit (ft)', 'Equip (ft)', 'Seg (ft)', 'Cumul (ft)',
];

function segRow(r: TDHResults['rows'][number], i: number): (string | number)[] {
  const n = (v: number, dp: number) => (v ? Number(v.toFixed(dp)) : '');
  return [
    i + 1,
    r.label,
    r.flowGpm || '',
    r.sizeLabel,
    n(r.velocityFps, 2),
    n(r.frictionRatePer100, 3),
    n(r.pipeFrictionFt, 3),
    n(r.fittingLossFt, 3),
    n(r.componentDropFt, 2),
    n(r.segmentTotalFt, 3),
    n(r.cumulativeFt, 2),
  ];
}

// ── PDF ──────────────────────────────────────────────────────────────────────
export function exportPdf(results: TDHResults, project: ProjectInfo) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // ── Page 1: header + summary ──
  pdf.setFontSize(16);
  pdf.setTextColor('#1E2A3A');
  pdf.text('HYDRONIC PUMP HEAD CALCULATION', margin, y);
  y += 22;

  pdf.setFontSize(9);
  pdf.setTextColor('#374151');
  const info: [string, string][] = [
    ['Project', project.name],
    ['Project No.', project.number || '—'],
    ['Engineer', project.designer || '—'],
    ['Date', project.date],
    ['Loop', `${project.loopId || '—'}   (${SYSTEM_TYPE_LABELS[project.systemType]})`],
    ['Fluid', `${FLUID_LABELS[project.fluidType]} @ ${project.fluidTemp}°F`],
    ['Default Pipe', MATERIAL_LABELS[project.defaultPipeMaterial]],
    ['Fitting Method', FITTING_METHOD_LABELS[project.fittingMethod]],
  ];
  for (const [k, v] of info) {
    pdf.setTextColor('#6b7280');
    pdf.text(`${k}:`, margin, y);
    pdf.setTextColor('#111827');
    pdf.text(String(v), margin + 90, y);
    y += 14;
  }
  y += 6;

  // ── Status banner (prominent — color-coded) ──
  const isValid = results.status === 'valid';
  pdf.setFillColor(isValid ? '#ECFDF5' : '#FEF2F2');
  pdf.setDrawColor(isValid ? '#10B981' : '#DC2626');
  const bannerLines = [statusBanner(results), ...results.statusReasons.map((r) => `  • ${r}`)];
  const bannerH = 8 + bannerLines.length * 11;
  pdf.rect(margin, y, pageW - margin * 2, bannerH, 'FD');
  let byb = y + 12;
  pdf.setFontSize(8.5);
  bannerLines.forEach((ln, i) => {
    pdf.setTextColor(isValid ? '#065F46' : '#991B1B');
    if (i === 0) pdf.setFont('helvetica', 'bold');
    else pdf.setFont('helvetica', 'normal');
    pdf.text(ln, margin + 8, byb);
    byb += 11;
  });
  pdf.setFont('helvetica', 'normal');
  y += bannerH + 10;

  // Results summary box
  pdf.setDrawColor('#E5E7EB');
  pdf.setFillColor('#F8F9FA');
  pdf.rect(margin, y, pageW - margin * 2, 116, 'FD');
  const bx = margin + 14;
  let by = y + 20;
  pdf.setFontSize(10);
  pdf.setTextColor('#1E2A3A');
  pdf.text('RESULTS SUMMARY', bx, by);
  by += 16;
  pdf.setFontSize(9);
  const sline = (label: string, val: string, bold = false) => {
    pdf.setTextColor(bold ? '#111827' : '#374151');
    pdf.text(label, bx, by);
    pdf.text(val, bx + 200, by, { align: 'right' });
    by += 13;
  };
  sline('Pipe Friction', `${results.totalPipeFrictionFt.toFixed(2)} ft`);
  sline('Fitting Losses', `${results.totalFittingLossFt.toFixed(2)} ft`);
  sline('Equipment ΔP', `${results.totalComponentDropFt.toFixed(2)} ft`);
  sline('Subtotal', `${results.subtotalFt.toFixed(2)} ft`, true);
  sline(`Safety (${Math.round(project.safetyFactor * 100)}%)`, `${results.safetyFactorFt.toFixed(2)} ft`);

  // Design TDH callout — amber when provisional so it never reads as final.
  const provisional = results.status === 'provisional';
  pdf.setFillColor(provisional ? '#92400E' : '#1E2A3A');
  pdf.rect(margin + 280, y + 14, pageW - margin * 2 - 294, 88, 'F');
  pdf.setTextColor('#ffffff');
  pdf.setFontSize(8);
  pdf.text(provisional ? 'DESIGN TDH (PROVISIONAL)' : 'DESIGN TDH', margin + 296, y + 36);
  pdf.setFontSize(22);
  pdf.text(`${results.designTdhFt.toFixed(1)} ft${provisional ? ' *' : ''}`, margin + 296, y + 64);
  pdf.setFontSize(8);
  pdf.text(`@ ${Math.round(results.designFlowGpm)} GPM`, margin + 296, y + 82);

  y += 116 + 24;

  // ── Segment log table ──
  pdf.setFontSize(11);
  pdf.setTextColor('#1E2A3A');
  pdf.text('Segment Log', margin, y);
  y += 8;

  const colW = [22, 110, 38, 40, 48, 50, 48, 44, 50, 48, 50];
  const drawHeader = (yPos: number) => {
    pdf.setFontSize(7.5);
    pdf.setTextColor('#1E2A3A');
    let cx = margin;
    SEG_HEADERS.forEach((h, i) => {
      pdf.text(h, cx, yPos);
      cx += colW[i];
    });
    const lineY = yPos + 4;
    pdf.setDrawColor('#9ca3af');
    pdf.line(margin, lineY, margin + colW.reduce((a, b) => a + b, 0), lineY);
    return lineY + 11;
  };
  y = drawHeader(y + 12);
  pdf.setFontSize(7);

  results.rows.forEach((r, i) => {
    if (y > pageH - margin - 14) {
      pdf.addPage();
      y = margin;
      pdf.setFontSize(8);
      pdf.setTextColor('#6b7280');
      pdf.text(`${project.name} — Pump Head Calc (continued)`, margin, y);
      y = drawHeader(y + 14);
      pdf.setFontSize(7);
    }
    pdf.setTextColor(r.warning === 'missing' ? '#DC2626' : '#374151');
    const cells = segRow(r, i).map((c) => String(c));
    let cx = margin;
    cells.forEach((c, ci) => {
      pdf.text(c, cx, y);
      cx += colW[ci];
    });
    y += 11;
  });

  // ── Warnings ──
  if (results.warnings.length > 0) {
    if (y > pageH - margin - 50) {
      pdf.addPage();
      y = margin;
    }
    y += 14;
    pdf.setFontSize(10);
    pdf.setTextColor('#1E2A3A');
    pdf.text('Warnings', margin, y);
    y += 12;
    pdf.setFontSize(7.5);
    for (const w of results.warnings) {
      if (y > pageH - margin - 12) {
        pdf.addPage();
        y = margin;
      }
      pdf.setTextColor(w.severity === 'red' ? '#DC2626' : '#D97706');
      pdf.text(`[${w.severity.toUpperCase()}] ${w.message}`, margin, y);
      y += 11;
    }
  }

  pdf.save(`${baseName(project)}.pdf`);
}

// ── Excel (xlsx) ─────────────────────────────────────────────────────────────
export function exportExcel(results: TDHResults, project: ProjectInfo) {
  const wb = XLSX.utils.book_new();

  const summary: (string | number)[][] = [
    ['CALCULATION STATUS', statusBanner(results)],
    ...results.statusReasons.map((r): (string | number)[] => ['  Issue', r]),
    ['Valid for design?', results.isValidForDesign ? 'YES' : 'NO'],
    [],
    ['Project Name', project.name],
    ['Project Number', project.number],
    ['Engineer', project.designer],
    ['Date', project.date],
    ['Loop ID', project.loopId],
    ['System Type', SYSTEM_TYPE_LABELS[project.systemType]],
    ['Fluid', FLUID_LABELS[project.fluidType]],
    ['Fluid Temp (°F)', project.fluidTemp],
    ['Pipe Material (default)', MATERIAL_LABELS[project.defaultPipeMaterial]],
    ['Fitting Method', FITTING_METHOD_LABELS[project.fittingMethod]],
    [],
    ['Pipe Friction (ft)', Number(results.totalPipeFrictionFt.toFixed(3))],
    ['Fitting Losses (ft)', Number(results.totalFittingLossFt.toFixed(3))],
    ['Equipment ΔP (ft)', Number(results.totalComponentDropFt.toFixed(3))],
    ['Subtotal (ft)', Number(results.subtotalFt.toFixed(3))],
    ['Safety Factor (%)', Math.round(project.safetyFactor * 100)],
    ['Safety Factor (ft)', Number(results.safetyFactorFt.toFixed(3))],
    [
      results.status === 'provisional' ? 'Design TDH (ft) — PROVISIONAL' : 'Design TDH (ft)',
      Number(results.designTdhFt.toFixed(2)),
    ],
    ['Design Flow (GPM) — max on traced loop', Math.round(results.designFlowGpm)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  const seg: (string | number)[][] = [SEG_HEADERS, ...results.rows.map((r, i) => segRow(r, i))];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(seg), 'Segment Log');

  if (results.warnings.length > 0) {
    const warn: (string | number)[][] = [
      ['Severity', 'Message'],
      ...results.warnings.map((w) => [w.severity.toUpperCase(), w.message]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(warn), 'Warnings');
  }

  XLSX.writeFile(wb, `${baseName(project)}.xlsx`);
}

// ── CSV (segment log only) ───────────────────────────────────────────────────
export function exportCsv(results: TDHResults, project: ProjectInfo) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [];
  // Status header — prominent so an exported CSV is never mistaken for final data.
  lines.push(esc(statusBanner(results)));
  results.statusReasons.forEach((r) => lines.push(esc(`Issue: ${r}`)));
  lines.push(esc(`Design TDH (ft): ${results.designTdhFt.toFixed(2)}`));
  lines.push(esc(`Design Flow (GPM, max on traced loop): ${Math.round(results.designFlowGpm)}`));
  lines.push('');
  lines.push(SEG_HEADERS.join(','));
  results.rows.forEach((r, i) => {
    lines.push(segRow(r, i).map((c) => esc(String(c))).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName(project)}_SegmentLog.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
