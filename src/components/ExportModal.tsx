import { useState } from 'react';
import { useStore } from '../store';
import { exportPdf, exportExcel, exportCsv } from '../utils/export';

interface Props {
  onClose: () => void;
}

export default function ExportModal({ onClose }: Props) {
  const project = useStore((s) => s.project);
  const setProject = useStore((s) => s.setProject);
  const results = useStore((s) => s.results);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => void) => {
    setBusy(true);
    try {
      fn();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded';

  const Option = ({
    title, desc, accent, onClick,
  }: {
    title: string; desc: string; accent?: boolean; onClick: () => void;
  }) => (
    <button
      disabled={busy}
      onClick={onClick}
      className={`flex-1 text-left px-3 py-3 rounded-lg border transition-colors disabled:opacity-50 ${
        accent ? 'border-accent bg-blue-50 hover:bg-blue-100' : 'border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="text-sm font-bold text-gray-800">{title}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-bold text-gray-800 mb-1">Export</div>
        <div className="text-xs text-gray-500 mb-4">Project information is included in the export header.</div>

        <label className="block mb-3">
          <span className="field-label">Project Name</span>
          <input className={field} value={project.name} onChange={(e) => setProject({ name: e.target.value })} />
        </label>
        <label className="block mb-4">
          <span className="field-label">Loop ID</span>
          <input className={field} value={project.loopId} onChange={(e) => setProject({ loopId: e.target.value })} />
        </label>

        <div className="flex gap-2 mb-3">
          <Option title="📄 PDF Report" desc="Header, summary & segment log" accent onClick={() => run(() => exportPdf(results, project))} />
          <Option title="📊 Excel" desc="Summary, Segment Log, Warnings" onClick={() => run(() => exportExcel(results, project))} />
        </div>
        <div className="flex justify-between items-center">
          <button className="text-[11px] text-accent hover:underline disabled:opacity-50" disabled={busy} onClick={() => run(() => exportCsv(results, project))}>
            or export Segment Log as CSV
          </button>
          <button className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
