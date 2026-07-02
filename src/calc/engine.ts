import type {
  FluidType,
  FittingType,
  FittingMethod,
  FlowRegime,
  PipeRunEdgeData,
  PipeRunCalc,
  ProjectInfo,
} from '../types';
import {
  FLUID_TABLE,
  PIPE_SIZES,
  ROUGHNESS,
  FITTING_EL,
  FITTING_K,
  G_FT_S2,
  GC_LBM,
  FT_PER_PSI,
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
  type FluidRow,
} from './constants';

// ── Fluid properties ────────────────────────────────────────────────────────

export interface FluidProps {
  /** Weight density γ (lbf/ft³ ≡ lbm/ft³). */
  densityLbFt3: number;
  /** Dynamic (absolute) viscosity μ, lbf·s/ft² (= slug/(ft·s)). */
  dynViscLbfSPerFt2: number;
  /** Kinematic viscosity ν (ft²/s) — derived, dimensionally correct. */
  nuFt2S: number;
}

/**
 * Kinematic viscosity ν (ft²/s) from dynamic viscosity and weight density.
 *
 *   ν = μ / ρ_mass ,  where ρ_mass = γ / g_c  (slug/ft³)
 *     = μ · g_c / γ
 *
 * μ is in lbf·s/ft² (= slug/(ft·s)) and γ is the weight density in lbf/ft³.
 * The g_c = 32.174 lbm·ft/(lbf·s²) factor is what the original spec table
 * omitted; including it makes Reynolds numbers physically correct.
 */
export function kinematicViscosityFt2S(dynViscLbfSPerFt2: number, densityLbFt3: number): number {
  if (densityLbFt3 <= 0) return 0;
  return (dynViscLbfSPerFt2 * GC_LBM) / densityLbFt3;
}

/**
 * Linear interpolation of a fluid-property table on temperature.
 * Clamps to the nearest table entry outside the table bounds (no extrapolation).
 */
export function interpolate(table: FluidRow[], tempF: number): FluidRow {
  if (tempF <= table[0].tempF) return table[0];
  if (tempF >= table[table.length - 1].tempF) return table[table.length - 1];

  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (tempF >= a.tempF && tempF <= b.tempF) {
      const t = (tempF - a.tempF) / (b.tempF - a.tempF);
      return {
        tempF,
        densityLbFt3: a.densityLbFt3 + t * (b.densityLbFt3 - a.densityLbFt3),
        dynViscLbfSPerFt2:
          a.dynViscLbfSPerFt2 + t * (b.dynViscLbfSPerFt2 - a.dynViscLbfSPerFt2),
      };
    }
  }
  return table[table.length - 1];
}

export function computeFluidProps(fluidType: FluidType, tempF: number): FluidProps {
  const row = interpolate(FLUID_TABLE[fluidType], tempF);
  return {
    densityLbFt3: row.densityLbFt3,
    dynViscLbfSPerFt2: row.dynViscLbfSPerFt2,
    nuFt2S: kinematicViscosityFt2S(row.dynViscLbfSPerFt2, row.densityLbFt3),
  };
}

// ── Friction factor (Colebrook-White) ───────────────────────────────────────

/**
 * Swamee-Jain explicit approximation — used as the initial estimate for the
 * Colebrook-White iteration.
 *   f₀ = 0.25 / [log10(ε/(3.7·D) + 5.74/Re^0.9)]²
 */
export function swameeJain(Re: number, eps: number, D: number): number {
  if (Re <= 0 || D <= 0) return 0;
  const denom = Math.log10(eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9));
  return 0.25 / (denom * denom);
}

/**
 * One Colebrook-White fixed-point iteration toward the implicit solution of:
 *   1/√f = -2·log10(ε/(3.7·D) + 2.51/(Re·√f))
 */
export function colebrookIterate(f: number, Re: number, eps: number, D: number): number {
  if (Re <= 0 || D <= 0 || f <= 0) return f;
  const sqrtF = Math.sqrt(f);
  const rhs = -2.0 * Math.log10(eps / (3.7 * D) + 2.51 / (Re * sqrtF));
  return 1 / (rhs * rhs);
}

/** Darcy-Weisbach head loss (ft):  h_f = f · (L/D) · V²/(2g). */
export function darcy(f: number, L: number, D: number, V: number): number {
  if (D <= 0) return 0;
  return f * (L / D) * (V * V) / (2 * G_FT_S2);
}

/** Classify the flow regime from the Reynolds number. */
export function flowRegimeFor(Re: number): FlowRegime {
  if (Re <= 0) return 'none';
  if (Re < RE_LAMINAR_MAX) return 'laminar';
  if (Re < RE_TURBULENT_MIN) return 'transitional';
  return 'turbulent';
}

/**
 * Darcy friction factor for a given Reynolds number, roughness and diameter.
 *
 *   • Re < 2300 (laminar):  f = 64/Re (exact).
 *   • Re ≥ 2300:            Colebrook-White (Swamee-Jain seed, 10 iterations).
 *
 * The transitional band (2300 ≤ Re < 4000) has no reliable closed form; using the
 * turbulent correlation there over-predicts friction slightly, which is the
 * conservative choice for pump sizing. computePipeRun flags this band so the
 * result is transparent rather than silently smoothed.
 */
