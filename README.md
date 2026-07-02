# Hydronic Pump Head Calculator

A professional hydronic pump sizing tool for HVAC engineers. Trace the critical
loop of a hydronic system on a P&ID-style canvas — pump, boiler/chiller, coils,
separators, valves — and the app computes the **Total Dynamic Head (TDH)** the
pump must overcome, using Darcy-Weisbach / Colebrook-White friction calculations.

Runs entirely in the browser. No backend, no accounts, no telemetry — projects
save/load as local `.pump.json` files, and the app can be built as a single
portable HTML file for offline use.

Sister project to the [HVAC ESP Calculator](../hvac-esp-calculator) — same
stack, layout, and state architecture.

## Features

- **Visual loop builder** — drag pump, equipment, and valve nodes onto a
  React Flow canvas and wire them together with pipe runs, styled like a
  simplified P&ID.
- **Closed-loop TDH traversal** — the app walks the graph from the pump,
  accumulating pipe friction, fitting losses, and component pressure drops
  around the loop, and warns on ambiguous branching, missing data, or an
  unclosed loop.
- **Darcy-Weisbach friction with Colebrook-White** — full iterative solve
  (Swamee-Jain seed, 10 Colebrook iterations), with `f = 64/Re` in the
  laminar regime and a flagged transitional zone (2300 < Re < 4000).
- **Two fitting-loss methods** — equivalent length (ΣEL × friction rate) or
  K-factor (ΣK·V²/2g) — selectable per project.
- **Fluid properties** — water or 30% ethylene glycol, temperature-adjusted
  density and viscosity, dimensionally-correct kinematic viscosity
  (`ν = μ·gc/γ`).
- **Steel Sch 40 and Copper Type L** pipe tables, 3/4" through 12" (steel) /
  4" (copper), with fitting equivalent-length and K-factor tables covering
  elbows, tees, valves (ball, gate, globe, butterfly, check), control valves,
  PICVs, strainers, and more.
- **Design-readiness status** — results are flagged `empty` / `provisional`
  / `valid`, so a pipe run with missing data or an open loop can never be
  mistaken for a finished, design-ready TDH.
- **Full undo/redo, copy/paste, duplicate**, and a segment-by-segment log of
  every pipe run and component's contribution to the total.
- **Editable pipe routing** — reshape a pipe's auto-routed elbow by
  click-dragging it to clear other nodes; connection ports appear on hover
  along each side of a node so you can drag a pipe from equipment to
  equipment without disturbing node placement.
- **Export** to PDF (formatted report), Excel (workbook with full segment
  breakdown), and CSV.
- **Save / Load** projects as `.pump.json`.
- **Portable single-file build** — `npm run build:single` produces one
  `index.html` with everything inlined, so it can be emailed or run from a
  USB drive with no install.

## Quick start

```bash
npm install --legacy-peer-deps   # Vite 8 vs @vitejs/plugin-react peer range is cosmetic; safe to bypass
npm run dev                      # starts a dev server (auto-selects a free port)
```

Open the printed local URL, drop a **Pump** node onto the canvas from the
palette, then build out equipment and pipe runs around it.

## How to use it

1. **Configure the project** — open ⚙ Settings to set the fluid type and
   temperature, default pipe material, fitting-loss method, and safety
   factor. These drive every downstream calculation.
2. **Place the Pump** — every loop starts and ends here; it's the traversal
   anchor and has zero pressure drop of its own.
3. **Build the critical loop** — drag equipment nodes (chiller, boiler, coil,
   heat exchanger, tanks, separators…) onto the canvas and connect them in
   flow order. Each node exposes inlet/outlet connection points on hover.
   A pipe run appears between each connected pair.
4. **Enter pipe-run data** — click a pipe to set nominal size, flow (GPM),
   length, material override, and fittings. Velocity warnings fire above
   4 ft/s; a run missing size/flow/length is flagged with a red `!`.
5. **Enter component pressure drops** — click each component to enter its
   ΔP (ft WC or psi) from manufacturer data. The coil or heat exchanger is
   often the index component that sets the critical loop.
6. **Close the loop** — connect the last component back to the pump's
   inlet. Once the loop closes, the Results panel reports the full Total
   Dynamic Head and marks it design-ready (or explains why not).
7. **Export** — PDF report, Excel workbook, or CSV, all carrying the same
   design-readiness status as the on-screen results.

### Key principle: single-loop, not a network solver

This is a **manual single-loop calculator**, not a branched hydronic network
solver. `computeTDH()` traces exactly one path from the pump — choosing the
first continuing run deterministically by creation order and warning on any
ambiguity — and reports the single worst-case (index) loop. Branch/Tee nodes
mark where non-critical sub-loops split off; they and their edges are shown
for context but excluded from the TDH total. If a node has more than one
continuing run, the tool traces the first and always surfaces a warning, so
the choice is never silent.

