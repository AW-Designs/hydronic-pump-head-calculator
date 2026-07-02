import { useStore } from '../store';
import type { FluidType, PipeMaterial, FittingMethod, SystemType } from '../types';
import {
  FLUID_LABELS, MATERIAL_LABELS, FITTING_METHOD_LABELS, SYSTEM_TYPE_LABELS, fluidTempRange,
} from '../calc/constants';

const field = 'w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded';
const labelCls = 'block';
const labelText = 'field-label';

export default function SettingsModal() {
  const project = useStore((s) => s.project);
  const setProject = useStore((s) => s.setProject);
  const close = () => useStore.getState().setSettingsOpen(false);

  const range = fluidTempRange(project.fluidType);
  const tempOutOfRange = project.fluidTemp < range.min || project.fluidTemp > range.max;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={close}>
      <div
        className="bg-white rounded-lg shadow-2xl w-[560px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white">
          <div className="text-base font-bold text-gray-800">Project & System Settings</div>
          <button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={close}>×</button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-3">
          {/* ── Project Info ── */}
          <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
            Project Information
          </div>
          <label className={`${labelCls} col-span-2`}>
            <span className={labelText}>Project Name</span>
            <input className={field} value={project.name} onChange={(e) => setProject({ name: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className={labelText}>Project Number</span>
            <input className={field} value={project.number} onChange={(e) => setProject({ number: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className={labelText}>Engineer</span>
            <input className={field} value={project.designer} onChange={(e) => setProject({ designer: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className={labelText}>Date</span>
            <input type="date" className={field} value={project.date} onChange={(e) => setProject({ date: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className={labelText}>Loop ID / Name</span>
            <input className={field} value={project.loopId} onChange={(e) => setProject({ loopId: e.target.value })} />
          </label>
          <label className={`${labelCls} col-span-2`}>
            <span className={labelText}>System Type</span>
            <select className={field} value={project.systemType} onChange={(e) => setProject({ systemType: e.target.value as SystemType })}>
              {(Object.keys(SYSTEM_TYPE_LABELS) as SystemType[]).map((t) => (
                <option key={t} value={t}>{SYSTEM_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          {/* ── System Settings ── */}
          <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3">
            System Settings
          </div>
          <label className={labelCls}>
            <span className={labelText}>Fluid</span>
            <select className={field} value={project.fluidType} onChange={(e) => setProject({ fluidType: e.target.value as FluidType })}>
              {(Object.keys(FLUID_LABELS) as FluidType[]).map((f) => (
                <option key={f} value={f}>{FLUID_LABELS[f]}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelText}>Fluid Temperature (°F)</span>
            <input
              type="number" step={1} className={field}
              value={project.fluidTemp}
              onChange={(e) => setProject({ fluidTemp: Number(e.target.value) || 0 })}
            />
          </label>
          {tempOutOfRange && (
            <div className="col-span-2 -mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
              Temperature is outside the {FLUID_LABELS[project.fluidType]} property table
              ({range.min}–{range.max}°F). Values will be clamped to the nearest table entry.
            </div>
          )}
          <label className={labelCls}>
            <span className={labelText}>Default Pipe Material</span>
            <select className={field} value={project.defaultPipeMaterial} onChange={(e) => setProject({ defaultPipeMaterial: e.target.value as PipeMaterial })}>
              {(Object.keys(MATERIAL_LABELS) as PipeMaterial[]).map((m) => (
                <option key={m} value={m}>{MATERIAL_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelText}>Fitting Method</span>
            <select className={field} value={project.fittingMethod} onChange={(e) => setProject({ fittingMethod: e.target.value as FittingMethod })}>
              {(Object.keys(FITTING_METHOD_LABELS) as FittingMethod[]).map((m) => (
                <option key={m} value={m}>{FITTING_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span className={labelText}>Safety Factor (%)</span>
            <input
              type="number" min={0} step={1} className={field}
              value={Math.round(project.safetyFactor * 100)}
              onChange={(e) => setProject({ safetyFactor: Math.max(0, Number(e.target.value) || 0) / 100 })}
            />
          </label>

          <div className="col-span-2 mt-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded px-2.5 py-2 leading-relaxed">
            <span className="font-semibold text-gray-600">Calculation basis.</span> This tool sizes a
            single, manually-traced <span className="font-medium">critical (index) loop</span> — it is
            not a branched-network solver. Pipe friction uses Darcy-Weisbach with the Colebrook-White
            friction factor (laminar f = 64/Re below Re 2,300). Fluid density and dynamic viscosity are
            interpolated from the {FLUID_LABELS[project.fluidType]} table and clamped at its range;
            kinematic viscosity (and hence Reynolds number) is derived in physically-correct ft²/s.
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-blue-700" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
