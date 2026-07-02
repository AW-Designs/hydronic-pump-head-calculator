import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from 'reactflow';
import type {
  ComponentKind,
  Fitting,
  FittingType,
  NodeData,
  PipeRunEdgeData,
  ProjectInfo,
  RFEdge,
  RFNode,
  TDHResults,
} from './types';
import { computeTDH } from './calc/criticalPath';
import { NODE_DEFAULT_PD, NODE_LABELS } from './calc/constants';

/** Collision-safe UUID-based IDs (same pattern as the HVAC ESP store). */
export const nextId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

interface Snapshot {
  nodes: RFNode[];
  edges: RFEdge[];
}

interface ContextMenuState {
  x: number;
  y: number;
  elementId: string;
  elementType: 'node' | 'edge';
}

interface StoreState {
  nodes: RFNode[];
  edges: RFEdge[];
  selectedId: string | null;
  selectedType: 'node' | 'edge' | null;
  results: TDHResults;
  project: ProjectInfo;
  showGettingStarted: boolean;
  settingsOpen: boolean;
  contextMenu: ContextMenuState | null;
  past: Snapshot[];
  future: Snapshot[];
  clipboard: Snapshot | null;
  lastPointer: { x: number; y: number };
  /** Bumped each time the user asks to focus an element; the Canvas pans on change. */
  focusRequest: { id: string; type: 'node' | 'edge'; nonce: number } | null;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;

  addPaletteItem: (kind: string, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, patch: Partial<NodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<PipeRunEdgeData>) => void;

  /** Snapshots history once at the start of a pipe-slide drag (setEdgeOffset skips history). */
  beginEdgeReshape: () => void;
  /** Sets the pipe's routing nudge. Called continuously during a slide drag. No history push. */
  setEdgeOffset: (edgeId: string, offset: { x: number; y: number }) => void;
  /** Clears the routing nudge, reverting the pipe to its default auto-route. Undoable. */
  resetEdgeShape: (edgeId: string) => void;

  addFitting: (edgeId: string, type: FittingType) => void;
  setFittingQty: (edgeId: string, fittingId: string, quantity: number) => void;
  removeFitting: (edgeId: string, fittingId: string) => void;

  deleteElement: (id: string, type: 'node' | 'edge') => void;
  duplicateElement: (id: string, type: 'node' | 'edge') => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  selectAll: () => void;
  setLastPointer: (p: { x: number; y: number }) => void;