## Calculation methodology

- **Units**: imperial throughout — feet of head, ft/s, ft²/s, GPM. psi is
  used only on display/entry (`ft ↔ psi` via 2.3067 ft/psi).
- **Friction**: Darcy-Weisbach with Colebrook-White (Swamee-Jain analytical
  seed, 10 Colebrook iterations for convergence); `f = 64/Re` for
  `Re < 2300` (laminar). `2300 ≤ Re ≤ 4000` is flagged **transitional** but
  computed with the turbulent correlation (conservative).
- **Fitting losses (equivalent length)**:
  `fittingLossFt = (frictionRatePer100 / 100) × ΣEL_ft`, where
  `EL_ft = qty × C_diameters × ID_ft` for each fitting.
- **Fitting losses (K-factor)**: `Σ K × V² / 2g`.
- **Total Dynamic Head**:
  `TDH = (Σ pipe friction + Σ fitting losses + Σ component ΔP) × (1 + safety factor)`.
- **Fluid properties**: the fluid table stores weight density
  (`densityLbFt3`, lbf/ft³) and *dynamic* viscosity
  (`dynViscLbfSPerFt2`, lbf·s/ft² = slug/(ft·s)). Kinematic viscosity is
  **derived**, not stored — `ν = μ·gc/γ` with `gc = 32.174 lbm·ft/(lbf·s²)` —
  so Reynolds numbers stay dimensionally correct at low flow.

## Data model

Projects serialize to `.pump.json`:

```json
{ "version": "1.0", "project": { /* fluid, safety factor, materials… */ }, "nodes": [ /* React Flow nodes */ ], "edges": [ /* pipe runs */ ] }
```

- **Nodes**: `pump`, `chiller_boiler`, `plate_hx`, `buffer_tank`,
  `hydraulic_sep`, `air_sep`, `expansion_tank`, `coil`, `flow_meter`,
  `branch` (reference-only, excluded from TDH), `user_defined`.
- **Edges (pipe runs)**: nominal size, material, flow, length, and a list of
  fittings (type + quantity). Loop traversal walks edges source → target
  from the pump, accumulating losses until the path closes back on the pump
  or runs out of edges.
- **Control valves / PICV** are `FittingType`s that can be added to a pipe
  run's fitting list, and also appear in the palette as standalone
  components (mapped internally to `user_defined` nodes with a
  representative default ΔP the engineer overrides from submittal data).

## Tech stack

| | |
|---|---|
| Framework | React 18 + TypeScript (strict, zero `any`) + Vite 8 |
| Canvas | React Flow 11 (custom nodes + a custom `pipeRun` edge) |
| State | Zustand — undo/redo history, clipboard, save/load, derived results |
| Styling | Tailwind CSS |
| Export | jsPDF (PDF), SheetJS/xlsx (Excel), native CSV |
| Portable build | vite-plugin-singlefile |
| Tests | Vitest — engine and critical-path logic under `src/calc/__tests__` |

## Project structure

```
src/
  calc/
    constants.ts     # PIPE_SIZES, ROUGHNESS, fluid properties, fitting EL/K tables, node defaults
    engine.ts         # fluid props, pipe-run hydraulics, Colebrook/Swamee-Jain, fitting losses, ft↔psi
    criticalPath.ts   # computeTDH() — closed-loop traversal from the pump, per-segment rows + warnings
    __tests__/        # Vitest unit tests for engine + criticalPath
  components/
    App.tsx, Toolbar, Palette, Canvas, PipeRunEdge, nodes, PropertiesPanel,
    ResultsPanel, SettingsModal, ExportModal, GettingStarted, ContextMenu,
    Resizer, icons
  utils/
    export.ts   # PDF / Excel / CSV generation
    units.ts    # ft↔psi conversion, filename slugging
    pipePath.ts # slidable orthogonal pipe-routing geometry
  store.ts    # Zustand store — nodes/edges, history, selection, project settings
  types.ts    # shared TypeScript types (node/edge data, calc results)
  App.tsx, main.tsx, index.css
```

## Available scripts

```bash
npm run dev            # dev server (Vite, auto-picks a free port)
npm run build           # tsc -b && vite build → dist/
npm run build:single    # portable single-file build → dist-portable/index.html
npm run preview         # preview a production build
npm run preview:single  # preview the portable single-file build
npm run typecheck       # tsc --noEmit (must pass clean)
npm run test            # run the Vitest suite once
npm run test:watch      # Vitest in watch mode
```

## Requirements

- Node.js 18+ and npm
- A modern browser (Chrome, Edge, Firefox) for development and use

## License

No license file is currently included — all rights reserved by the
repository owner unless a license is added.
