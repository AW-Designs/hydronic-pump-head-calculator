import type {
  RFNode,
  RFEdge,
  ProjectInfo,
  TDHResults,
  SegmentRow,
  Warning,
  ComponentNodeData,
  NodeData,
  PipeRunEdgeData,
} from '../types';
import { computePipeRun } from './engine';
import { V_WARN_FPS, V_MAX_FPS, NODE_LABELS, nextSizeUp } from './constants';

const sizeLabelFor = (d: PipeRunEdgeData): string => `${d.nominalSize}"`;

/** Display name for any node (pump / component / branch). */
function nodeLabel(data: NodeData): string {
  return data.label || NODE_LABELS[data.kind];
}

function emptyResults(warnings: Warning[]): TDHResults {
  return {
    totalPipeFrictionFt: 0,
    totalFittingLossFt: 0,
    totalComponentDropFt: 0,
    subtotalFt: 0,
    safetyFactorFt: 0,
    designTdhFt: 0,
    designFlowGpm: 0,
    rows: [],
    warnings,
    loopElementIds: new Set(),
    loopClosed: false,
    status: 'empty',
    isValidForDesign: false,
    statusReasons: [],
  };
}

/**
 * Trace a SINGLE hydronic loop ("critical / index loop") starting at the pump
 * output, walking edges in their React Flow source→target direction, and
 * accumulating pipe-run and component losses until the traversal returns to the
 * pump (loop closed) or runs out of edges.
 *
 * This is deliberately a *manual critical-loop* solver, not a network solver:
 *   • The engineer is responsible for drawing the one governing loop.
 *   • Edges into a branch node are excluded from TDH (branches mark where
 *     non-critical sub-loops split off).
 *   • When a traced node has more than one continuing pipe run, the FIRST one in
 *     creation order is followed deterministically AND a warning is raised so the
 *     ambiguity is never silent.
 *   • Pipe runs connected to the model but not on the traced loop are reported as
 *     ignored, so the user knows they are excluded from TDH.
 */
