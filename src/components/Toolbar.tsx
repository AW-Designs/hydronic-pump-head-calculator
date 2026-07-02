import { useRef } from 'react';
import { useStore } from '../store';
import { SYSTEM_TYPE_LABELS, SYSTEM_COLOR } from '../calc/constants';

interface Props {
  onExport: () => void;
}

function Btn({
  onClick, children, title, disabled, primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-2.5 h-7 rounded text-xs font-medium border transition-colors disabled:opacity-40 ${
        primary
          ? 'bg-accent text-white border-accent hover:bg-blue-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="w-px h-5 bg-gray-200 mx-1" />;

export default function Toolbar({ onExport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const project = useStore((s) => s.project);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const newProject = useStore((s) => s.newProject);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const saveProjectJSON = useStore((s) => s.saveProjectJSON);
  const loadProjectJSON = useStore((s) => s.loadProjectJSON);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  return (
    <div className="h-11 shrink-0 flex items-center gap-1.5 px-3 bg-white border-b border-gray-200 overflow-x-auto">
      <span className="text-sm font-bold text-navy whitespace-nowrap">Hydronic Pump Head Calculator</span>
      <span className="text-gray-300">·</span>
      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={project.name}>
        {project.name}
      </span>
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: SYSTEM_COLOR[project.systemType] + '22', color: SYSTEM_COLOR[project.systemType] }}
        title={`${SYSTEM_TYPE_LABELS[project.systemType]} system`}
      >
        {project.loopId || 'Loop'} · {SYSTEM_TYPE_LABELS[project.systemType]}
      </span>

      <div className="flex-1" />

      <Btn
        title="New — clear the canvas"
        onClick={() => {
          if (confirm('Start a new project? The current canvas will be cleared.')) newProject();
        }}
      >
        New
      </Btn>
      <Btn title="Project & system settings" onClick={() => setSettingsOpen(true)}>⚙ Settings</Btn>
      <Sep />
      <Btn title="Save project as .pump.json" onClick={saveProjectJSON}>💾 Save</Btn>
      <Btn title="Load project from .pump.json" onClick={() => fileInputRef.current?.click()}>📂 Load</Btn>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.pump.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadProjectJSON(f);
          e.target.value = '';
        }}
      />
      <Sep />
      <Btn title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>↶ Undo</Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>↷ Redo</Btn>
      <Sep />
      <Btn title="Export PDF or Excel/CSV" onClick={onExport} primary>📤 Export</Btn>
    </div>
  );
}
