import { describe, it, expect } from 'vitest';
import { computeTDH } from '../criticalPath';
import { computePipeRun } from '../engine';
import type {
  RFNode, RFEdge, ProjectInfo, NodeData, PipeRunEdgeData, FluidType,
} from '../types';

const project = (over: Partial<ProjectInfo> = {}): ProjectInfo => ({
  name: 't', number: '', designer: '', date: '2026-01-01', loopId: 'L1',
  systemType: 'chw', fluidType: 'water' as FluidType, fluidTemp: 50,
  defaultPipeMaterial: 'steel_sch40', fittingMethod: 'equiv_length', safetyFactor: 0.1,
  ...over,
});

let counter = 0;
const node = (id: string, data: NodeData): RFNode =>
  ({ id, type: 'x', position: { x: counter++ * 10, y: 0 }, data } as RFNode);

const pump = (id = 'pump'): RFNode => node(id, { kind: 'pump', label: 'Pump', hasVfd: true });
const coil = (id: string, pd: number, label = 'Coil'): RFNode =>
  node(id, { kind: 'coil', label, pressureDrop: pd, pressureDropUnit: 'ft', notes: '' });

const runData = (over: Partial<PipeRunEdgeData> = {}): PipeRunEdgeData => ({
  label: 'PR', nominalSize: '2', material: 'steel_sch40', flowGpm: 50, lengthFt: 100, fittings: [],
  ...over,
});
const edge = (id: string, source: string, target: string, data = runData()): RFEdge =>
  ({ id, source, target, type: 'pipeRun', data } as RFEdge);

describe('valid closed loop', () => {
  it('aggregates pipe + fittings + equipment and applies the safety factor', () => {
    const p = project();
    const nodes = [pump(), coil('coil', 10)];
    const e1 = edge('e1', 'pump', 'coil', runData({ flowGpm: 50, lengthFt: 100 }));
    const e2 = edge('e2', 'coil', 'pump', runData({ flowGpm: 50, lengthFt: 80 }));
    const r = computeTDH(nodes, [e1, e2], p);

    expect(r.status).toBe('valid');
    expect(r.isValidForDesign).toBe(true);
    expect(r.loopClosed).toBe(true);
    expect(r.designFlowGpm).toBe(50);
    expect(r.totalComponentDropFt).toBeCloseTo(10, 6);

    // Cross-check pipe friction against the engine for the same edges.
    const c1 = computePipeRun(e1.data!, p);
    const c2 = computePipeRun(e2.data!, p);
    expect(r.totalPipeFrictionFt).toBeCloseTo(c1.pipeFrictionFt + c2.pipeFrictionFt, 6);

    const subtotal = r.totalPipeFrictionFt + r.totalFittingLossFt + r.totalComponentDropFt;
    expect(r.subtotalFt).toBeCloseTo(subtotal, 6);
    expect(r.safetyFactorFt).toBeCloseTo(subtotal * 0.1, 6);
    expect(r.designTdhFt).toBeCloseTo(subtotal * 1.1, 6);
  });
});

describe('open loop', () => {
  it('warns and is provisional when the loop never returns to the pump', () => {
    const r = computeTDH([pump(), coil('coil', 10)], [edge('e1', 'pump', 'coil')], project());
    expect(r.loopClosed).toBe(false);
    expect(r.status).toBe('provisional');
    expect(r.isValidForDesign).toBe(false);
    // Loop warning is now red, names the dead-end, and is clickable (id = that node).
    const loopWarn = r.warnings.find((w) => w.severity === 'red' && /not closed/i.test(w.message));
    expect(loopWarn).toBeDefined();
    expect(loopWarn!.id).toBe('coil');
  });
});

describe('missing data on the loop', () => {
  it('marks the result provisional and emits a red missing-data warning', () => {
    const nodes = [pump(), coil('coil', 10)];
    const e1 = edge('e1', 'pump', 'coil', runData({ flowGpm: 0, lengthFt: 100 })); // missing flow
    const e2 = edge('e2', 'coil', 'pump', runData({ flowGpm: 50, lengthFt: 80 }));
    const r = computeTDH(nodes, [e1, e2], project());

    expect(r.loopClosed).toBe(true);
    expect(r.status).toBe('provisional');
    expect(r.isValidForDesign).toBe(false);
    expect(r.statusReasons.some((s) => /missing/i.test(s))).toBe(true);
    expect(
      r.warnings.some((w) => w.id === 'e1' && w.severity === 'red' && /missing/i.test(w.message))
    ).toBe(true);
  });
});

describe('no pump', () => {
  it('returns an empty result with a red no-pump warning', () => {
    const r = computeTDH([coil('coil', 10)], [], project());
    expect(r.status).toBe('empty');
    expect(r.warnings.some((w) => w.id === '__no_pump__' && w.severity === 'red')).toBe(true);
  });
});

describe('ambiguous branching (multiple outgoing runs)', () => {
  it('traces the first deterministically and warns about the ambiguity', () => {
    const nodes = [pump(), coil('a', 5, 'A'), coil('b', 5, 'B')];
    const e1 = edge('e1', 'pump', 'a'); // first in creation order → traced
    const e2 = edge('e2', 'pump', 'b'); // second → ignored, but flagged
    const r = computeTDH(nodes, [e1, e2], project());

    expect(r.warnings.some((w) => /pipe runs leave this node/i.test(w.message))).toBe(true);
    // 'a' was traced (it appears in the loop), 'b' was not.
    expect(r.loopElementIds.has('e1')).toBe(true);
    expect(r.loopElementIds.has('e2')).toBe(false);
  });
});

describe('elements outside the traced loop', () => {
  it('warns about connected pipe runs that are excluded from TDH', () => {
    const nodes = [pump(), coil('coil', 10), coil('x', 5, 'X'), coil('y', 5, 'Y')];
    const loopA = edge('e1', 'pump', 'coil');
    const loopB = edge('e2', 'coil', 'pump');
    const stray = edge('e3', 'x', 'y'); // connected but off the loop
    const r = computeTDH(nodes, [loopA, loopB, stray], project());

    expect(r.loopClosed).toBe(true);
    // Off-loop warning lists the stray run and is clickable (id = the stray edge).
    const ignoredWarn = r.warnings.find((w) => /off the traced loop/i.test(w.message));
    expect(ignoredWarn).toBeDefined();
    expect(ignoredWarn!.id).toBe('e3');
  });
});

describe('transitional flow propagates a warning', () => {
  it('flags a traced run whose Reynolds number is in the transitional zone', () => {
    const nodes = [pump(), coil('coil', 10)];
    const e1 = edge('e1', 'pump', 'coil', runData({ flowGpm: 2.5, lengthFt: 100 }));
    const e2 = edge('e2', 'coil', 'pump', runData({ flowGpm: 2.5, lengthFt: 80 }));
    const r = computeTDH(nodes, [e1, e2], project());
    expect(r.warnings.some((w) => /transitional zone/i.test(w.message))).toBe(true);
  });
});