export function computeTDH(nodes: RFNode[], edges: RFEdge[], project: ProjectInfo): TDHResults {
  const warnings: Warning[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const pumps = nodes.filter((n) => n.data.kind === 'pump');
  if (pumps.length === 0) {
    warnings.push({
      id: '__no_pump__',
      elementType: 'node',
      severity: 'red',
      message: 'No pump node found — place a Pump node to start the loop.',
    });
    return emptyResults(warnings);
  }
  if (pumps.length > 1) {
    warnings.push({
      id: '__multi_pump__',
      elementType: 'node',
      severity: 'yellow',
      message: `${pumps.length} pumps placed — only the loop starting at "${nodeLabel(
        pumps[0].data
      )}" is traced. Model one pump loop at a time.`,
    });
  }
  const pump = pumps[0];

  const rows: SegmentRow[] = [];
  const loopElementIds = new Set<string>([pump.id]);
  const visitedEdges = new Set<string>();
  const visitedNodes = new Set<string>();

  let totalPipe = 0;
  let totalFitting = 0;
  let totalComponent = 0;
  let cumulative = 0;
  let designFlowGpm = 0; // max GPM among traced loop pipe runs (pump-discharge basis)
  let current = pump.id;
  let loopClosed = false;
  let missingCount = 0;
  let overVelCount = 0;

  const maxSteps = edges.length + nodes.length + 2; // guard against cycles in malformed graphs
  let steps = 0;

  while (steps++ < maxSteps) {
    // All un-traversed pipe runs leaving the current node.
    const outgoing = edges.filter(
      (e) => e.source === current && e.data && !visitedEdges.has(e.id)
    );
    if (outgoing.length === 0) break;

    // Edges into a branch node are excluded from the loop entirely.
    const branchEdges = outgoing.filter((e) => nodeById.get(e.target)?.data.kind === 'branch');
    branchEdges.forEach((e) => visitedEdges.add(e.id));

    const loopEdges = outgoing.filter((e) => nodeById.get(e.target)?.data.kind !== 'branch');
    if (loopEdges.length === 0) break;

    // Deterministic choice: first continuing run in creation order. Warn if ambiguous.
    if (loopEdges.length > 1) {
      const chosen = loopEdges[0];
      const others = loopEdges
        .slice(1)
        .map((e) => `"${e.data!.label || 'run'}"`)
        .join(', ');
      const node = nodeById.get(current);
      const where = node ? nodeLabel(node.data) : 'A node';
      warnings.push({
        id: current,
        elementType: 'node',
        severity: 'yellow',
        message: `${where}: ${loopEdges.length} pipe runs leave this node — only "${
          chosen.data!.label || 'the first run'
        }" is traced; ${others} ${
          loopEdges.length > 2 ? 'are' : 'is'
        } excluded from TDH. A single loop should have one outlet per node — remove the extra run(s) or mark the sub-loop with a Branch node.`,
      });
    }

    const edge = loopEdges[0];
    visitedEdges.add(edge.id);
    const target = nodeById.get(edge.target)!;
    const data = edge.data!;
    const calc = computePipeRun(data, project);
    loopElementIds.add(edge.id);
    if (data.flowGpm > designFlowGpm) designFlowGpm = data.flowGpm;

    let rowWarning: SegmentRow['warning'];
    const runName = data.label || 'Pipe run';
    const sizeStr = `${data.nominalSize}"`;

    if (calc.missingData) {
      rowWarning = 'missing';
      missingCount++;
      const missing: string[] = [];
      if (!(data.flowGpm > 0)) missing.push('flow rate (GPM)');
      if (!(data.lengthFt > 0)) missing.push('length (ft)');
      warnings.push({
        id: edge.id,
        elementType: 'edge',
        severity: 'red',
        message: `${runName} (${sizeStr}): missing ${missing.join(
          ' and '
        )}. This run contributes 0 to TDH until complete — open it and fill in the missing value(s).`,
      });
    }

    if (calc.velocityFps > V_MAX_FPS) {
      rowWarning = 'velocity';
      overVelCount++;
      const up = nextSizeUp(data.material, data.nominalSize);
      warnings.push({
        id: edge.id,
        elementType: 'edge',
        severity: 'red',
        message: `${runName}: velocity ${calc.velocityFps.toFixed(1)} fps at ${data.flowGpm} GPM in ${sizeStr} pipe — over the 8 fps maximum (erosion/noise risk). ${
          up ? `Upsize to ${up}" or reduce flow.` : 'Reduce flow or use a larger pipe class.'
        }`,
      });
    } else if (calc.velocityFps > V_WARN_FPS) {
      if (rowWarning !== 'missing') rowWarning = 'velocity';
      const up = nextSizeUp(data.material, data.nominalSize);
      warnings.push({
        id: edge.id,
        elementType: 'edge',
        severity: 'yellow',
        message: `${runName}: velocity ${calc.velocityFps.toFixed(1)} fps at ${data.flowGpm} GPM in ${sizeStr} pipe — above the 4 fps design guideline.${
          up ? ` Consider upsizing to ${up}" to cut friction and noise.` : ''
        }`,
      });
    }

    // Transitional / critical-zone flow: friction factor is uncertain here.
    if (calc.flowRegime === 'transitional') {
      if (!rowWarning) rowWarning = 'transitional';
      warnings.push({
        id: edge.id,
        elementType: 'edge',
        severity: 'yellow',
        message: `${runName} (${sizeStr}, ${data.flowGpm} GPM): Reynolds ${Math.round(
          calc.reynoldsNumber
        ).toLocaleString()} is in the transitional zone (2,300–4,000) where friction is uncertain — the conservative turbulent value is used. Verify flow; a larger pipe or lower flow may put it firmly in one regime.`,
      });
    }

    totalPipe += calc.pipeFrictionFt;
    totalFitting += calc.fittingLossFt;
    cumulative += calc.segmentTotalFt;

    rows.push({
      elementId: edge.id,
      elementType: 'edge',
      label: data.label || 'Pipe run',
      flowGpm: data.flowGpm,
      sizeLabel: sizeLabelFor(data),
      velocityFps: calc.velocityFps,
      frictionRatePer100: calc.frictionRatePer100,
      pipeFrictionFt: calc.pipeFrictionFt,
      fittingLossFt: calc.fittingLossFt,
      componentDropFt: 0,
      segmentTotalFt: calc.segmentTotalFt,
      cumulativeFt: cumulative,
      warning: rowWarning,
    });

    current = edge.target;

    // Loop closed back to the pump.
    if (current === pump.id) {
      loopClosed = true;
      break;
    }

    // Avoid revisiting a node (defensive against pathological graphs).
    if (visitedNodes.has(current)) break;
    visitedNodes.add(current);
    loopElementIds.add(current);

    // Component node row (pump contributes nothing, already excluded above).
    if (target.data.kind !== 'pump') {
      const comp = target.data as ComponentNodeData;
      const dropFt = comp.pressureDrop ?? 0;
      totalComponent += dropFt;
      cumulative += dropFt;

      rows.push({
        elementId: target.id,
        elementType: 'node',
        label: comp.label || NODE_LABELS[comp.kind],
        flowGpm: data.flowGpm, // inherited from the upstream edge
        sizeLabel: '—',
        velocityFps: 0,
        frictionRatePer100: 0,
        pipeFrictionFt: 0,
        fittingLossFt: 0,
        componentDropFt: dropFt,
        segmentTotalFt: dropFt,
        cumulativeFt: cumulative,
      });

      if (dropFt === 0) {
        warnings.push({
          id: target.id,
          elementType: 'node',
          severity: 'yellow',
          message: `${comp.label || NODE_LABELS[comp.kind]} (${
            NODE_LABELS[comp.kind]
          }): pressure drop is 0 ft — enter the manufacturer's ΔP, otherwise this component adds nothing to the TDH.`,
        });
      }
    }
  }

  if (!loopClosed && edges.length > 0) {
    const endNode = nodeById.get(current);
    const atPump = current === pump.id;
    warnings.push({
      // Clickable: jump to where the path dead-ends (the pump if nothing was traced).
      id: current,
      elementType: 'node',
      severity: 'red',
      message: atPump
        ? `Loop is not closed — no pipe run leaves "${nodeLabel(
            pump.data
          )}". Connect the pump outlet to the first component.`
        : `Loop is not closed — the traced path dead-ends at "${
            endNode ? nodeLabel(endNode.data) : 'a component'
          }". Connect its outlet back to the pump inlet to close the loop.`,
    });
  }

  // Connected pipe runs that are NOT on the traced loop and not branch connectors.
  // These are silently ignored by a single-loop solver, so surface them.
  const ignored = edges.filter((e) => {
    if (!e.data || loopElementIds.has(e.id)) return false;
    const srcBranch = nodeById.get(e.source)?.data.kind === 'branch';
    const tgtBranch = nodeById.get(e.target)?.data.kind === 'branch';
    return !srcBranch && !tgtBranch; // branch-connected runs are an intended exclusion
  });
  if (ignored.length > 0) {
    const labels = ignored.slice(0, 4).map((e) => `"${e.data!.label || 'run'}"`).join(', ');
    const more = ignored.length > 4 ? `, +${ignored.length - 4} more` : '';
    warnings.push({
      // Clickable: jump to the first off-loop run.
      id: ignored[0].id,
      elementType: 'edge',
      severity: 'yellow',
      message: `${ignored.length} pipe run(s) are connected but off the traced loop and excluded from TDH: ${labels}${more}. Trace one continuous loop, or mark sub-loops with Branch nodes.`,
    });
  }

  if (project.safetyFactor <= 0) {
    warnings.push({
      id: '__safety__',
      elementType: 'node',
      severity: 'yellow',
      message: 'No safety factor set. Consider adding 10–15%.',
    });
  }

  const subtotal = totalPipe + totalFitting + totalComponent;
  const safetyFt = subtotal * project.safetyFactor;
  const designTdh = subtotal + safetyFt;

  // Red warnings first, then yellow.
  warnings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1));

  // ── Calculation status / design validity ──────────────────────────────────
  const hasTracedRuns = rows.some((r) => r.elementType === 'edge');
  const statusReasons: string[] = [];
  if (!loopClosed && edges.length > 0) statusReasons.push('Loop is not closed back to the pump.');
  if (missingCount > 0)
    statusReasons.push(`${missingCount} traced pipe run(s) are missing size, flow, or length.`);
  if (overVelCount > 0)
    statusReasons.push(`${overVelCount} traced pipe run(s) exceed the maximum velocity (8 fps).`);

  let status: TDHResults['status'];
  if (!hasTracedRuns) {
    status = 'empty';
  } else if (loopClosed && missingCount === 0 && overVelCount === 0) {
    status = 'valid';
  } else {
    status = 'provisional';
  }
  const isValidForDesign = status === 'valid';

  return {
    totalPipeFrictionFt: totalPipe,
    totalFittingLossFt: totalFitting,
    totalComponentDropFt: totalComponent,
    subtotalFt: subtotal,
    safetyFactorFt: safetyFt,
    designTdhFt: designTdh,
    designFlowGpm,
    rows,
    warnings,
    loopElementIds,
    loopClosed,
    status,
    isValidForDesign,
    statusReasons,
  };
}