export function frictionFactor(Re: number, eps: number, D: number): number {
  if (Re <= 0 || D <= 0) return 0;
  if (Re < RE_LAMINAR_MAX) return 64 / Re;
  let f = swameeJain(Re, eps, D);
  for (let i = 0; i < 10; i++) f = colebrookIterate(f, Re, eps, D);
  return f;
}

// ── Main pipe-run calculation ────────────────────────────────────────────────

const GPM_TO_CFS = 0.002228; // 1 GPM → ft³/s

const ZERO_CALC: PipeRunCalc = {
  actualIdIn: 0,
  areaSqFt: 0,
  velocityFps: 0,
  reynoldsNumber: 0,
  frictionFactor: 0,
  frictionRatePer100: 0,
  pipeFrictionFt: 0,
  fittingElFt: 0,
  fittingLossFt: 0,
  segmentTotalFt: 0,
  flowRegime: 'none',
  missingData: true,
};

/**
 * Full hydraulic picture for one pipe run.
 *
 * Follows the spec/06 §10 pseudocode. All values are imperial: ft, ft/s, ft²/s.
 * Velocity / Re / f are computed whenever flow and a valid size exist (so the
 * velocity warning can fire early), but the *loss contributions* are zeroed when
 * data is missing (flow = 0, length = 0, or size unavailable) so an incomplete
 * run contributes 0 to TDH — per spec/05 "Missing Data Handling".
 */
export function computePipeRun(edge: PipeRunEdgeData, project: ProjectInfo): PipeRunCalc {
  const pipeRow = PIPE_SIZES[edge.material]?.[edge.nominalSize];
  if (!pipeRow) return { ...ZERO_CALC };

  const fluid = computeFluidProps(project.fluidType, project.fluidTemp);
  const idIn = pipeRow.idIn;
  const idFt = idIn / 12;
  const areaFt2 = pipeRow.areaSqFt;

  const hasFlow = edge.flowGpm > 0;
  const hasLength = edge.lengthFt > 0;
  const missingData = !hasFlow || !hasLength;

  const V = hasFlow ? (edge.flowGpm * GPM_TO_CFS) / areaFt2 : 0;
  const eps = ROUGHNESS[edge.material];

  let Re = 0;
  let f = 0;
  if (V > 0 && fluid.nuFt2S > 0) {
    Re = (V * idFt) / fluid.nuFt2S;
    f = frictionFactor(Re, eps, idFt);
  }
  const flowRegime = flowRegimeFor(Re);

  // Friction rate (ft head / 100 ft of pipe)
  const hfPer100 = idFt > 0 ? f * (100 / idFt) * (V * V) / (2 * G_FT_S2) : 0;

  // Total fitting equivalent length (ft) — for display + EL method
  const totalElFt = edge.fittings.reduce(
    (sum, fit) => sum + fit.quantity * FITTING_EL[fit.type] * idFt,
    0
  );

  // Loss contributions are zeroed when the run is incomplete (contributes 0 to TDH).
  let pipeFrictionFt = 0;
  let fittingLossFt = 0;
  if (!missingData) {
    pipeFrictionFt = hfPer100 * (edge.lengthFt / 100);
    if (project.fittingMethod === 'equiv_length') {
      // fittingLoss = (frictionRate/100) × ΣEL_ft  — uses the segment's own friction rate
      fittingLossFt = (hfPer100 / 100) * totalElFt;
    } else {
      // K method: Σ K × V²/2g
      fittingLossFt = edge.fittings.reduce(
        (sum, fit) => sum + fit.quantity * FITTING_K[fit.type] * (V * V) / (2 * G_FT_S2),
        0
      );
    }
  }

  return {
    actualIdIn: idIn,
    areaSqFt: areaFt2,
    velocityFps: V,
    reynoldsNumber: Re,
    frictionFactor: f,
    frictionRatePer100: hfPer100,
    pipeFrictionFt,
    fittingElFt: totalElFt,
    fittingLossFt,
    segmentTotalFt: pipeFrictionFt + fittingLossFt,
    flowRegime,
    missingData,
  };
}

/**
 * Equivalent length (ft) contributed by a single fitting line item.
 *   EL_ft = quantity × C_diameters × (ID_in / 12)
 */
export function fittingElOne(type: FittingType, quantity: number, calc: PipeRunCalc): number {
  return quantity * FITTING_EL[type] * (calc.actualIdIn / 12);
}

/**
 * Head loss (ft) for a single fitting line item, given the parent run's computed
 * hydraulics. Mirrors the two-method logic in computePipeRun so the Properties
 * panel and canvas chips show numbers consistent with the segment total.
 */
export function fittingLossOne(
  type: FittingType,
  quantity: number,
  calc: PipeRunCalc,
  method: FittingMethod
): number {
  if (method === 'equiv_length') {
    return (calc.frictionRatePer100 / 100) * fittingElOne(type, quantity, calc);
  }
  return quantity * FITTING_K[type] * (calc.velocityFps * calc.velocityFps) / (2 * G_FT_S2);
}

// ── Unit conversions & formatting ────────────────────────────────────────────

export const ftToPsi = (ft: number): number => ft / FT_PER_PSI;
export const psiToFt = (psi: number): number => psi * FT_PER_PSI;

export const fmt = (n: number, decimals = 2): string =>
  Number.isFinite(n) ? n.toFixed(decimals) : '—';

export const fmt0 = (n: number): string =>
  Number.isFinite(n) ? Math.round(n).toLocaleString() : '—';
