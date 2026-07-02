import type {
  FittingType,
  FluidType,
  NodeKind,
  ComponentKind,
  NominalSize,
  PipeMaterial,
  FittingMethod,
  SystemType,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Pipe size tables  (spec/06 §9)
// Stored as inside diameter (in) + cross-sectional flow area (ft²).
// areaSqFt is derived from idIn so it stays consistent with the velocity formula.
// ─────────────────────────────────────────────────────────────────────────────
export interface PipeSize {
  idIn: number;
  areaSqFt: number;
}

const mkSize = (idIn: number): PipeSize => ({
  idIn,
  areaSqFt: Math.PI * Math.pow(idIn / 24, 2),
});

export const PIPE_SIZES: Record<PipeMaterial, Partial<Record<NominalSize, PipeSize>>> = {
  steel_sch40: {
    '3/4': mkSize(0.824),
    '1': mkSize(1.049),
    '1-1/4': mkSize(1.38),
    '1-1/2': mkSize(1.61),
    '2': mkSize(2.067),
    '2-1/2': mkSize(2.469),
    '3': mkSize(3.068),
    '4': mkSize(4.026),
    '5': mkSize(5.047),
    '6': mkSize(6.065),
    '8': mkSize(7.981),
    '10': mkSize(10.02),
    '12': mkSize(11.938),
  },
  copper_typeL: {
    '3/4': mkSize(0.785),
    '1': mkSize(1.025),
    '1-1/4': mkSize(1.265),
    '1-1/2': mkSize(1.505),
    '2': mkSize(1.985),
    '2-1/2': mkSize(2.465),
    '3': mkSize(2.945),
    '4': mkSize(3.905),
  },
};

/** Absolute pipe roughness ε (ft). */
export const ROUGHNESS: Record<PipeMaterial, number> = {
  steel_sch40: 0.00015,
  copper_typeL: 0.0000005,
};

/** Full nominal-size list, ascending (used for dropdowns + next-size-up logic). */
export const NOMINAL_SIZES: NominalSize[] = [
  '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '4', '5', '6', '8', '10', '12',
];

/** Nominal sizes available for a given material (copper stops at 4"). */
export function availableSizes(material: PipeMaterial): NominalSize[] {
  return NOMINAL_SIZES.filter((s) => PIPE_SIZES[material][s] != null);
}

/** Next larger available size for a material, or null if already the largest. */
export function nextSizeUp(material: PipeMaterial, size: NominalSize): NominalSize | null {
  const sizes = availableSizes(material);
  const i = sizes.indexOf(size);
  return i >= 0 && i < sizes.length - 1 ? sizes[i + 1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fluid property tables  (spec/06 §8)
//
// Two physically independent properties are stored per temperature:
//   • densityLbFt3        — weight density γ (lbf/ft³), numerically equal to the
//                           mass density in lbm/ft³.
//   • dynViscLbfSPerFt2   — DYNAMIC (absolute) viscosity μ in lbf·s/ft²
//                           (equivalently slug/(ft·s)).
//
// Kinematic viscosity ν is NOT stored — it is derived in engine.ts via
// kinematicViscosityFt2S(), which divides μ by the *mass* density
// (ρ_mass = γ / g_c) so the result is dimensionally correct ft²/s. The prior
// table stored a ν that omitted the g_c = 32.174 factor (ν = μ/γ), which made
// every Reynolds number read ~32× high. That dimensional bug has been removed —
// see the engine for the corrected derivation.
// ─────────────────────────────────────────────────────────────────────────────
export interface FluidRow {
  tempF: number;
  /** Weight density γ (lbf/ft³ ≡ lbm/ft³). Divide by g_c for slug/ft³. */
  densityLbFt3: number;
  /** Dynamic (absolute) viscosity μ, lbf·s/ft² (= slug/(ft·s)). */
  dynViscLbfSPerFt2: number;
}

export const WATER_PROPS: FluidRow[] = [
  { tempF: 32, densityLbFt3: 62.42, dynViscLbfSPerFt2: 3.746e-5 },
  { tempF: 40, densityLbFt3: 62.43, dynViscLbfSPerFt2: 3.228e-5 },
  { tempF: 50, densityLbFt3: 62.41, dynViscLbfSPerFt2: 2.73e-5 },
  { tempF: 60, densityLbFt3: 62.37, dynViscLbfSPerFt2: 2.344e-5 },
  { tempF: 70, densityLbFt3: 62.3, dynViscLbfSPerFt2: 2.034e-5 },
  { tempF: 80, densityLbFt3: 62.22, dynViscLbfSPerFt2: 1.791e-5 },
  { tempF: 90, densityLbFt3: 62.11, dynViscLbfSPerFt2: 1.59e-5 },
  { tempF: 100, densityLbFt3: 61.99, dynViscLbfSPerFt2: 1.424e-5 },
  { tempF: 110, densityLbFt3: 61.84, dynViscLbfSPerFt2: 1.284e-5 },
  { tempF: 120, densityLbFt3: 61.71, dynViscLbfSPerFt2: 1.168e-5 },
  { tempF: 130, densityLbFt3: 61.55, dynViscLbfSPerFt2: 1.069e-5 },
  { tempF: 140, densityLbFt3: 61.38, dynViscLbfSPerFt2: 9.81e-6 },
  { tempF: 150, densityLbFt3: 61.2, dynViscLbfSPerFt2: 9.06e-6 },
  { tempF: 160, densityLbFt3: 61.0, dynViscLbfSPerFt2: 8.42e-6 },
  { tempF: 180, densityLbFt3: 60.57, dynViscLbfSPerFt2: 7.27e-6 },
  { tempF: 200, densityLbFt3: 60.12, dynViscLbfSPerFt2: 6.36e-6 },
];

export const GLYCOL_30EG_PROPS: FluidRow[] = [
  { tempF: 20, densityLbFt3: 66.1, dynViscLbfSPerFt2: 1.82e-4 },
  { tempF: 32, densityLbFt3: 65.9, dynViscLbfSPerFt2: 1.19e-4 },
  { tempF: 40, densityLbFt3: 65.7, dynViscLbfSPerFt2: 9.01e-5 },
  { tempF: 50, densityLbFt3: 65.5, dynViscLbfSPerFt2: 6.59e-5 },
  { tempF: 60, densityLbFt3: 65.3, dynViscLbfSPerFt2: 5.01e-5 },
  { tempF: 70, densityLbFt3: 65.0, dynViscLbfSPerFt2: 3.9e-5 },
  { tempF: 80, densityLbFt3: 64.8, dynViscLbfSPerFt2: 3.09e-5 },
  { tempF: 90, densityLbFt3: 64.5, dynViscLbfSPerFt2: 2.5e-5 },
  { tempF: 100, densityLbFt3: 64.3, dynViscLbfSPerFt2: 2.05e-5 },
  { tempF: 120, densityLbFt3: 63.8, dynViscLbfSPerFt2: 1.44e-5 },
  { tempF: 140, densityLbFt3: 63.3, dynViscLbfSPerFt2: 1.05e-5 },
  { tempF: 160, densityLbFt3: 62.8, dynViscLbfSPerFt2: 7.95e-6 },
  { tempF: 180, densityLbFt3: 62.2, dynViscLbfSPerFt2: 6.2e-6 },
  { tempF: 200, densityLbFt3: 61.7, dynViscLbfSPerFt2: 4.96e-6 },
];

export const FLUID_TABLE: Record<FluidType, FluidRow[]> = {
  water: WATER_PROPS,
  glycol_30eg: GLYCOL_30EG_PROPS,
};

/** Valid temperature range for a fluid's property table (for input validation). */
export function fluidTempRange(fluid: FluidType): { min: number; max: number } {
  const t = FLUID_TABLE[fluid];
  return { min: t[0].tempF, max: t[t.length - 1].tempF };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fitting tables  (spec/06 §5)
// ─────────────────────────────────────────────────────────────────────────────

/** Equivalent length in pipe diameters. */
export const FITTING_EL: Record<FittingType, number> = {
  elbow_90_std: 30,
  elbow_90_lr: 16,
  elbow_45: 16,
  tee_thru: 20,
  tee_branch: 60,
  gate_valve: 7,
  globe_valve: 340,
  ball_valve: 3,
  butterfly_valve: 45,
  check_swing: 100,
  check_spring: 150,
  y_strainer: 60,
  flex_connection: 5,
  reducer_concentric: 5,
  coupling: 2,
  control_2way: 200,
  control_3way: 300,
  balancing_valve: 60,
  picv: 250,
  prv: 200,
  drain_valve: 3,
};

/** Dimensionless K-factors (loss coefficient). */
export const FITTING_K: Record<FittingType, number> = {
  elbow_90_std: 0.9,
  elbow_90_lr: 0.6,
  elbow_45: 0.4,
  tee_thru: 0.6,
  tee_branch: 1.8,
  gate_valve: 0.2,
  globe_valve: 10.0,
  ball_valve: 0.1,
  butterfly_valve: 1.5,
  check_swing: 2.5,
  check_spring: 4.0,
  y_strainer: 2.0,
  flex_connection: 0.2,
  reducer_concentric: 0.1,
  coupling: 0.05,
  control_2way: 6.0,
  control_3way: 8.0,
  balancing_valve: 1.5,
  picv: 6.0,
  prv: 6.0,
  drain_valve: 0.1,
};

export const FITTING_LABELS: Record<FittingType, string> = {
  elbow_90_std: '90° Standard Elbow',
  elbow_90_lr: '90° Long-Radius Elbow',
  elbow_45: '45° Elbow',
  tee_thru: 'Tee — Straight Through',
  tee_branch: 'Tee — Branch Flow',
  ball_valve: 'Ball Valve',
  gate_valve: 'Gate Valve',
  globe_valve: 'Globe Valve',
  butterfly_valve: 'Butterfly Valve',
  check_swing: 'Swing Check Valve',
  check_spring: 'Spring Check Valve',
  control_2way: '2-Way Control Valve',
  control_3way: '3-Way Control Valve',
  balancing_valve: 'Balancing Valve',
  picv: 'PICV',
  prv: 'PRV',
  drain_valve: 'Ball Drain Valve',
  y_strainer: 'Y-Strainer',
  flex_connection: 'Flex Connection',
  reducer_concentric: 'Reducer — Concentric',
  coupling: 'Coupling / Union',
};

/** Grouped fitting categories for the picker dropdown (spec/05). */
export interface FittingGroup {
  name: string;
  types: FittingType[];
}

export const FITTING_GROUPS: FittingGroup[] = [
  { name: 'Elbows', types: ['elbow_90_std', 'elbow_90_lr', 'elbow_45'] },
  { name: 'Tees & Branches', types: ['tee_thru', 'tee_branch'] },
  { name: 'Valves — Shut-Off', types: ['ball_valve', 'gate_valve', 'globe_valve', 'butterfly_valve'] },
  { name: 'Valves — Check', types: ['check_swing', 'check_spring'] },
  {
    name: 'Valves — Control & Specialty',
    types: ['control_2way', 'control_3way', 'balancing_valve', 'picv', 'prv', 'drain_valve'],
  },
  { name: 'Accessories', types: ['y_strainer', 'flex_connection', 'reducer_concentric', 'coupling'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Node defaults & labels  (spec/04)
// ─────────────────────────────────────────────────────────────────────────────

/** Default pressure drop per node kind (ft WC). */
export const NODE_DEFAULT_PD: Record<NodeKind, number> = {
  pump: 0,
  chiller_boiler: 14.0,
  plate_hx: 10.0,
  buffer_tank: 0.5,
  hydraulic_sep: 0.5,
  air_sep: 1.0,
  expansion_tank: 0,
  coil: 8.0,
  flow_meter: 2.0,
  branch: 0,
  user_defined: 0,
};

/** Display label per node kind. */
export const NODE_LABELS: Record<NodeKind, string> = {
  pump: 'Pump',
  chiller_boiler: 'Chiller / Heat Pump',
  plate_hx: 'Plate Heat Exchanger',
  buffer_tank: 'Buffer Tank',
  hydraulic_sep: 'Hydraulic Separator',
  air_sep: 'Air Separator',
  expansion_tank: 'Expansion Tank',
  coil: 'AHU / FCU Coil',
  flow_meter: 'Flow / BTU Meter',
  branch: 'Branch / Tee',
  user_defined: 'User-Defined',
};

/** Component kinds that carry a ΔP (used for warnings/iteration). */
export const COMPONENT_KINDS: ComponentKind[] = [
  'chiller_boiler', 'plate_hx', 'buffer_tank', 'hydraulic_sep', 'air_sep',
  'expansion_tank', 'coil', 'flow_meter', 'user_defined',
];

// ─────────────────────────────────────────────────────────────────────────────
// Display labels for enums
// ─────────────────────────────────────────────────────────────────────────────
export const FLUID_LABELS: Record<FluidType, string> = {
  water: '100% Water',
  glycol_30eg: '30% EG Glycol',
};

export const MATERIAL_LABELS: Record<PipeMaterial, string> = {
  steel_sch40: 'Steel Sch 40',
  copper_typeL: 'Copper Type L',
};

export const FITTING_METHOD_LABELS: Record<FittingMethod, string> = {
  equiv_length: 'Equivalent Length',
  k_factor: 'K-Factor',
};

export const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  chw: 'Chilled Water',
  hw: 'Heating Water',
  cw: 'Condenser Water',
  other: 'Other',
};

export const SYSTEM_COLOR: Record<SystemType, string> = {
  chw: '#2563EB',
  hw: '#EA580C',
  cw: '#0D9488',
  other: '#6B7280',
};

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds & conversion constants
// ─────────────────────────────────────────────────────────────────────────────
export const V_WARN_FPS = 4.0; // yellow above this
export const V_MAX_FPS = 8.0; // red above this
export const G_FT_S2 = 32.174; // gravitational acceleration g (ft/s²)
export const GC_LBM = 32.174; // g_c (lbm·ft / lbf·s²) — converts weight density → mass density
export const FT_PER_PSI = 2.3067; // ft WC per psi (spec/06 §6)

// Reynolds-number flow-regime boundaries.
//   Re < RE_LAMINAR_MAX          → laminar,      f = 64/Re
//   RE_LAMINAR_MAX ≤ Re < RE_TURBULENT_MIN → transitional/critical zone (uncertain)
//   Re ≥ RE_TURBULENT_MIN        → fully turbulent, Colebrook-White
export const RE_LAMINAR_MAX = 2300;
export const RE_TURBULENT_MIN = 4000;

/** TDH color bands (ft) for the Summary readout. */
export const TDH_YELLOW_FT = 30;
export const TDH_RED_FT = 60;
