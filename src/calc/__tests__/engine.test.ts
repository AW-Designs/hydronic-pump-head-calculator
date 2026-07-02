import { describe, it, expect } from 'vitest';
import {
  interpolate,
  computeFluidProps,
  kinematicViscosityFt2S,
  frictionFactor,
  flowRegimeFor,
  computePipeRun,
  fittingElOne,
  fittingLossOne,
  ftToPsi,
  psiToFt,
} from '../engine';
import { WATER_PROPS, GC_LBM } from '../constants';
import type { PipeRunEdgeData, ProjectInfo } from '../types';

// Reference project: 50 °F water, steel Sch 40, equivalent-length fittings.
const baseProject = (over: Partial<ProjectInfo> = {}): ProjectInfo => ({
  name: 't', number: '', designer: '', date: '2026-01-01', loopId: 'L1',
  systemType: 'chw', fluidType: 'water', fluidTemp: 50,
  defaultPipeMaterial: 'steel_sch40', fittingMethod: 'equiv_length', safetyFactor: 0.1,
  ...over,
});

const run = (over: Partial<PipeRunEdgeData> = {}): PipeRunEdgeData => ({
  label: 'PR', nominalSize: '2', material: 'steel_sch40', flowGpm: 100, lengthFt: 100, fittings: [],
  ...over,
});

describe('fluid property interpolation', () => {
  it('clamps below the table to the first entry', () => {
    const r = interpolate(WATER_PROPS, -20);
    expect(r.tempF).toBe(32);
    expect(r.densityLbFt3).toBeCloseTo(62.42, 5);
    expect(r.dynViscLbfSPerFt2).toBeCloseTo(3.746e-5, 12);
  });

  it('clamps above the table to the last entry', () => {
    const r = interpolate(WATER_PROPS, 500);
    expect(r.tempF).toBe(200);
    expect(r.densityLbFt3).toBeCloseTo(60.12, 5);
  });

  it('interpolates linearly inside the range (55 °F = midpoint of 50/60)', () => {
    const r = interpolate(WATER_PROPS, 55);
    expect(r.densityLbFt3).toBeCloseTo(62.39, 5);
    expect(r.dynViscLbfSPerFt2).toBeCloseTo(2.537e-5, 9);
  });
});

describe('kinematic viscosity (dimensional correctness)', () => {
  it('derives ν = μ·g_c/ρ ≈ 1.407e-5 ft²/s for 50 °F water (NOT the ~32× low legacy value)', () => {
    const nu = kinematicViscosityFt2S(2.73e-5, 62.41);
    expect(nu).toBeCloseTo(1.4074e-5, 8);
    // Legacy bug omitted g_c, giving ~4.37e-7 — guard against regression.
    expect(nu / (2.73e-5 / 62.41)).toBeCloseTo(GC_LBM, 3);
  });

  it('computeFluidProps exposes the corrected ν', () => {
    const p = computeFluidProps('water', 50);
    expect(p.nuFt2S).toBeCloseTo(1.4074e-5, 8);
    expect(p.dynViscLbfSPerFt2).toBeCloseTo(2.73e-5, 12);
  });
});

describe('pipe velocity', () => {
  it('2" Sch 40 at 100 GPM ≈ 9.56 ft/s', () => {
    const c = computePipeRun(run({ flowGpm: 100 }), baseProject());
    expect(c.velocityFps).toBeCloseTo(9.561, 2);
  });
});

describe('Reynolds number and friction (turbulent, corrected viscosity)', () => {
  it('2" Sch 40, 100 GPM, 50 °F water → Re≈117,000, f≈0.0214, ~17.6 ft/100ft', () => {
    const c = computePipeRun(run({ flowGpm: 100 }), baseProject());
    expect(c.reynoldsNumber).toBeCloseTo(117018, -2); // within ~100
    expect(c.flowRegime).toBe('turbulent');
    expect(c.frictionFactor).toBeCloseTo(0.02140, 4);
    expect(c.frictionRatePer100).toBeCloseTo(17.649, 1);
  });
});

describe('laminar regime', () => {
  it('1 GPM gives Re<2300 and f = 64/Re', () => {
    const c = computePipeRun(run({ flowGpm: 1 }), baseProject());
    expect(c.reynoldsNumber).toBeLessThan(2300);
    expect(c.flowRegime).toBe('laminar');
    expect(c.frictionFactor).toBeCloseTo(64 / c.reynoldsNumber, 8);
  });
});

describe('transitional regime', () => {
  it('Re between 2300 and 4000 is classified transitional', () => {
    const c = computePipeRun(run({ flowGpm: 2.5 }), baseProject());
    expect(c.reynoldsNumber).toBeGreaterThan(2300);
    expect(c.reynoldsNumber).toBeLessThan(4000);
    expect(c.flowRegime).toBe('transitional');
  });

  it('flowRegimeFor boundaries', () => {
    expect(flowRegimeFor(0)).toBe('none');
    expect(flowRegimeFor(2299)).toBe('laminar');
    expect(flowRegimeFor(2300)).toBe('transitional');
    expect(flowRegimeFor(3999)).toBe('transitional');
    expect(flowRegimeFor(4000)).toBe('turbulent');
  });
});

describe('friction factor helper', () => {
  it('uses 64/Re below 2300', () => {
    expect(frictionFactor(1000, 0.00015, 0.17225)).toBeCloseTo(0.064, 5);
  });
  it('matches Colebrook for high Re', () => {
    expect(frictionFactor(117018, 0.00015, 2.067 / 12)).toBeCloseTo(0.0214, 4);
  });
});

describe('fitting losses', () => {
  it('equivalent length: one 90° std elbow on 2" = qty·30·ID_ft', () => {
    const c = computePipeRun(run({ flowGpm: 100 }), baseProject());
    expect(fittingElOne('elbow_90_std', 1, c)).toBeCloseTo(5.1675, 3);
    const loss = fittingLossOne('elbow_90_std', 1, c, 'equiv_length');
    expect(loss).toBeCloseTo((c.frictionRatePer100 / 100) * 5.1675, 4);
  });

  it('K-factor: one 90° std elbow (K=0.9) at 100 GPM ≈ 1.279 ft', () => {
    const c = computePipeRun(run({ flowGpm: 100 }), baseProject());
    const loss = fittingLossOne('elbow_90_std', 1, c, 'k_factor');
    expect(loss).toBeCloseTo(1.2786, 3);
  });
});

describe('missing-data handling', () => {
  it('zero flow → missingData, zero loss contribution, regime none', () => {
    const c = computePipeRun(run({ flowGpm: 0 }), baseProject());
    expect(c.missingData).toBe(true);
    expect(c.pipeFrictionFt).toBe(0);
    expect(c.segmentTotalFt).toBe(0);
  });
  it('zero length → missingData even with flow', () => {
    const c = computePipeRun(run({ flowGpm: 100, lengthFt: 0 }), baseProject());
    expect(c.missingData).toBe(true);
    // velocity still computed so the velocity warning can fire early
    expect(c.velocityFps).toBeGreaterThan(0);
  });
});

describe('pressure-unit conversions', () => {
  it('round-trips ft↔psi', () => {
    expect(ftToPsi(2.3067)).toBeCloseTo(1, 6);
    expect(psiToFt(1)).toBeCloseTo(2.3067, 6);
  });
});
