import { useState } from 'react';
import { useStore } from '../store';
import type { TDHResults } from '../types';
import { TDH_YELLOW_FT, TDH_RED_FT } from '../calc/constants';

type Tab = 'summary' | 'log' | 'warnings';

interface PanelProps {
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const NON_CLICKABLE = new Set([
  '__no_pump__', '__loop__', '__safety__', '__multi_pump__', '__ignored__',
]);

function tdhColor(ft: number): string {
  if (ft > TDH_RED_FT) return '#FCA5A5';
  if (ft > TDH_YELLOW_FT) return '#FCD34D';
  return '#ffffff';
}

export default function ResultsPanel({ expanded, onToggleExpand }: PanelProps) {
  const [tab, setTab] = useState<Tab>('summary');
  const results = useStore((s) => s.results);
  const focusElement = useStore((s) => s.focusElement);
  const warnCount = results.warnings.length;
  const hasRed = results.warnings.some((w) => w.severity === 'red');

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-1 text-xs font-medium rounded-t ${
        tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {label}
      {id === 'warnings' && warnCount > 0 && (
        <span
          className="ml-1.5 px-1.5 py-0.5 rounded-full text-white text-[9px]"
          style={{ background: hasRed ? '#DC2626' : '#D97706' }}
        >
          {warnCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="h-full w-full text-white flex flex-col" style={{ background: '#1E2A3A' }}>
      <div className="flex items-center gap-1 px-3 pt-1.5 border-b border-white/10">
        <TabBtn id="summary" label="Summary" />
        <TabBtn id="log" label="Segment Log" />
        <TabBtn id="warnings" label="Warnings" />
        <div className="flex-1" />
        {onToggleExpand && (
          <button className="text-white/50 hover:text-white text-xs px-2" onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '▼ Collapse' : '▲ Expand'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'summary' && <Summary results={results} />}
        {tab === 'log' && <SegmentLog results={results} onSelect={focusElement} />}
        {tab === 'warnings' && <Warnings results={results} onSelect={focusElement} />}
      </div>
    </div>
  );
}

function Summary({ results }: { results: TDHResults }) {
  const setProject = useStore((s) => s.setProject);
  const safetyPct = useStore((s) => Math.round(s.project.safetyFactor * 100));

  const provisional = results.status === 'provisional';
  // A provisional TDH must never look like a clean, design-ready number.
  const tdhValueColor = provisional ? '#FCD34D' : tdhColor(results.designTdhFt);

  const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex items-baseline justify-between gap-6 ${strong ? 'text-white' : 'text-white/70'}`}>
      <span className={`text-[11px] ${strong ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`font-mono ${strong ? 'text-sm font-bold' : 'text-xs'}`}>{value}</span>
    </div>
  );

  return (
    <div className="flex items-center h-full px-4 gap-6 min-w-max">
      {/* Big TDH */}
      <div
        className="px-5 py-3 rounded-lg shrink-0"
        style={{
          background: provisional ? 'rgba(217,119,6,0.16)' : 'rgba(255,255,255,0.06)',
          border: provisional ? '1px solid rgba(252,211,77,0.45)' : '1px solid transparent',
        }}
      >
        <div className="text-[10px] uppercase tracking-wider text-white/45 flex items-center gap-1.5">
          Design TDH
          {provisional && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider" style={{ background: '#D97706', color: '#fff' }}>
              PROVISIONAL
            </span>
          )}
        </div>
        <div className="font-mono font-bold leading-none" style={{ fontSize: 38, color: tdhValueColor }}>
          {results.designTdhFt.toFixed(1)}
          {provisional && <span className="text-base font-bold align-top ml-1">*</span>}
        </div>
        <div className="text-[11px] text-white/50 mt-1">ft of head @ {Math.round(results.designFlowGpm)} GPM</div>
        {provisional && (
          <div className="text-[10px] text-amber-300/90 mt-1 max-w-[220px] leading-snug">
            * Not design-ready — {results.statusReasons[0]}
            {results.statusReasons.length > 1 && ` (+${results.statusReasons.length - 1} more)`}
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div className="space-y-0.5 border-l border-white/10 pl-5">
        <Line label="Pipe Friction" value={`${results.totalPipeFrictionFt.toFixed(2)} ft`} />
        <Line label="Fittings" value={`${results.totalFittingLossFt.toFixed(2)} ft`} />
        <Line label="Equipment" value={`${results.totalComponentDropFt.toFixed(2)} ft`} />
        <div className="h-px bg-white/10 my-1" />
        <Line label="Subtotal" value={`${results.subtotalFt.toFixed(2)} ft`} strong />
        <div className="flex items-baseline justify-between gap-6 text-white/70">
          <span className="text-[11px] flex items-center gap-1">
            Safety
            <input
              type="number" min={0} step={1}
              className="w-12 px-1 py-0.5 text-[11px] bg-white/10 border border-white/20 rounded text-white text-center font-mono"
              value={safetyPct}
              onChange={(e) => setProject({ safetyFactor: Math.max(0, Number(e.target.value) || 0) / 100 })}
            />
            <span>%</span>
          </span>
          <span className="font-mono text-xs">{results.safetyFactorFt.toFixed(2)} ft</span>
        </div>
        <div className="h-px bg-white/10 my-1" />
        <Line label="Design TDH" value={`${results.designTdhFt.toFixed(2)} ft`} strong />
      </div>

      {results.rows.length === 0 && (
        <div className="text-white/40 text-xs italic border-l border-white/10 pl-5 max-w-[200px]">
          Place a Pump, connect equipment into a closed loop, and enter pipe-run data to compute TDH.
        </div>
      )}
    </div>
  );
}

function SegmentLog({ results, onSelect }: { results: TDHResults; onSelect: (id: string, type: 'node' | 'edge') => void }) {
  const cols = ['#', 'Description', 'GPM', 'Size', 'Vel (fps)', 'ft/100ft', 'Pipe (ft)', 'Fit (ft)', 'Equip (ft)', 'Seg (ft)', 'Cumul (ft)'];
  const num = (v: number, dp = 2) => (v ? v.toFixed(dp) : '');

  return (
    <table className="w-full text-[11px] font-mono">
      <thead className="sticky top-0" style={{ background: '#172230' }}>
        <tr className="text-white/50 text-left">
          {cols.map((c) => (
            <th key={c} className="px-2 py-1 font-medium font-sans whitespace-nowrap">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.rows.length === 0 && (
          <tr>
            <td colSpan={cols.length} className="px-3 py-3 text-white/40 italic font-sans">No segments yet.</td>
          </tr>
        )}
        {results.rows.map((r, i) => {
          const bg =
            r.warning === 'missing'
              ? 'rgba(220,38,38,0.18)'
              : r.warning === 'velocity'
              ? 'rgba(217,119,6,0.18)'
              : r.warning === 'transitional'
              ? 'rgba(217,119,6,0.10)'
              : 'rgba(37,99,235,0.14)'; // all rows are on the (single) critical loop
          return (
            <tr
              key={r.elementId + i}
              style={{ background: bg }}
              className="cursor-pointer hover:brightness-125"
              onClick={() => onSelect(r.elementId, r.elementType)}
            >
              <td className="px-2 py-1">{i + 1}</td>
              <td className="px-2 py-1 font-sans whitespace-nowrap">{r.label}</td>
              <td className="px-2 py-1">{r.flowGpm || ''}</td>
              <td className="px-2 py-1 whitespace-nowrap">{r.sizeLabel}</td>
              <td className="px-2 py-1">{num(r.velocityFps)}</td>
              <td className="px-2 py-1">{num(r.frictionRatePer100, 3)}</td>
              <td className="px-2 py-1">{num(r.pipeFrictionFt, 3)}</td>
              <td className="px-2 py-1">{num(r.fittingLossFt, 3)}</td>
              <td className="px-2 py-1">{num(r.componentDropFt, 2)}</td>
              <td className="px-2 py-1">{num(r.segmentTotalFt, 3)}</td>
              <td className="px-2 py-1 font-semibold">{num(r.cumulativeFt, 2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Warnings({ results, onSelect }: { results: TDHResults; onSelect: (id: string, type: 'node' | 'edge') => void }) {
  if (results.warnings.length === 0) {
    return <div className="px-4 py-4 text-white/40 text-xs italic">No active warnings. ✓</div>;
  }
  return (
    <div className="px-3 py-2 space-y-1">
      {results.warnings.map((w, i) => {
        const clickable = !NON_CLICKABLE.has(w.id);
        const color = w.severity === 'red' ? '#DC2626' : '#D97706';
        return (
          <button
            key={i}
            onClick={() => clickable && onSelect(w.id, w.elementType)}
            disabled={!clickable}
            title={clickable ? 'Click to locate on canvas' : undefined}
            className={`group w-full text-left flex items-start gap-2 pl-2 pr-2 py-1.5 rounded text-[11px] ${
              clickable ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'
            }`}
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <span className="mt-[1px]">{w.severity === 'red' ? '🔴' : '🟡'}</span>
            <span className="text-white/85 flex-1">{w.message}</span>
            {clickable && (
              <span
                className="shrink-0 text-white/30 group-hover:text-white/80 font-sans"
                title="Locate on canvas"
              >
                ⤢
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
