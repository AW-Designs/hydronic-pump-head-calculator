import { memo, useCallback, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from 'reactflow';
import type { PipeRunEdgeData } from '../types';
import { useStore } from '../store';
import { computePipeRun, fittingLossOne } from '../calc/engine';
import { FITTING_LABELS, SYSTEM_COLOR, V_WARN_FPS, V_MAX_FPS } from '../calc/constants';
import { getSlidablePath } from '../utils/pipePath';

/** Stroke width scales gently with pipe size so larger mains read as heavier. */
function strokeFor(idIn: number): number {
  return Math.max(2, Math.min(7, 1.5 + idIn * 0.4));
}

/** Pixels the cursor must move before a mousedown becomes a slide (vs a click). */
const DRAG_THRESHOLD_PX = 3;

export const PipeRunEdge = memo(
  ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, source, target }: EdgeProps<PipeRunEdgeData>) => {
    const [expanded, setExpanded] = useState(false);
    const project = useStore((s) => s.project);
    const onLoop = useStore((s) => s.results.loopElementIds.has(id));
    const hasLoop = useStore((s) => s.results.loopElementIds.size > 0);
    const { screenToFlowPosition } = useReactFlow();
    const select = useStore((s) => s.select);
    const beginEdgeReshape = useStore((s) => s.beginEdgeReshape);
    const setEdgeOffset = useStore((s) => s.setEdgeOffset);

    // Branch-connected edges render muted/dashed and are excluded from TDH.
    const isBranchEdge = useStore((s) =>
      s.nodes.some((n) => n.data.kind === 'branch' && (n.id === source || n.id === target))
    );

    const focused = useStore((s) => s.selectedId === id);
    // Highest-severity warning attached to this edge (for the focus-ring color).
    const focusColor = useStore((s) => {
      let c: string | undefined;
      for (const w of s.results.warnings) {
        if (w.id === id) {
          if (w.severity === 'red') return '#DC2626';
          c = '#D97706';
        }
      }
      return c ?? '#2563EB';
    });

    const d = data!;
    const calc = computePipeRun(d, project);

    // Slide nudge shifts the elbow from its default midpoint (see types.ts `offset`).
    // getSmoothStepPath only honors a custom center for opposing handle sides, so
    // we render the default auto-route with it and switch to our own slidable
    // orthogonal path (same corner rounding) once the pipe has actually been slid.
    const offset = d.offset ?? { x: 0, y: 0 };
    const slid = offset.x !== 0 || offset.y !== 0;
    const [path, labelX, labelY] = slid
      ? getSlidablePath(
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          (sourceX + targetX) / 2 + offset.x,
          (sourceY + targetY) / 2 + offset.y
        )
      : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 8 });

    // Grab the pipe anywhere and slide it; the whole elbow shifts by the drag delta.
    // A press without movement is just a click (double-click opens properties), so a
    // stray tap never disturbs the route.
    const startPipeSlide = useCallback(
      (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startFlow = screenToFlowPosition({ x: startClientX, y: startClientY });
        const startOffset = { ...offset };
        let moved = false;
        const onMove = (ev: MouseEvent) => {
          if (!moved) {
            if (Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < DRAG_THRESHOLD_PX) return;
            moved = true;
            beginEdgeReshape();
          }
          const cur = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
          setEdgeOffset(id, { x: startOffset.x + (cur.x - startFlow.x), y: startOffset.y + (cur.y - startFlow.y) });
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      },
      [screenToFlowPosition, beginEdgeReshape, setEdgeOffset, id, offset]
    );

    const baseColor = SYSTEM_COLOR[project.systemType];
    const width = strokeFor(calc.actualIdIn || 2);
    const muted = !onLoop && hasLoop && !isBranchEdge;

    let stroke = baseColor;
    let opacity = 1;
    if (isBranchEdge) {
      stroke = '#9CA3AF';
      opacity = 0.5;
    } else if (muted) {
      opacity = 0.4;
    }
    if (selected) stroke = '#1E2A3A';

    const velFps = calc.velocityFps;
    const velHigh = velFps > V_MAX_FPS;
    const velWarn = velFps > V_WARN_FPS;

    return (
      <>
        {focused && (
          <path
            d={path}
            fill="none"
            stroke={focusColor}
            strokeWidth={width + 10}
            strokeLinecap="round"
            className="edge-focus-pulse"
          />
        )}
        {onLoop && (
          <path
            d={path}
            fill="none"
            stroke="#2563EB"
            strokeWidth={width + 6}
            strokeOpacity={0.22}
            strokeLinecap="round"
            className="loop-glow"
          />
        )}
        <BaseEdge
          id={id}
          path={path}
          style={{
            stroke,
            strokeWidth: width,
            opacity,
            strokeLinecap: 'round',
            strokeDasharray: isBranchEdge ? '6 4' : undefined,
          }}
        />
        {/* Wide invisible path: grab to slide the pipe, double-click to open properties. */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(18, width + 14)}
          style={{ cursor: 'grab' }}
          onMouseDown={startPipeSlide}
          onDoubleClick={(e) => {
            e.stopPropagation();
            select(id, 'edge');
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              opacity: muted ? 0.6 : 1,
            }}
            className="flex flex-col items-center gap-0.5"
          >
            <div
              className="font-mono text-[9px] px-1.5 py-0.5 rounded border bg-white/95 shadow-sm whitespace-nowrap flex items-center gap-1 cursor-pointer"
              style={{ borderColor: velWarn ? '#FCD34D' : '#E5E7EB', color: '#374151' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                select(id, 'edge');
              }}
              title="Double-click to edit pipe run"
            >
              <span className="font-semibold">{d.label}</span>
              <span className="text-gray-300">·</span>
              <span>{d.nominalSize}"</span>
              {d.flowGpm > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{d.flowGpm} GPM</span>
                </>
              )}
              {d.lengthFt > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{d.lengthFt} ft</span>
                </>
              )}
              {!calc.missingData ? (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="font-semibold text-gray-800">{calc.segmentTotalFt.toFixed(2)} ft</span>
                </>
              ) : (
                <span
                  className="ml-0.5 px-1 rounded bg-red-100 text-red-700 font-bold"
                  title="Missing pipe size, flow, or length"
                >
                  !
                </span>
              )}
              {velWarn && (
                <span
                  className="ml-0.5"
                  title={`Velocity ${velFps.toFixed(1)} fps`}
                  style={{ color: velHigh ? '#DC2626' : '#D97706' }}
                >
                  ⚠ {velFps.toFixed(1)} fps
                </span>
              )}
              {d.fittings.length > 0 && (
                <button
                  className="ml-0.5 text-accent hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                  }}
                  title={expanded ? 'Hide fittings' : 'Show fittings'}
                >
                  {expanded ? '▼' : '▶'}
                </button>
              )}
            </div>

            {expanded && d.fittings.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[220px] justify-center">
                {d.fittings.map((f) => {
                  const loss = calc.missingData ? 0 : fittingLossOne(f.type, f.quantity, calc, project.fittingMethod);
                  return (
                    <span
                      key={f.id}
                      className="font-mono text-[8px] px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-600 whitespace-nowrap"
                    >
                      {FITTING_LABELS[f.type]} ×{f.quantity} · {loss.toFixed(2)} ft
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

export const edgeTypes = { pipeRun: PipeRunEdge };
