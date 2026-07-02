import { Position } from 'reactflow';

/**
 * Orthogonal pipe path whose elbow can be freely slid, used when a pipe run has a
 * manual routing nudge (see types.ts `offset`). React Flow's `getSmoothStepPath`
 * only honors a custom center for strictly opposing handle sides, so we render our
 * own step path here — with the same rounded corners (`getBend`, ported verbatim
 * from @reactflow/core) so a slid pipe looks identical to the auto-routed default.
 *
 * The slide moves the middle run perpendicular to its own direction: for a
 * horizontal connection (Left/Right handles) the vertical mid-segment tracks
 * `centerX`; for a vertical connection (Top/Bottom) the horizontal mid-segment
 * tracks `centerY`. Mixed/same-side pairs fall back to a simple L-bend.
 */
type Pt = { x: number; y: number };

const GAP = 16; // straight stub length before the pipe is allowed to bend

function dirOf(pos: Position): Pt {
  switch (pos) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 1 };
  }
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Rounded corner between a→b→c (ported from @reactflow/core getBend). */
function getBend(a: Pt, b: Pt, c: Pt, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const { x, y } = b;
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) return `L${x} ${y}`;
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}

/** Drops consecutive duplicate points so no zero-length bend is generated. */
function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

function pointsToPath(points: Pt[], radius: number): string {
  return points.reduce((res, p, i) => {
    if (i > 0 && i < points.length - 1) return res + getBend(points[i - 1], p, points[i + 1], radius);
    return res + `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`;
  }, '');
}

export function getSlidablePath(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
  centerX: number,
  centerY: number,
  radius = 8
): [string, number, number] {
  const sd = dirOf(sourcePosition);
  const td = dirOf(targetPosition);
  const sGap = { x: sourceX + sd.x * GAP, y: sourceY + sd.y * GAP };
  const tGap = { x: targetX + td.x * GAP, y: targetY + td.y * GAP };
  const sHoriz = sd.x !== 0;
  const tHoriz = td.x !== 0;

  let mid: Pt[];
  let labelX: number;
  let labelY: number;
  if (sHoriz && tHoriz) {
    mid = [{ x: centerX, y: sGap.y }, { x: centerX, y: tGap.y }];
    labelX = centerX;
    labelY = (sGap.y + tGap.y) / 2;
  } else if (!sHoriz && !tHoriz) {
    mid = [{ x: sGap.x, y: centerY }, { x: tGap.x, y: centerY }];
    labelX = (sGap.x + tGap.x) / 2;
    labelY = centerY;
  } else if (sHoriz) {
    mid = [{ x: tGap.x, y: sGap.y }];
    labelX = tGap.x;
    labelY = sGap.y;
  } else {
    mid = [{ x: sGap.x, y: tGap.y }];
    labelX = sGap.x;
    labelY = tGap.y;
  }

  const points = dedupe([{ x: sourceX, y: sourceY }, sGap, ...mid, tGap, { x: targetX, y: targetY }]);
  return [pointsToPath(points, radius), labelX, labelY];
}
