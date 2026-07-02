import { useState } from 'react';
import type { SymbolProps } from './icons';
import {
  PumpSymbol, ChillerBoilerSymbol, PlateHxSymbol, BufferTankSymbol, HydraulicSepSymbol,
  AirSepSymbol, ExpansionTankSymbol, CoilSymbol, UserDefinedSymbol, Control2WaySymbol,
  Control3WaySymbol, PicvSymbol, FlowMeterSymbol, BranchSymbol,
} from './icons';

interface Item {
  kind: string; // palette key passed to store.addPaletteItem
  label: string;
  Symbol: React.FC<SymbolProps>;
}

interface Category {
  name: string;
  hint?: string;
  items: Item[];
}

const CATEGORIES: Category[] = [
  {
    name: 'Anchors',
    hint: 'Every loop starts and ends at the pump',
    items: [{ kind: 'pump', label: 'Pump (w/ VFD)', Symbol: PumpSymbol }],
  },
  {
    name: 'Equipment',
    items: [
      { kind: 'chiller_boiler', label: 'Chiller / Heat Pump', Symbol: ChillerBoilerSymbol },
      { kind: 'boiler', label: 'Boiler', Symbol: ChillerBoilerSymbol },
      { kind: 'plate_hx', label: 'Plate Heat Exchanger', Symbol: PlateHxSymbol },
      { kind: 'buffer_tank', label: 'Buffer Tank', Symbol: BufferTankSymbol },
      { kind: 'hydraulic_sep', label: 'Hydraulic Separator', Symbol: HydraulicSepSymbol },
      { kind: 'air_sep', label: 'Air Separator', Symbol: AirSepSymbol },
      { kind: 'expansion_tank', label: 'Expansion Tank', Symbol: ExpansionTankSymbol },
      { kind: 'coil', label: 'AHU / FCU Coil', Symbol: CoilSymbol },
      { kind: 'user_defined', label: 'User-Defined', Symbol: UserDefinedSymbol },
    ],
  },
  {
    name: 'Valves & Instruments',
    hint: 'Valves can also be added as fittings on a pipe run',
    items: [
      { kind: 'control_2way', label: 'Control Valve (2-way)', Symbol: Control2WaySymbol },
      { kind: 'control_3way', label: 'Control Valve (3-way)', Symbol: Control3WaySymbol },
      { kind: 'picv', label: 'PICV', Symbol: PicvSymbol },
      { kind: 'flow_meter', label: 'Flow / BTU Meter', Symbol: FlowMeterSymbol },
    ],
  },
  {
    name: 'Other',
    hint: 'Reference only — excluded from TDH',
    items: [{ kind: 'branch', label: 'Branch / Tee', Symbol: BranchSymbol }],
  },
];

export default function Palette() {
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.name, true]))
  );

  const onDragStart = (e: React.DragEvent, kind: string) => {
    e.dataTransfer.setData('application/hydronic-node', kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-full h-full overflow-y-auto text-white" style={{ background: '#1E2A3A' }}>
      <div className="px-3 py-3 border-b border-white/10">
        <div className="text-sm font-bold tracking-wide">Components</div>
        <div className="text-[10px] text-white/50">Drag onto the canvas</div>
      </div>
      {CATEGORIES.map((cat) => (
        <div key={cat.name} className="border-b border-white/5">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/70 hover:text-white"
            onClick={() => setOpen((o) => ({ ...o, [cat.name]: !o[cat.name] }))}
          >
            <span>{cat.name}</span>
            <span className="text-white/40">{open[cat.name] ? '▾' : '▸'}</span>
          </button>
          {open[cat.name] && (
            <div className="pb-2">
              {cat.hint && <div className="px-3 pb-1 text-[9px] italic text-white/35">{cat.hint}</div>}
              {cat.items.map((it) => (
                <div
                  key={it.kind}
                  draggable
                  onDragStart={(e) => onDragStart(e, it.kind)}
                  className="mx-2 mb-1 px-2 py-1.5 rounded flex items-center gap-2 text-[11px] cursor-grab active:cursor-grabbing hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                  title={`Drag to add ${it.label}`}
                >
                  <span className="shrink-0 w-7 flex justify-center text-slate-300">
                    <it.Symbol size={26} />
                  </span>
                  <span className="text-white/85">{it.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
