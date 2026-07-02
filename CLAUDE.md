# Hydronic Pump Head Calculator — Project Context

Professional hydronic pump sizing tool (sister project to the HVAC ESP Calculator at
`../hvac-esp-calculator/`, same stack/layout/state architecture). Engineers trace the
critical loop of a hydronic system on a P&ID-style React Flow canvas; the app computes the
Total Dynamic Head (TDH) the pump must overcome.

## Tech Stack
- React 18 + TypeScript (strict) + Vite 8
- React Flow 11 (custom nodes + `pipeRun` edge)
- Zustand (state, undo/redo, clipboard, save/load)
- Tailwind CSS
- jsPDF (PDF), SheetJS/xlsx (Excel), CSV
- vite-plugin-singlefile — `npm run build:single` → portable `dist-portable/index.html`

## Dev Scripts
```bash
npm install --legacy-peer-deps   # vite 8 vs plugin-react peer range is cosmetic; bypass it
npm run dev          # dev server (auto-port via strictPort:false)
npm run build        # tsc -b && vite build → dist/
npm run build:single # portable single-file → dist-portable/index.html
npm run typecheck    # tsc --noEmit (passes clean, zero `any`)
```

## Structure
```
src/
  calc/
    constants.ts     # PIPE_SIZES, ROUGHNESS, WATER/GLYCOL props, FITTING_EL/K, NODE_DEFAULT_PD
    engine.ts        # computeFluidProps, computePipeRun, colebrook/swameeJain, fitting helpers, ft↔psi
    criticalPath.ts  # computeTDH — closed-loop traversal from the pump, rows + warnings
  components/
    App.tsx, Toolbar, Palette, Canvas, PipeRunEdge, nodes, PropertiesPanel,
    ResultsPanel, SettingsModal, ExportModal, GettingStarted, ContextMenu, Resizer, icons
  utils/ export.ts (PDF/Excel/CSV), units.ts (ft↔psi, filename)
  store.ts, types.ts, App.tsx, main.tsx, index.css
```

## Calculation notes
- Imperial throughout: ft of head, ft/s, ft²/s, GPM. psi only on display/entry (× 2.3067).
- Darcy-Weisbach + Colebrook-White (Swamee-Jain seed, 10 iterations); `f = 64/Re` when Re < 2300.
  Re 2300–4000 is flagged transitional (turbulent correlation used there — conservative).
- EL fitting loss uses the segment's own friction rate:
  `fittingLossFt = (frictionRatePer100/100) × ΣEL_ft`, where `EL_ft = qty × C_diameters × ID_ft`.
- K method: `Σ K × V²/2g`.
- TDH = (Σpipe + Σfittings + Σequipment) × (1 + safetyFactor).
- **Fluid properties (dimensionally correct).** The fluid table stores weight density
  `densityLbFt3` (lbf/ft³) and *dynamic* viscosity `dynViscLbfSPerFt2` (lbf·s/ft² = slug/(ft·s)).
  Kinematic viscosity is **derived** in `engine.ts` via `kinematicViscosityFt2S()` as
  `ν = μ·g_c/γ` (g_c = 32.174). The earlier spec stored a `ν` that omitted `g_c`, making Reynolds
  numbers ~32× high and underpredicting low-flow friction by up to ~50%; that bug is fixed — do
  not reintroduce a pre-computed `ν` that skips `g_c`.
- **Manual single-loop solver, not a network solver.** `computeTDH()` traces ONE loop from the
  pump, choosing the first continuing run deterministically (creation order) and warning on
  ambiguity; pipe runs off the traced loop are reported as ignored. Design flow = max GPM among
  traced-loop runs. Results carry `status` ('empty' | 'provisional' | 'valid') + `isValidForDesign`
  + `statusReasons`; the UI and all exports mark a provisional TDH as NOT design-ready.
- Engine helpers are unit-tested with Vitest (`npm test`): `src/calc/__tests__/*.test.ts`.

## Architecture
- **Loop traversal** (not tree): start at the pump output, walk edges source→target, accumulate
  losses, stop when the path returns to the pump (closed loop) or runs out of edges.
- **Branch nodes** terminate their path — edges into a branch are excluded from TDH.
- Results (`TDHResults`) are never stored in component state — derived by `computeTDH()` in the
  store's `commit()` after every mutation.
- Pump has distinct source (right/bottom) and target (left/top) handles for loop closure.
- Save/Load: `.pump.json` (`{ version, project, nodes, edges }`).

## Control valves / PICV
`FittingType`s in the data model (added to pipe runs via the fitting picker). They also appear in
the palette under "Valves & Instruments" as standalone inline components — those create
`user_defined` nodes with a representative default ΔP (kept type-safe; no extra `NodeKind`s).