  select: (id: string, type: 'node' | 'edge') => void;
  /** Select an element AND request the canvas to pan/zoom to it (used by warnings + segment log). */
  focusElement: (id: string, type: 'node' | 'edge') => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  newProject: () => void;
  setProject: (p: Partial<ProjectInfo>) => void;
  dismissGettingStarted: () => void;
  setSettingsOpen: (open: boolean) => void;
  setContextMenu: (c: ContextMenuState | null) => void;
  saveProjectJSON: () => void;
  loadProjectJSON: (file: File) => void;
  recompute: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const defaultProject = (): ProjectInfo => ({
  name: 'Untitled Project',
  number: '',
  designer: '',
  date: today(),
  loopId: 'Loop-1',
  systemType: 'chw',
  fluidType: 'water',
  fluidTemp: 45,
  defaultPipeMaterial: 'steel_sch40',
  fittingMethod: 'equiv_length',
  safetyFactor: 0.1,
});

const EMPTY_RESULTS: TDHResults = {
  totalPipeFrictionFt: 0,
  totalFittingLossFt: 0,
  totalComponentDropFt: 0,
  subtotalFt: 0,
  safetyFactorFt: 0,
  designTdhFt: 0,
  designFlowGpm: 0,
  rows: [],
  warnings: [],
  loopElementIds: new Set(),
  loopClosed: false,
  status: 'empty',
  isValidForDesign: false,
  statusReasons: [],
};

/** Palette kind → component node defaults. 'boiler' is an alias of chiller_boiler. */
const COMPONENT_PALETTE: Record<string, { kind: ComponentKind; label: string; pd: number }> = {
  chiller_boiler: { kind: 'chiller_boiler', label: 'Chiller / Heat Pump', pd: NODE_DEFAULT_PD.chiller_boiler },
  boiler: { kind: 'chiller_boiler', label: 'Boiler', pd: 10.0 },
  plate_hx: { kind: 'plate_hx', label: NODE_LABELS.plate_hx, pd: NODE_DEFAULT_PD.plate_hx },
  buffer_tank: { kind: 'buffer_tank', label: NODE_LABELS.buffer_tank, pd: NODE_DEFAULT_PD.buffer_tank },
  hydraulic_sep: { kind: 'hydraulic_sep', label: NODE_LABELS.hydraulic_sep, pd: NODE_DEFAULT_PD.hydraulic_sep },
  air_sep: { kind: 'air_sep', label: NODE_LABELS.air_sep, pd: NODE_DEFAULT_PD.air_sep },
  expansion_tank: { kind: 'expansion_tank', label: NODE_LABELS.expansion_tank, pd: NODE_DEFAULT_PD.expansion_tank },
  coil: { kind: 'coil', label: 'AHU Coil', pd: NODE_DEFAULT_PD.coil },
  flow_meter: { kind: 'flow_meter', label: NODE_LABELS.flow_meter, pd: NODE_DEFAULT_PD.flow_meter },
  user_defined: { kind: 'user_defined', label: 'User-Defined', pd: NODE_DEFAULT_PD.user_defined },
  // Control valves / PICV are FittingTypes in the data model; as standalone
  // inline components they map to user_defined nodes with a representative
  // design ΔP the engineer overrides from submittal data.
  control_2way: { kind: 'user_defined', label: '2-Way Control Valve', pd: 7.0 },
  control_3way: { kind: 'user_defined', label: '3-Way Control Valve', pd: 7.0 },
  picv: { kind: 'user_defined', label: 'PICV', pd: 7.0 },
};

function makeNodeData(kind: string): { data: NodeData; nodeType: string } {
  if (kind === 'pump') {
    return { nodeType: 'pump', data: { kind: 'pump', label: 'Pump', hasVfd: true } };
  }
  if (kind === 'branch') {
    return { nodeType: 'branch', data: { kind: 'branch', label: 'Branch' } };
  }
  const c = COMPONENT_PALETTE[kind] ?? COMPONENT_PALETTE['user_defined'];
  return {
    nodeType: 'equipment',
    data: { kind: c.kind, label: c.label, pressureDrop: c.pd, pressureDropUnit: 'ft', notes: '' },
  };
}

function defaultEdgeData(label: string, material: ProjectInfo['defaultPipeMaterial']): PipeRunEdgeData {
  return { label, nominalSize: '2', material, flowGpm: 0, lengthFt: 0, fittings: [] };
}

export const useStore = create<StoreState>((set, get) => {
  const pushHistory = () => {
    set((s) => ({ past: [...s.past, { nodes: s.nodes, edges: s.edges }], future: [] }));
  };

  const commit = () => {
    const { nodes, edges, project } = get();
    set({ results: computeTDH(nodes, edges, project) });
  };

  return {
    nodes: [],
    edges: [],
    selectedId: null,
    selectedType: null,
    results: EMPTY_RESULTS,
    project: defaultProject(),
    showGettingStarted: true,
    settingsOpen: false,
    contextMenu: null,
    past: [],
    future: [],
    clipboard: null,
    lastPointer: { x: 0, y: 0 },
    focusRequest: null,

    onNodesChange: (changes) => {
      const structural = changes.some((c) => c.type === 'remove' || c.type === 'add');
      if (structural) pushHistory();
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
      if (structural) commit();
    },

    onEdgesChange: (changes) => {
      const structural = changes.some((c) => c.type === 'remove' || c.type === 'add');
      if (structural) pushHistory();
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
      if (structural) commit();
    },

    onConnect: (c) => {
      pushHistory();
      const { edges, project } = get();
      const label = `PR-${edges.length + 1}`;
      const newEdge: RFEdge = {
        id: nextId('e'),
        source: c.source!,
        target: c.target!,
        sourceHandle: c.sourceHandle ?? undefined,
        targetHandle: c.targetHandle ?? undefined,
        type: 'pipeRun',
        data: defaultEdgeData(label, project.defaultPipeMaterial),
      };
      set({ edges: addEdge(newEdge, edges) });
      commit();
    },

    addPaletteItem: (kind, position) => {
      pushHistory();
      const { data, nodeType } = makeNodeData(kind);
      const snapped = { x: Math.round(position.x / 16) * 16, y: Math.round(position.y / 16) * 16 };
      const node: RFNode = { id: nextId('n'), type: nodeType, position: snapped, data };
      set((s) => ({ nodes: [...s.nodes, node] }));
      commit();
      get().select(node.id, 'node');
    },

    updateNodeData: (id, patch) => {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } as NodeData } : n)),
      }));
      commit();
    },

    updateEdgeData: (id, patch) => {
      set((s) => ({
        edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, ...patch } } : e)),
      }));
      commit();
    },

    beginEdgeReshape: () => {
      pushHistory();
    },

    setEdgeOffset: (edgeId, offset) => {
      set((s) => ({
        edges: s.edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data!, offset } } : e)),
      }));
    },

    resetEdgeShape: (edgeId) => {
      pushHistory();
      set((s) => ({
        edges: s.edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data!, offset: undefined } } : e)),
      }));
      set({ contextMenu: null });
    },

    addFitting: (edgeId, type) => {
      pushHistory();
      const fitting: Fitting = { id: nextId('f'), type, quantity: 1 };
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data!, fittings: [...e.data!.fittings, fitting] } } : e
        ),
      }));
      commit();
    },

    setFittingQty: (edgeId, fittingId, quantity) => {
      const q = Math.max(1, Math.round(quantity) || 1);
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                data: {
                  ...e.data!,
                  fittings: e.data!.fittings.map((f) => (f.id === fittingId ? { ...f, quantity: q } : f)),
                },
              }
            : e
        ),
      }));
      commit();
    },

    removeFitting: (edgeId, fittingId) => {
      pushHistory();
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data!, fittings: e.data!.fittings.filter((f) => f.id !== fittingId) } }
            : e
        ),
      }));
      commit();
    },

    deleteElement: (id, type) => {
      pushHistory();
      if (type === 'node') {
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        }));
      } else {
        set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
      }
      set({ selectedId: null, selectedType: null, contextMenu: null });
      commit();
    },

    duplicateElement: (id, type) => {
      pushHistory();
      if (type === 'node') {
        const n = get().nodes.find((x) => x.id === id);
        if (n) {
          const copy: RFNode = {
            ...n,
            id: nextId('n'),
            position: { x: n.position.x + 40, y: n.position.y + 40 },
            data: { ...n.data },
            selected: false,
          };
          set((s) => ({ nodes: [...s.nodes, copy] }));
        }
      }
      set({ contextMenu: null });
      commit();
    },

    copySelection: () => {
      const { nodes, edges } = get();
      const selNodes = nodes.filter((n) => n.selected);
      if (selNodes.length === 0) return;
      const ids = new Set(selNodes.map((n) => n.id));
      const selEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      set({
        clipboard: {
          nodes: selNodes.map((n) => ({ ...n, data: { ...n.data } })),
          edges: selEdges.map((e) => ({ ...e, data: { ...e.data! } })),
        },
      });
    },

    cutSelection: () => {
      get().copySelection();
      get().deleteSelection();
    },

    pasteClipboard: (at) => {
      const clip = get().clipboard;
      if (!clip || clip.nodes.length === 0) return;
      pushHistory();
      const minX = Math.min(...clip.nodes.map((n) => n.position.x));
      const minY = Math.min(...clip.nodes.map((n) => n.position.y));
      const dx = at ? at.x - minX : 32;
      const dy = at ? at.y - minY : 32;
      const idMap = new Map<string, string>();
      const newNodes: RFNode[] = clip.nodes.map((n) => {
        const nid = nextId('n');
        idMap.set(n.id, nid);
        return { ...n, id: nid, position: { x: n.position.x + dx, y: n.position.y + dy }, data: { ...n.data }, selected: true };
      });
      const newEdges: RFEdge[] = clip.edges.map((e) => ({
        ...e,
        id: nextId('e'),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        data: { ...e.data!, fittings: e.data!.fittings.map((f) => ({ ...f, id: nextId('f') })) },
        selected: false,
      }));
      set((s) => ({
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
        edges: [...s.edges, ...newEdges],
      }));
      commit();
    },

    duplicateSelection: () => {
      get().copySelection();
      get().pasteClipboard();
    },

    deleteSelection: () => {
      const { nodes, edges } = get();
      const selNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      const selEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
      if (selNodeIds.size === 0 && selEdgeIds.size === 0) return;
      pushHistory();
      set((s) => ({
        nodes: s.nodes.filter((n) => !selNodeIds.has(n.id)),
        edges: s.edges.filter((e) => !selEdgeIds.has(e.id) && !selNodeIds.has(e.source) && !selNodeIds.has(e.target)),
        selectedId: null,
        selectedType: null,
      }));
      commit();
    },

    selectAll: () => {
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: true })),
        edges: s.edges.map((e) => ({ ...e, selected: true })),
      }));
    },

    setLastPointer: (p) => set({ lastPointer: p }),
    select: (id, type) => set({ selectedId: id, selectedType: type, contextMenu: null }),
    focusElement: (id, type) =>
      set((s) => ({
        selectedId: id,
        selectedType: type,
        contextMenu: null,
        focusRequest: { id, type, nonce: (s.focusRequest?.nonce ?? 0) + 1 },
      })),
    clearSelection: () => set({ selectedId: null, selectedType: null }),

    undo: () => {
      const { past } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      set((s) => ({
        nodes: prev.nodes,
        edges: prev.edges,
        past: s.past.slice(0, -1),
        future: [{ nodes: s.nodes, edges: s.edges }, ...s.future],
        selectedId: null,
        selectedType: null,
      }));
      commit();
    },

    redo: () => {
      const { future } = get();
      if (future.length === 0) return;
      const next = future[0];
      set((s) => ({
        nodes: next.nodes,
        edges: next.edges,
        future: s.future.slice(1),
        past: [...s.past, { nodes: s.nodes, edges: s.edges }],
        selectedId: null,
        selectedType: null,
      }));
      commit();
    },

    newProject: () => {
      pushHistory();
      set({ nodes: [], edges: [], selectedId: null, selectedType: null, results: EMPTY_RESULTS });
    },

    setProject: (p) => {
      set((s) => ({ project: { ...s.project, ...p } }));
      commit();
    },

    dismissGettingStarted: () => set({ showGettingStarted: false }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    setContextMenu: (c) => set({ contextMenu: c }),

    saveProjectJSON: () => {
      const { nodes, edges, project } = get();
      const payload = JSON.stringify({ version: '1.0', project, nodes, edges }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(project.name)}.pump.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    loadProjectJSON: (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (!parsed.nodes || !parsed.edges) throw new Error('Invalid file format');
          pushHistory();
          // Nodes expose inlets 't-l'/'t-t' and outlets 's-r'/'s-b'; all four are
          // valid, so saved handle ids are preserved as-is.
          const edges = parsed.edges as RFEdge[];
          set({
            nodes: parsed.nodes,
            edges,
            project: { ...defaultProject(), ...parsed.project },
            selectedId: null,
            selectedType: null,
          });
          commit();
        } catch (err) {
          alert(`Failed to load project: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    },

    recompute: commit,
  };
});

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'project';
}
