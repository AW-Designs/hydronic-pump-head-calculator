import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store';
import { nodeTypes } from './nodes';
import { edgeTypes } from './PipeRunEdge';
import ContextMenu from './ContextMenu';

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getNode } = useReactFlow();

  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const focusRequest = useStore((s) => s.focusRequest);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const addPaletteItem = useStore((s) => s.addPaletteItem);
  const select = useStore((s) => s.select);
  const clearSelection = useStore((s) => s.clearSelection);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const setLastPointer = useStore((s) => s.setLastPointer);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'TEXTAREA' ||
          (el as HTMLElement).isContentEditable);
      if (typing) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c') { s.copySelection(); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'x') { s.cutSelection(); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'v') { s.pasteClipboard(s.lastPointer); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'd') { s.duplicateSelection(); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'a') { s.selectAll(); e.preventDefault(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'z') { s.redo(); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'z') { s.undo(); e.preventDefault(); }
      else if (mod && e.key.toLowerCase() === 'y') { s.redo(); e.preventDefault(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { s.deleteSelection(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pan/zoom to the element the user picked from a warning or the segment log.
  useEffect(() => {
    if (!focusRequest) return;
    let ids: string[];
    if (focusRequest.type === 'node') {
      ids = [focusRequest.id];
    } else {
      const e = useStore.getState().edges.find((x) => x.id === focusRequest.id);
      ids = e ? [e.source, e.target] : [];
    }
    const present = ids.filter((nid) => getNode(nid));
    if (present.length === 0) return;
    fitView({ nodes: present.map((nid) => ({ id: nid })), duration: 450, padding: 0.45, maxZoom: 1.6 });
  }, [focusRequest, fitView, getNode]);

  const onPaneMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setLastPointer(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [screenToFlowPosition, setLastPointer]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData('application/hydronic-node');
      if (!kind) return;
      addPaletteItem(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [screenToFlowPosition, addPaletteItem]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="flex-1 relative" ref={wrapperRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onMouseMove={onPaneMouseMove}
          snapToGrid
          snapGrid={[16, 16]}
          minZoom={0.2}
          maxZoom={2.5}
          fitView
          deleteKeyCode={null}
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionKeyCode="Shift"
          selectNodesOnDrag={false}
          defaultEdgeOptions={{ type: 'pipeRun' }}
          onNodeClick={(_, n) => select(n.id, 'node')}
          onEdgeDoubleClick={(_, ed) => select(ed.id, 'edge')}
          onPaneClick={() => {
            clearSelection();
            setContextMenu(null);
          }}
          onNodeContextMenu={(e, n) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, elementId: n.id, elementType: 'node' });
          }}
          onEdgeContextMenu={(e, ed) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, elementId: ed.id, elementType: 'edge' });
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
          <Controls showInteractive={false} />
        </ReactFlow>
        <ContextMenu />
      </div>
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
