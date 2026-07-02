/**
 * P&ID symbol catalog (spec/08). Every symbol is a React component that renders
 * SVG using `currentColor`, so it inherits the parent's text color. Valve bodies
 * are solid-filled triangles per ISA 5.1 / North-American hydronic convention.
 */
import type { FittingType, NodeKind } from '../types';
import { TRACED_ICONS, type TracedIcon } from './tracedIconData';

export interface SymbolProps {
  className?: string;
  size?: number; // width in px; height scales to the symbol's aspect ratio
}

/** Build a symbol component from a viewBox + static SVG children. */
function sym(vbW: number, vbH: number, children: React.ReactNode) {
  const Comp: React.FC<SymbolProps> = ({ className, size = 40 }) => (
    <svg
      width={size}
      height={size * (vbH / vbW)}
      viewBox={`0 0 ${vbW} ${vbH}`}
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
  return Comp;
}

/**
 * Build a symbol component from a vector-traced (potrace) icon: a solid
 * silhouette path in the icon's own coordinate space, recolored to
 * `currentColor` so it inherits the parent's text color like the hand-drawn
 * symbols. `extra` lets a variant layer additional line-art on top (e.g. the
 * spring squiggle that distinguishes a spring check valve from a swing check).
 */
function traced(icon: TracedIcon, extra?: React.ReactNode) {
  return sym(icon.vbW, icon.vbH, (
    <>
      <g transform={icon.transform} fill="currentColor" stroke="none">
        {icon.paths.map((d, i) => <path key={i} d={d} />)}
      </g>
      {extra}
    </>
  ));
}

/**
 * Wrap a symbol in a dashed rounded-rect enclosure (ISA convention for a
 * factory-assembled / pre-engineered device, e.g. a PICV combining a control
 * valve with integral balancing). `innerVbW`/`innerVbH` must match the inner
 * symbol's own viewBox so it nests at 1:1 scale inside the padding.
 */
function dashedEnclosure(
  Inner: React.FC<SymbolProps>,
  innerVbW: number,
  innerVbH: number,
  pad = 20
): React.FC<SymbolProps> {
  const vbW = innerVbW + pad * 2;
  const vbH = innerVbH + pad * 2;
  const Comp: React.FC<SymbolProps> = ({ className, size = 40 }) => (
    <svg
      width={size}
      height={size * (vbH / vbW)}
      viewBox={`0 0 ${vbW} ${vbH}`}
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={4} y={4} width={vbW - 8} height={vbH - 8} rx={Math.round(vbW * 0.06)}
        stroke="currentColor" strokeWidth={Math.max(2, vbW * 0.014)}
        strokeDasharray={`${vbW * 0.035} ${vbW * 0.022}`} fill="none" opacity={0.6}
      />
      <g transform={`translate(${pad}, ${pad})`}>
        <Inner size={innerVbW} />
      </g>
    </svg>
  );
  return Comp;
}

// ── Fitting symbols ──────────────────────────────────────────────────────────

export const BallValveSymbol = traced(TRACED_ICONS.shutoffOpen);

export const GateValveSymbol = traced(TRACED_ICONS.gateValve);

export const GlobeValveSymbol = sym(64, 48, (
  <>
    <line x1="0" y1="28" x2="12" y2="28" stroke="currentColor" strokeWidth="2" />
    <line x1="52" y1="28" x2="64" y2="28" stroke="currentColor" strokeWidth="2" />
    <circle cx="32" cy="28" r="14" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <polygon points="18,22 32,28 18,34" fill="currentColor" />
    <polygon points="46,22 32,28 46,34" fill="currentColor" />
    <line x1="32" y1="14" x2="32" y2="7" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="32" cy="5" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <line x1="32" y1="2" x2="32" y2="8" stroke="currentColor" strokeWidth="1.5" />
  </>
));

export const ButterflyValveSymbol = traced(TRACED_ICONS.shutoffClosed);

export const SwingCheckSymbol = traced(TRACED_ICONS.checkValve);

// Spring check: the swing-check silhouette plus a spring squiggle on the
// downstream (seat) side to distinguish it from the plain swing check.
export const SpringCheckSymbol = traced(TRACED_ICONS.checkValve, (
  <path
    d="M202 40 q14 14 0 28 q-14 14 0 28 q14 14 0 28 q-14 14 0 28 q14 14 0 28"
    fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round"
  />
));

export const Control2WaySymbol = traced(TRACED_ICONS.control2Way);

export const Control3WaySymbol = traced(TRACED_ICONS.control3Way);

export const BalancingValveSymbol = traced(TRACED_ICONS.balancing);

// PICV: a modulating control valve in a dashed enclosure (ISA convention for a
// factory pre-engineered combination device — control + integral balancing).
const ModulatingValveGlyph = traced(TRACED_ICONS.modulatingValve);
export const PicvSymbol = dashedEnclosure(
  ModulatingValveGlyph,
  TRACED_ICONS.modulatingValve.vbW,
  TRACED_ICONS.modulatingValve.vbH
);

export const PrvSymbol = traced(TRACED_ICONS.prv);

export const YStrainerSymbol = traced(TRACED_ICONS.strainer);

export const FlexConnectionSymbol = sym(64, 36, (
  <>
    <line x1="0" y1="18" x2="10" y2="18" stroke="currentColor" strokeWidth="2" />
    <line x1="54" y1="18" x2="64" y2="18" stroke="currentColor" strokeWidth="2" />
    <line x1="10" y1="10" x2="10" y2="26" stroke="currentColor" strokeWidth="2.5" />
    <line x1="54" y1="10" x2="54" y2="26" stroke="currentColor" strokeWidth="2.5" />
    <path d="M10 18 Q16 10 22 18 Q28 26 34 18 Q40 10 46 18 Q50 24 54 18" fill="none" stroke="currentColor" strokeWidth="2" />
  </>
));

export const DrainValveSymbol = traced(TRACED_ICONS.hosebibb);

export const Elbow90LrSymbol = sym(64, 52, (
  <>
    <line x1="0" y1="40" x2="28" y2="40" stroke="currentColor" strokeWidth="2" />
    <path d="M28 40 Q38 40 38 30" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="38" y1="30" x2="38" y2="4" stroke="currentColor" strokeWidth="2" />
  </>
));

export const Elbow90StdSymbol = sym(64, 52, (
  <>
    <line x1="0" y1="40" x2="28" y2="40" stroke="currentColor" strokeWidth="2" />
    <path d="M28 40 Q32 40 32 36" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="32" y1="36" x2="32" y2="4" stroke="currentColor" strokeWidth="2" />
  </>
));

export const Elbow45Symbol = sym(64, 52, (
  <>
    <line x1="0" y1="40" x2="20" y2="40" stroke="currentColor" strokeWidth="2" />
    <path d="M20 40 Q26 40 36 30" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="36" y1="30" x2="56" y2="10" stroke="currentColor" strokeWidth="2" />
  </>
));

export const TeeBranchSymbol = sym(64, 48, (
  <>
    <line x1="0" y1="22" x2="64" y2="22" stroke="currentColor" strokeWidth="2" />
    <line x1="32" y1="22" x2="32" y2="46" stroke="currentColor" strokeWidth="2" />
    <circle cx="32" cy="22" r="4" fill="currentColor" />
  </>
));

// Tee — straight through: through-run emphasized, light branch stub.
export const TeeThruSymbol = sym(64, 48, (
  <>
    <line x1="0" y1="22" x2="64" y2="22" stroke="currentColor" strokeWidth="2.5" />
    <line x1="32" y1="22" x2="32" y2="42" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
    <circle cx="32" cy="22" r="3.5" fill="currentColor" />
  </>
));

export const ReducerSymbol = sym(64, 40, (
  <>
    <line x1="0" y1="20" x2="12" y2="20" stroke="currentColor" strokeWidth="2" />
    <line x1="52" y1="20" x2="64" y2="20" stroke="currentColor" strokeWidth="2" />
    <polygon points="12,10 52,15 52,25 12,30" fill="none" stroke="currentColor" strokeWidth="2" />
  </>
));

// Coupling / union.
export const CouplingSymbol = traced(TRACED_ICONS.union);

// ── Node (equipment) symbols ─────────────────────────────────────────────────

// Pump without VFD box (used when hasVfd is false) — bare circulator glyph.
export const PumpNoVfdSymbol = traced(TRACED_ICONS.pumpCirculator);

// Pump with VFD: the circulator glyph plus a VFD callout box wired above it,
// sized proportionally to the circulator's own viewBox.
export const PumpSymbol: React.FC<SymbolProps> = ({ className, size = 56 }) => {
  const { vbW: cw, vbH: ch } = TRACED_ICONS.pumpCirculator;
  const headerH = Math.round(ch * 0.22);
  const vbH = ch + headerH;
  const boxW = Math.round(cw * 0.46);
  const boxH = Math.round(headerH * 0.62);
  const boxX = Math.round((cw - boxW) / 2);
  const strokeW = Math.max(3, Math.round(cw * 0.015));
  return (
    <svg
      width={size}
      height={size * (vbH / cw)}
      viewBox={`0 0 ${cw} ${vbH}`}
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={boxX} y={4} width={boxW} height={boxH} rx={Math.round(boxH * 0.15)} stroke="currentColor" strokeWidth={strokeW} />
      <text
        x={cw / 2} y={4 + boxH * 0.68} textAnchor="middle" fontSize={boxH * 0.55}
        fill="currentColor" fontFamily="sans-serif" fontWeight="bold"
      >
        VFD
      </text>
      <line x1={cw / 2} y1={4 + boxH} x2={cw / 2} y2={headerH} stroke="currentColor" strokeWidth={strokeW} />
      <g transform={`translate(0, ${headerH})`}>
        <PumpNoVfdSymbol size={cw} />
      </g>
    </svg>
  );
};

export const ChillerBoilerSymbol = sym(64, 56, (
  <>
    <rect x="6" y="8" width="52" height="40" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <line x1="10" y1="28" x2="54" y2="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" />
    <line x1="6" y1="18" x2="0" y2="18" stroke="currentColor" strokeWidth="2" />
    <line x1="58" y1="38" x2="64" y2="38" stroke="currentColor" strokeWidth="2" />
    <text x="32" y="22" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">HP</text>
  </>
));

export const PlateHxSymbol = sym(64, 56, (
  <>
    <rect x="20" y="4" width="10" height="48" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="34" y="4" width="10" height="48" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="2" />
    <line x1="4" y1="42" x2="20" y2="42" stroke="currentColor" strokeWidth="2" />
    <line x1="44" y1="14" x2="60" y2="14" stroke="currentColor" strokeWidth="2" />
    <line x1="44" y1="42" x2="60" y2="42" stroke="currentColor" strokeWidth="2" />
    <polygon points="4,10 4,18 10,14" fill="currentColor" />
    <polygon points="60,38 60,46 54,42" fill="currentColor" />
  </>
));

export const BufferTankSymbol = sym(56, 60, (
  <>
    <rect x="14" y="8" width="28" height="44" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <ellipse cx="28" cy="8" rx="14" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="28" cy="52" rx="14" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="0" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="2" />
    <line x1="0" y1="42" x2="14" y2="42" stroke="currentColor" strokeWidth="2" />
  </>
));

export const HydraulicSepSymbol = sym(64, 60, (
  <>
    <rect x="22" y="6" width="20" height="48" rx="4" stroke="currentColor" strokeWidth="2.5" />
    <line x1="4" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="2" />
    <line x1="4" y1="44" x2="22" y2="44" stroke="currentColor" strokeWidth="2" />
    <line x1="42" y1="16" x2="60" y2="16" stroke="currentColor" strokeWidth="2" />
    <line x1="42" y1="44" x2="60" y2="44" stroke="currentColor" strokeWidth="2" />
    <line x1="32" y1="54" x2="32" y2="60" stroke="currentColor" strokeWidth="2" />
    <line x1="28" y1="60" x2="36" y2="60" stroke="currentColor" strokeWidth="2" />
    <polygon points="4,12 4,20 10,16" fill="currentColor" />
  </>
));

export const AirSepSymbol = sym(56, 60, (
  <>
    <rect x="12" y="14" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <line x1="0" y1="30" x2="12" y2="30" stroke="currentColor" strokeWidth="2" />
    <line x1="44" y1="30" x2="56" y2="30" stroke="currentColor" strokeWidth="2" />
    <line x1="28" y1="14" x2="28" y2="2" stroke="currentColor" strokeWidth="2" />
    <polygon points="24,8 32,8 28,0" fill="currentColor" />
    <line x1="28" y1="46" x2="28" y2="56" stroke="currentColor" strokeWidth="2" />
    <line x1="23" y1="56" x2="33" y2="56" stroke="currentColor" strokeWidth="2" />
  </>
));

export const ExpansionTankSymbol = sym(48, 56, (
  <>
    <ellipse cx="24" cy="24" rx="18" ry="20" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <line x1="24" y1="14" x2="24" y2="34" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="24" y1="44" x2="24" y2="54" stroke="currentColor" strokeWidth="2" />
    <line x1="14" y1="54" x2="34" y2="54" stroke="currentColor" strokeWidth="2" />
  </>
));

export const CoilSymbol = sym(64, 48, (
  <>
    <rect x="4" y="8" width="56" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" />
    <path d="M10 24 Q14 18 18 24 Q22 30 26 24 Q30 18 34 24 Q38 30 42 24 Q46 18 50 24 Q54 30 56 24" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <line x1="16" y1="40" x2="16" y2="48" stroke="currentColor" strokeWidth="2" />
    <line x1="48" y1="40" x2="48" y2="48" stroke="currentColor" strokeWidth="2" />
  </>
));

// Flow / BTU meter: circled "M" — bold weight to match the traced symbol set.
export const FlowMeterSymbol = sym(64, 64, (
  <>
    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" />
    <text
      x="32" y="33" textAnchor="middle" dominantBaseline="central" fontSize="34"
      fill="currentColor" fontFamily="sans-serif" fontWeight="bold"
    >
      M
    </text>
  </>
));

export const BranchSymbol = sym(64, 48, (
  <>
    <line x1="0" y1="20" x2="64" y2="20" stroke="currentColor" strokeWidth="2.5" />
    <line x1="32" y1="20" x2="32" y2="46" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" opacity="0.5" />
    <circle cx="32" cy="20" r="5" fill="currentColor" />
  </>
));

export const UserDefinedSymbol = sym(64, 44, (
  <>
    <line x1="0" y1="22" x2="10" y2="22" stroke="currentColor" strokeWidth="2" />
    <line x1="54" y1="22" x2="64" y2="22" stroke="currentColor" strokeWidth="2" />
    <rect x="10" y="8" width="44" height="28" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="5 2" />
    <text x="32" y="27" textAnchor="middle" fontSize="16" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">?</text>
  </>
));

// ── Lookup maps ──────────────────────────────────────────────────────────────

export const FITTING_SYMBOLS: Record<FittingType, React.FC<SymbolProps>> = {
  elbow_90_std: Elbow90StdSymbol,
  elbow_90_lr: Elbow90LrSymbol,
  elbow_45: Elbow45Symbol,
  tee_thru: TeeThruSymbol,
  tee_branch: TeeBranchSymbol,
  ball_valve: BallValveSymbol,
  gate_valve: GateValveSymbol,
  globe_valve: GlobeValveSymbol,
  butterfly_valve: ButterflyValveSymbol,
  check_swing: SwingCheckSymbol,
  check_spring: SpringCheckSymbol,
  control_2way: Control2WaySymbol,
  control_3way: Control3WaySymbol,
  balancing_valve: BalancingValveSymbol,
  picv: PicvSymbol,
  prv: PrvSymbol,
  drain_valve: DrainValveSymbol,
  y_strainer: YStrainerSymbol,
  flex_connection: FlexConnectionSymbol,
  reducer_concentric: ReducerSymbol,
  coupling: CouplingSymbol,
};

export const NODE_SYMBOLS: Record<NodeKind, React.FC<SymbolProps>> = {
  pump: PumpSymbol,
  chiller_boiler: ChillerBoilerSymbol,
  plate_hx: PlateHxSymbol,
  buffer_tank: BufferTankSymbol,
  hydraulic_sep: HydraulicSepSymbol,
  air_sep: AirSepSymbol,
  expansion_tank: ExpansionTankSymbol,
  coil: CoilSymbol,
  flow_meter: FlowMeterSymbol,
  branch: BranchSymbol,
  user_defined: UserDefinedSymbol,
};
