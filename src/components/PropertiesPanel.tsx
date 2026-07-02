import { useState } from 'react';
import { useStore } from '../store';
import type {
  PipeRunEdgeData, ComponentNodeData, PumpNodeData, BranchNodeData, FittingType, NominalSize, PipeMaterial, FlowRegime,
} from '../types';
import { computePipeRun, fittingLossOne, ftToPsi, psiToFt } from '../calc/engine';
import {
  FITTING_EL, FITTING_K, FITTING_LABELS, FITTING_GROUPS, FITTING_METHOD_LABELS,
  MATERIAL_LABELS, NODE_LABELS, availableSizes, V_WARN_FPS, V_MAX_FPS,
} from '../calc/constants';

// ── Shared field primitives ──────────────────────────────────────────────────
function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</div>
        {badge}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

const inputCls = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded font-mono';
const selectCls = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded';

function Calc({ label, value, unit, valueColor }: { label: string; value: string; unit?: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b border-gray-100">
      <span className="field-label">{label}</span>
      <span className="calc-value field-value text-right" style={valueColor ? { color: valueColor } : undefined}>
        {value}
        {unit && <span className="text-[10px] text-gray-400 font-sans ml-1">{unit}</span>}
      </span>
    </div>
  );
}

function ElementWarnings({ id }: { id: string }) {
  const warnings = useStore((s) => s.results.warnings.filter((w) => w.id === id));
  if (warnings.length === 0) return null;
  return (
    <div className="mb-4 space-y-1.5">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 text-[11px] px-2 py-1.5 rounded"
          style={{
            background: w.severity === 'red' ? '#FEF2F2' : '#FFFBEB',
            color: w.severity === 'red' ? '#991B1B' : '#92400E',
          }}
        >
          <span>{w.severity === 'red' ? '🔴' : '🟡'}</span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}

function velColor(v: number): string | undefined {
  if (v > V_MAX_FPS) return '#DC2626';
  if (v > V_WARN_FPS) return '#D97706';
  return undefined;
}

const REGIME_LABEL: Record<FlowRegime, string> = {
  none: '—',
  laminar: 'Laminar',
  transitional: 'Transitional',
  turbulent: 'Turbulent',
};

// ── Pipe run (edge) ──────────────────────────────────────────────────────────
function EdgeProps({ id, data }: { id: string; data: PipeRunEdgeData }) {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.updateEdgeData);
  const addFitting = useStore((s) => s.addFitting);
  const setFittingQty = useStore((s) => s.setFittingQty);
  const removeFitting = useStore((s) => s.removeFitting);
  const [pickerValue, setPickerValue] = useState('');

  const calc = computePipeRun(data, project);
  const method = project.fittingMethod;
  const sizes = availableSizes(data.material);
  const areaIn2 = calc.areaSqFt * 144;

  const fittingSubtotal = calc.missingData
    ? 0
    : data.fittings.reduce((sum, f) => sum + fittingLossOne(f.type, f.quantity, calc, method), 0);

  return (
    <>
      <ElementWarnings id={id} />

      <Section title="Pipe">
        <Field label="Label">
          <input className={inputCls} value={data.label} onChange={(e) => update(id, { label: e.target.value })} />
        </Field>
        <Field label="Nominal Size">
          <select
            className={selectCls}
            value={data.nominalSize}
            onChange={(e) => update(id, { nominalSize: e.target.value as NominalSize })}
          >
            {sizes.map((s) => (
              <option key={s} value={s}>{s}"</option>
            ))}
          </select>
        </Field>
        <Field label="Pipe Material">
          <select
            className={selectCls}
            value={data.material}
            onChange={(e) => {
              const material = e.target.value as PipeMaterial;
              // Clamp size to one available for the new material.
              const avail = availableSizes(material);
              const nominalSize = avail.includes(data.nominalSize) ? data.nominalSize : avail[avail.length - 1];
              update(id, { material, nominalSize });
            }}
          >
            {(Object.keys(MATERIAL_LABELS) as PipeMaterial[]).map((m) => (
              <option key={m} value={m}>{MATERIAL_LABELS[m]}</option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <Field label="Flow (GPM)">
            <input
              type="number" min={0} step={1} className={inputCls}
              value={data.flowGpm || ''}
              onChange={(e) => update(id, { flowGpm: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
          <Field label="Length (ft)">
            <input
              type="number" min={0} step={1} className={inputCls}
              value={data.lengthFt || ''}
              onChange={(e) => update(id, { lengthFt: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Calculated (auto)">
        <Calc label="Actual ID" value={calc.actualIdIn ? calc.actualIdIn.toFixed(3) : '—'} unit="in" />
        <Calc label="Flow Area" value={areaIn2 ? areaIn2.toFixed(2) : '—'} unit="in²" />
        <Calc
          label="Velocity"
          value={calc.velocityFps ? calc.velocityFps.toFixed(2) : '—'}
          unit="fps"
          valueColor={velColor(calc.velocityFps)}
        />
        <Calc label="Reynolds No." value={calc.reynoldsNumber ? Math.round(calc.reynoldsNumber).toLocaleString() : '—'} />
        <Calc
          label="Flow Regime"
          value={REGIME_LABEL[calc.flowRegime]}
          valueColor={calc.flowRegime === 'transitional' ? '#D97706' : undefined}
        />
        <Calc label="Friction Rate" value={calc.frictionRatePer100 ? calc.frictionRatePer100.toFixed(3) : '—'} unit="ft/100ft" />
        <Calc label="Pipe Friction Loss" value={calc.missingData ? '—' : calc.pipeFrictionFt.toFixed(3)} unit="ft" />
      </Section>

      <Section
        title="Fittings"
        badge={
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-accent border border-blue-100">
            {FITTING_METHOD_LABELS[method]}
          </span>
        }
      >
        {data.fittings.length === 0 && (
          <div className="text-[11px] text-gray-400 italic">No fittings on this run yet.</div>
        )}
        {data.fittings.map((f) => {
          const coeff = method === 'equiv_length' ? `EL ${FITTING_EL[f.type]}` : `K ${FITTING_K[f.type]}`;
          const loss = calc.missingData ? null : fittingLossOne(f.type, f.quantity, calc, method);
          return (
            <div key={f.id} className="flex items-center gap-1.5 text-[11px]">
              <span className="flex-1 truncate text-gray-700" title={FITTING_LABELS[f.type]}>
                {FITTING_LABELS[f.type]}
              </span>
              <input
                type="number" min={1} step={1}
                className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded font-mono text-center"
                value={f.quantity}
                onChange={(e) => setFittingQty(id, f.id, Number(e.target.value))}
              />
              <span className="w-12 text-right font-mono text-[10px] text-gray-400">{coeff}</span>
              <span className="w-14 text-right font-mono text-gray-700">{loss == null ? '—' : `${loss.toFixed(2)} ft`}</span>
              <button
                className="text-gray-400 hover:text-red-600 px-1"
                title="Remove fitting"
                onClick={() => removeFitting(id, f.id)}
              >
                ×
              </button>
            </div>
          );
        })}

        <select
          className={`${selectCls} mt-1`}
          value={pickerValue}
          onChange={(e) => {
            const t = e.target.value as FittingType;
            if (t) addFitting(id, t);
            setPickerValue('');
          }}
        >
          <option value="">+ Add Fitting…</option>
          {FITTING_GROUPS.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.types.map((t) => (
                <option key={t} value={t}>{FITTING_LABELS[t]}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {data.fittings.length > 0 && (
          <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
            <span className="field-label">Fitting Subtotal</span>
            <span className="calc-value field-value">{calc.missingData ? '—' : `${fittingSubtotal.toFixed(3)}`}<span className="text-[10px] text-gray-400 font-sans ml-1">ft</span></span>
          </div>
        )}
      </Section>

      <Section title="Segment Total">
        <div
          className="flex items-baseline justify-between px-3 py-2 rounded"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)' }}
        >
          <span className="text-xs font-semibold text-gray-600">Pipe + Fittings</span>
          <span className="font-mono text-lg font-bold text-accent">
            {calc.missingData ? '—' : calc.segmentTotalFt.toFixed(2)}
            <span className="text-[11px] text-gray-400 font-sans ml-1">ft</span>
          </span>
        </div>
        {calc.missingData && (
          <div className="text-[10px] text-gray-400 italic mt-1">
            Enter flow and length to include this run in the TDH total.
          </div>
        )}
      </Section>
    </>
  );
}

// ── Component node ───────────────────────────────────────────────────────────
function ComponentProps({ id, data }: { id: string; data: ComponentNodeData }) {
  const update = useStore((s) => s.updateNodeData);
  const unit = data.pressureDropUnit;
  const displayVal = unit === 'psi' ? ftToPsi(data.pressureDrop) : data.pressureDrop;

  return (
    <>
      <ElementWarnings id={id} />
      <Section title="Component">
        <Calc label="Type" value={NODE_LABELS[data.kind]} />
        <Field label="Label">
          <input className={inputCls} value={data.label} onChange={(e) => update(id, { label: e.target.value })} />
        </Field>
        <Field label="Pressure Drop">
          <div className="flex gap-1.5 items-center">
            <input
              type="number" min={0} step={unit === 'psi' ? 0.1 : 0.5} className={inputCls}
              value={Number(displayVal.toFixed(unit === 'psi' ? 2 : 2))}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0);
                update(id, { pressureDrop: unit === 'psi' ? psiToFt(v) : v });
              }}
            />
            <div className="flex rounded border border-gray-300 overflow-hidden shrink-0">
              {(['ft', 'psi'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => update(id, { pressureDropUnit: u })}
                  className={`px-2 h-[34px] text-xs font-medium ${
                    unit === u ? 'bg-accent text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {u === 'ft' ? 'ft WC' : 'psi'}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Notes">
          <textarea
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded resize-none"
            rows={3}
            value={data.notes}
            onChange={(e) => update(id, { notes: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Calculated">
        <Calc label="ΔP" value={data.pressureDrop.toFixed(2)} unit="ft WC" />
        <Calc label="ΔP" value={ftToPsi(data.pressureDrop).toFixed(2)} unit="psi" />
      </Section>
    </>
  );
}

// ── Pump node ────────────────────────────────────────────────────────────────
function PumpProps({ id, data }: { id: string; data: PumpNodeData }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <Section title="Pump">
      <Field label="Label">
        <input className={inputCls} value={data.label} onChange={(e) => update(id, { label: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={data.hasVfd}
          onChange={(e) => update(id, { hasVfd: e.target.checked })}
        />
        Has VFD (variable frequency drive)
      </label>
      <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 leading-snug">
        The pump is the source of head — it contributes 0 to TDH. Traversal starts at the pump
        output and the loop must close back to the pump input.
      </div>
    </Section>
  );
}

// ── Branch node ──────────────────────────────────────────────────────────────
function BranchProps({ id, data }: { id: string; data: BranchNodeData }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <Section title="Branch / Tee">
      <Field label="Label">
        <input className={inputCls} value={data.label} onChange={(e) => update(id, { label: e.target.value })} />
      </Field>
      <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 leading-snug">
        Branch nodes are reference-only and do not contribute to TDH. Pipe runs connected to a
        branch are excluded from the loop calculation.
      </div>
    </Section>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────
export default function PropertiesPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const selectedType = useStore((s) => s.selectedType);
  const node = useStore((s) => s.nodes.find((n) => n.id === s.selectedId));
  const edge = useStore((s) => s.edges.find((e) => e.id === s.selectedId));

  let title = 'Properties';
  let body: React.ReactNode;

  if (!selectedId) {
    body = (
      <div className="text-sm text-gray-400 italic px-1 py-2">
        Select a node or pipe run to edit its properties.
      </div>
    );
  } else if (selectedType === 'edge' && edge?.data) {
    title = 'Pipe Run';
    body = <EdgeProps id={edge.id} data={edge.data} />;
  } else if (selectedType === 'node' && node) {
    if (node.data.kind === 'pump') {
      title = 'Pump';
      body = <PumpProps id={node.id} data={node.data} />;
    } else if (node.data.kind === 'branch') {
      title = 'Branch';
      body = <BranchProps id={node.id} data={node.data} />;
    } else {
      title = NODE_LABELS[node.data.kind];
      body = <ComponentProps id={node.id} data={node.data} />;
    }
  } else {
    body = <div className="text-sm text-gray-400 italic px-1 py-2">Nothing selected.</div>;
  }

  return (
    <div className="w-full h-full bg-white border-l border-gray-200 overflow-y-auto">
      <div className="px-4 py-2.5 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="text-sm font-bold text-gray-800">{title}</div>
      </div>
      <div className="p-4">{body}</div>
    </div>
  );
}
