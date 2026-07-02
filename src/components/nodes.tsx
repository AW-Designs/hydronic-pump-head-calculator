import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { PumpNodeData, ComponentNodeData, BranchNodeData, Severity } from '../types';
import { useStore } from '../store';
import { NODE_LABELS, FT_PER_PSI } from '../calc/constants';
import { NODE_SYMBOLS, PumpNoVfdSymbol } from './icons';

// One connection dot at the midpoint of each side. Hidden until the node is
// hovered (see `.pipe-port` in index.css), then they appear as clear blue dots
// you drag from to run a pipe — leaving the whole node body free for repositioning.
// With ConnectionMode.Loose any side can be the start or end of a pipe, so the
// specific handle id a drag resolves to is irrelevant; nothing downstream (TDH
// traversal) reads it. Ids stay stable ('t-l'/'t-t' inlets, 's-r'/'s-b' outlets)
// to match the .pump.json save format.
const portStyle: React.CSSProperties = { width: 12, height: 12, background: '#2563EB', border: '2px solid #fff', zIndex: 3 };

function Ports() {
  return (
    <>
      <Handle id="t-t" type="target" position={Position.Top} style={portStyle} title="Drag to connect" className="pipe-port" />
      <Handle id="s-b" type="source" position={Position.Bottom} style={portStyle} title="Drag to connect" className="pipe-port" />
      <Handle id="t-l" type="target" position={Position.Left} style={portStyle} title="Drag to connect" className="pipe-port" />
      <Handle id="s-r" type="source" position={Position.Right} style={portStyle} title="Drag to connect" className="pipe-port" />
    </>
  );
}

const SEVERITY_COLOR: Record<Severity, string> = { red: '#DC2626', yellow: '#D97706' };

function useElementSeverity(id: string): Severity | undefined {
  return useStore((s) => {
    let sev: Severity | undefined;
    for (const w of s.results.warnings) {
      if (w.id === id) {
        if (w.severity === 'red') return 'red';
        sev = 'yellow';
      }
    }
    return sev;
  });
}

/** Style for the pulsing attention ring applied when an element is selected. */
function focusRingStyle(focused: boolean, severity?: Severity): React.CSSProperties {
  if (!focused) return {};
  const color = severity ? SEVERITY_COLOR[severity] : '#2563EB';
  return { ['--focus-color' as string]: color };
}

function WarnBadge({ severity }: { severity?: Severity }) {
  if (!severity) return null;
  return (
    <span
      className="absolute -top-2 -right-2 text-xs leading-none"
      title="Warning — select for details"
      style={{ filter: severity === 'red' ? 'drop-shadow(0 0 2px #DC2626)' : 'drop-shadow(0 0 2px #D97706)' }}
    >
      ⚠️
    </span>
  );
}

const cardBase =
  'relative bg-white rounded-md border shadow-sm px-2 py-1.5 min-w-[96px] flex flex-col items-center select-none transition-shadow cursor-move';

// ── Pump ─────────────────────────────────────────────────────────────────────
export const PumpNode = memo(({ id, data }: NodeProps<PumpNodeData>) => {
  const onLoop = useStore((s) => s.results.loopElementIds.has(id));
  const focused = useStore((s) => s.selectedId === id);
  const Symbol = data.hasVfd ? NODE_SYMBOLS.pump : PumpNoVfdSymbol;
  return (
    <div
      className={`${cardBase} ${focused ? 'focus-pulse' : ''}`}
      style={{
        border: '2px solid #2563EB',
        boxShadow: onLoop ? '0 0 10px rgba(37,99,235,0.55)' : undefined,
        color: '#2563EB',
        ...focusRingStyle(focused),
      }}
    >
      <Ports />
      <Symbol size={44} />
      <div className="mt-0.5 text-[11px] font-bold text-gray-800">{data.label || 'Pump'}</div>
      <div className="text-[9px] font-mono text-gray-400">source · ΔP 0</div>
    </div>
  );
});

// ── Equipment / component ────────────────────────────────────────────────────
export const EquipmentNode = memo(({ id, data, selected }: NodeProps<ComponentNodeData>) => {
  const severity = useElementSeverity(id);
  const onLoop = useStore((s) => s.results.loopElementIds.has(id));
  const focused = useStore((s) => s.selectedId === id);
  const Symbol = NODE_SYMBOLS[data.kind];
  const psi = data.pressureDrop / FT_PER_PSI;
  return (
    <div
      className={`${cardBase} ${focused ? 'focus-pulse' : ''}`}
      style={{
        border: selected || onLoop ? '2px solid #2563EB' : '1px solid #E5E7EB',
        boxShadow: onLoop ? '0 0 8px rgba(37,99,235,0.45)' : undefined,
        color: selected || onLoop ? '#2563EB' : '#374151',
        ...focusRingStyle(focused, severity),
      }}
    >
      <Ports />
      <WarnBadge severity={severity} />
      <Symbol size={40} />
      <div className="mt-0.5 text-[11px] font-semibold text-gray-800 text-center leading-tight">
        {data.label || NODE_LABELS[data.kind]}
      </div>
      <div className="text-[9px] font-mono text-gray-500">
        ΔP {data.pressureDrop.toFixed(1)} ft · {psi.toFixed(1)} psi
      </div>
    </div>
  );
});

// ── Branch / Tee (reference only) ────────────────────────────────────────────
export const BranchNode = memo(({ id, data, selected }: NodeProps<BranchNodeData>) => {
  const focused = useStore((s) => s.selectedId === id);
  const Symbol = NODE_SYMBOLS.branch;
  return (
    <div
      className={`${cardBase} opacity-70 ${focused ? 'focus-pulse' : ''}`}
      style={{
        border: selected ? '2px dashed #2563EB' : '1.5px dashed #9CA3AF',
        background: '#F9FAFB',
        color: '#6B7280',
        ...focusRingStyle(focused),
      }}
    >
      <Ports />
      <Symbol size={38} />
      <div className="mt-0.5 text-[11px] font-semibold text-gray-600">{data.label || 'Branch'}</div>
      <div className="text-[9px] font-medium text-gray-400">ref only · excluded</div>
    </div>
  );
});

export const nodeTypes = { pump: PumpNode, equipment: EquipmentNode, branch: BranchNode };
