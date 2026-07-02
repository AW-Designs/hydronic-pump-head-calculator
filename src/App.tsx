import { useCallback, useState } from 'react';
import Palette from './components/Palette';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import ResultsPanel from './components/ResultsPanel';
import GettingStarted from './components/GettingStarted';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import Resizer from './components/Resizer';
import { useStore } from './store';

const LEFT_MIN = 160;
const LEFT_MAX = 380;
const RIGHT_MIN = 240;
const RIGHT_MAX = 520;
const BOTTOM_MIN = 96;
const BOTTOM_COLLAPSED = 140;
const BOTTOM_EXPANDED = 300;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function App() {
  const [leftW, setLeftW] = useState(200);
  const [rightW, setRightW] = useState(320);
  const [bottomH, setBottomH] = useState(BOTTOM_COLLAPSED);
  const [exportOpen, setExportOpen] = useState(false);

  // Properties panel is shown whenever something is selected.
  const propsOpen = useStore((s) => s.selectedId !== null);
  const settingsOpen = useStore((s) => s.settingsOpen);

  const resizeLeft = useCallback(
    (d: number) => setLeftW((w) => clamp(w + d, LEFT_MIN, LEFT_MAX)),
    []
  );
  // Right panel grows as the divider moves left, hence the negated delta.
  const resizeRight = useCallback(
    (d: number) => setRightW((w) => clamp(w - d, RIGHT_MIN, RIGHT_MAX)),
    []
  );
  const resizeBottom = useCallback(
    (d: number) => setBottomH((h) => clamp(h - d, BOTTOM_MIN, window.innerHeight - 160)),
    []
  );

  const expanded = bottomH > (BOTTOM_COLLAPSED + BOTTOM_EXPANDED) / 2;
  const toggleExpand = () => setBottomH(expanded ? BOTTOM_COLLAPSED : BOTTOM_EXPANDED);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: '#F8F9FA' }}>
      {/* Top toolbar (full width) */}
      <Toolbar onExport={() => setExportOpen(true)} />

      {/* Main 3-pane row */}
      <div className="flex-1 flex min-h-0">
        <div className="shrink-0 h-full" style={{ width: leftW }}>
          <Palette />
        </div>
        <Resizer axis="col" onResize={resizeLeft} />

        <div className="flex-1 min-w-0 h-full">
          <Canvas />
        </div>

        {propsOpen && (
          <>
            <Resizer axis="col" onResize={resizeRight} />
            <div className="shrink-0 h-full" style={{ width: rightW }}>
              <PropertiesPanel />
            </div>
          </>
        )}
      </div>

      {/* Persistent results (drag the top edge to resize) */}
      <Resizer axis="row" onResize={resizeBottom} />
      <div className="shrink-0" style={{ height: bottomH }}>
        <ResultsPanel expanded={expanded} onToggleExpand={toggleExpand} />
      </div>

      {settingsOpen && <SettingsModal />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      <GettingStarted />
    </div>
  );
}
