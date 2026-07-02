import type { Node, Edge } from 'reactflow';

/** Reynolds-number flow regime for a pipe run. */
export type FlowRegime = 'none' | 'laminar' | 'transitional' | 'turbulent';

// ── Project & global settings ──────────────────────────────────────────────
export type FluidType = 'water' | 'glycol_30eg';
export type PipeMaterial = 'steel_sch40' | 'copper_typeL';
export type FittingMethod = 'equiv_length' | 'k_factor';
export type SystemType = 'chw' | 'hw' | 'cw' | 'other';

export interface ProjectInfo {
  name: string;
  number: string;
  designer: string;
  date: string;
  loopId: string;
  systemType: SystemType;
  fluidType: FluidType;
  fluidTemp: number; // °F — drives viscosity/density lookup
  defaultPipeMaterial: PipeMaterial;
  fittingMethod: FittingMethod;
  safetyFactor: number; // fraction e.g. 0.10 = 10%, 0 = none
}

// ── Node types ─────────────────────────────────────────────────────────────
export type NodeKind =
  | 'pump'
  | 'chiller_boiler'
  | 'plate_hx'
  | 'buffer_tank'
  | 'hydraulic_sep'
  | 'air_sep'
  | 'expansion_tank'
  | 'coil'
  | 'flow_meter'
  | 'branch' // reference only, zero ΔP, not on critical path
  | 'user_defined';

export interface BaseNodeData {
  kind: NodeKind;
  label: string;
}

export type PressureUnit = 'ft' | 'psi';

export interface ComponentNodeData extends BaseNodeData {
  kind: Exclude<NodeKind, 'pump' | 'branch'>;
  pressureDrop: number; // ft WC — always stored in ft WC; user can enter psi
  pressureDropUnit: PressureUnit;
  notes: string;
}

export interface PumpNodeData extends BaseNodeData {
  kind: 'pump';
  hasVfd: boolean;
}

export interface BranchNodeData extends BaseNodeData {
  kind: 'branch';
  // zero ΔP, purely schematic
}

export type NodeData = PumpNodeData | ComponentNodeData | BranchNodeData;

/** Component kinds that carry a pressure drop (everything except pump + branch). */
export type ComponentKind = Exclude<NodeKind, 'pump' | 'branch'>;

// ── Pipe run edge ──────────────────────────────────────────────────────────
export type NominalSize =
  | '3/4'
  | '1'
  | '1-1/4'
  | '1-1/2'
  | '2'
  | '2-1/2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '8'
  | '10'
  | '12';

export type FittingType =
  | 'elbow_90_std'
  | 'elbow_90_lr'
  | 'elbow_45'
  | 'tee_thru'
  | 'tee_branch'
  | 'ball_valve'
  | 'gate_valve'
  | 'globe_valve'
  | 'butterfly_valve'
  | 'check_swing'
  | 'check_spring'
  | 'control_2way'
  | 'control_3way'
  | 'balancing_valve'
  | 'picv'
  | 'prv'
  | 'drain_valve'
  | 'y_strainer'
  | 'flex_connection'
  | 'reducer_concentric'
  | 'coupling';

export interface Fitting {
  id: string; // uuid
  type: FittingType; // key into FITTING_EL / FITTING_K tables
  quantity: number; // integer ≥ 1
}

export interface PipeRunEdgeData {
  label: string; // e.g. "PR-1" — auto-generated, user-editable
  nominalSize: NominalSize;
  material: PipeMaterial; // overrides project default if set
  flowGpm: number;
  lengthFt: number; // straight pipe length (ft) — does NOT include fitting EL
  fittings: Fitting[];
  /**
   * Manual routing nudge: shifts the auto-routed elbow by this many flow units
   * from its default midpoint so the pipe can be slid clear of other nodes.
   * Purely visual — does not affect TDH. Absent/zero = default auto-route.
   */
  offset?: { x: number; y: number };
}

// ── Computed results ───────────────────────────────────────────────────────
export interface PipeRunCalc {
  actualIdIn: number; // actual inside diameter, inches
  areaSqFt: number;
  velocityFps: number; // ft/s — flag if > 4 fps
  reynoldsNumber: number;
  frictionFactor: number; // Darcy f
  frictionRatePer100: number; // ft head / 100 ft pipe
  pipeFrictionFt: number;
  fittingElFt: number; // total equivalent length for fittings (ft)
  fittingLossFt: number;
  segmentTotalFt: number;
  /** Reynolds-number flow regime ('none' when no flow/size). */
  flowRegime: FlowRegime;
  /** True when flow/length/size are missing or unavailable — calc returns zeros. */
  missingData: boolean;
}

export interface ComponentCalc {
  pressureDropFt: number;
}

export interface SegmentRow {
  elementId: string;
  elementType: 'edge' | 'node';
  label: string;
  flowGpm: number;
  sizeLabel: string;
  velocityFps: number;
  frictionRatePer100: number;
  pipeFrictionFt: number;
  fittingLossFt: number;
  componentDropFt: number;
  segmentTotalFt: number;
  cumulativeFt: number;
  warning?: 'velocity' | 'missing' | 'transitional';
}

export interface TDHResults {
  totalPipeFrictionFt: number;
  totalFittingLossFt: number;
  totalComponentDropFt: number;
  subtotalFt: number;
  safetyFactorFt: number;
  designTdhFt: number;
  designFlowGpm: number; // max GPM among pipe runs on the traced loop (pump discharge basis)
  rows: SegmentRow[];
  warnings: Warning[];
  /** Element ids (nodes + edges) that lie on the traced loop. */
  loopElementIds: Set<string>;
  /** Whether the loop closes back to the pump. */
  loopClosed: boolean;
  /**
   * Overall calculation status:
   *   'empty'       — nothing to calculate yet (no pump / no pipe runs traced).
   *   'provisional' — a loop was traced but it is NOT safe to use for design
   *                   (open loop, missing run data, or other blocking issue).
   *   'valid'       — closed loop, every traced run complete, no blocking issues.
   */
  status: 'empty' | 'provisional' | 'valid';
  /** Convenience flag: status === 'valid'. The TDH is suitable for pump selection. */
  isValidForDesign: boolean;
  /** Short human-readable reasons the result is provisional (UI + exports). */
  statusReasons: string[];
}

export type Severity = 'red' | 'yellow';

export interface Warning {
  id: string; // element id this attaches to (or a synthetic id for global warnings)
  elementType: 'node' | 'edge';
  message: string;
  severity: Severity;
}

// ── React Flow aliases ─────────────────────────────────────────────────────
export type RFNode = Node<NodeData>;
export type RFEdge = Edge<PipeRunEdgeData>;
