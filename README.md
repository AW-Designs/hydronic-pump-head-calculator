# Hydronic Pump Head Calculator

A pump sizing tool for hydronic systems, built for HVAC engineers. You trace the critical loop of a system on a P&ID-style canvas (pump, boiler or chiller, coils, separators, valves), and the app works out the Total Dynamic Head the pump has to overcome, using proper Darcy-Weisbach / Colebrook-White friction math instead of a rule-of-thumb estimate.

It runs entirely in the browser. No backend, no accounts, nothing phoning home. Projects save and load as local `.pump.json` files, and you can build the whole thing into a single portable HTML file if you need to hand it to someone who can't install anything.

This is a sister project to the [HVAC ESP Calculator](../hvac-esp-calculator), sharing the same stack, layout conventions, and state architecture.

## What it does

- **Visual loop builder.** Drag pump, equipment, and valve nodes onto a React Flow canvas and wire them together with pipe runs, styled roughly like a simplified P&ID.
- **Closed-loop TDH traversal.** The app walks the graph starting from the pump, adding up pipe friction, fitting losses, and component pressure drops as it goes around the loop. It warns you if the traversal hits an ambiguous branch, missing data, or a loop that never closes.
- **Darcy-Weisbach friction, solved properly.** Swamee-Jain gives the initial guess, then it runs 10 Colebrook-White iterations to converge. Below Re 2300 it switches to `f = 64/Re`, and the 2300-4000 transitional band gets flagged rather than silently treated as turbulent.
- **Two fitting-loss methods**, equivalent length or K-factor, pick whichever your office standardizes on.
- **Temperature-adjusted fluid properties** for water or 30% ethylene glycol. Kinematic viscosity is derived, not looked up from a table, so it stays dimensionally correct (more on why that matters below).
- **Steel Sch 40 and Copper Type L pipe tables**, plus equivalent-length and K-factor data for elbows, tees, valves, control valves, PICVs, strainers, and the usual fitting zoo.
- **A results status that won't let you fool yourself.** Every result is tagged empty, provisional, or valid, so a run with missing data or an open loop can't accidentally get treated as a finished, design-ready number.
- **Undo/redo, copy/paste, duplicate**, and a segment-by-segment log showing exactly what each pipe run and component contributed to the total.
- **Pipe routing you can actually tidy up.** Click and drag a pipe to slide its elbow around other equipment. Connection points show up on hover along each node's edges, so wiring equipment together doesn't fight with moving it around.
- **Export to PDF, Excel, and CSV**, all carrying the same design-readiness flags as the on-screen numbers.
- **Save and load projects** as `.pump.json`.
- **A portable single-file build.** `npm run build:single` bundles everything into one `index.html`. No install needed, runs off a USB drive or an email attachment.

## Getting it running

```bash
npm install --legacy-peer-deps   # Vite 8 and @vitejs/plugin-react disagree on peer ranges; harmless to bypass
npm run dev
```

Open the URL Vite prints, drag a Pump node onto the canvas from the palette, and start building out the loop.

## Using it

1. **Set up the project.** Open Settings and pick the fluid, temperature, default pipe material, fitting-loss method, and safety factor. Everything downstream depends on these.
2. **Drop in the Pump.** Every loop starts and ends here: it's the anchor for the traversal and has no pressure drop of its own.
3. **Build out the loop.** Add equipment (chiller, boiler, coil, heat exchanger, tanks, separators, whatever's in the system) and connect them in flow order. Hover a node to see its connection points. A pipe run appears between each pair you connect.
4. **Fill in pipe-run data.** Click a pipe to set size, flow, length, and fittings. Anything over 4 ft/s gets a velocity warning; a run that's missing size, flow, or length shows a red `!` so it can't slip through unnoticed.
5. **Enter component pressure drops** from manufacturer data. The coil or heat exchanger is usually the one that ends up setting the critical loop.
6. **Close the loop** by connecting the last component back to the pump's inlet. Once it closes, the Results panel shows the full Total Dynamic Head and tells you plainly whether it's design-ready.
7. **Export** whatever format you need. PDF, Excel, or CSV all carry the same status flags as what you see on screen.

### One thing worth being clear about

This tool traces a single loop. It is not a branched network solver. `computeTDH()` follows exactly one path from the pump, picking the first continuing run in creation order whenever there's a branch, and it reports that single worst-case path. Branch and Tee nodes mark where the rest of the network splits off. They're shown for context but excluded from the TDH total. If a node has more than one continuing run, you get a warning every time, so the choice of which way to trace is never made silently behind your back.

## The math, briefly

- Everything's imperial: feet of head, ft/s, ft²/s, GPM. Psi only shows up on display and entry, converted at 2.3067 ft/psi.
- Friction is Darcy-Weisbach with Colebrook-White, seeded with Swamee-Jain and run through 10 iterations. Below Re 2300 it's `f = 64/Re`. The 2300–4000 band is flagged transitional but still computed with the turbulent correlation, which is the conservative choice.
- Equivalent-length fitting losses: `fittingLossFt = (frictionRatePer100 / 100) × ΣEL_ft`, where each fitting's `EL_ft = qty × C_diameters × ID_ft`.
- K-factor fitting losses: `Σ K × V² / 2g`.
- Total Dynamic Head: `(Σ pipe friction + Σ fitting losses + Σ component ΔP) × (1 + safety factor)`.
- Fluid properties are stored as weight density (lbf/ft³) and dynamic viscosity (lbf·s/ft²). Kinematic viscosity gets derived on the fly (`ν = μ·gc/γ`, with `gc = 32.174`) instead of being pulled from a precomputed table. That distinction actually matters here: an earlier version of the spec stored a precomputed ν that dropped the `gc` term, which inflated Reynolds numbers by about 32x and underpredicted friction at low flow by as much as 50%. It's fixed now, but it's the kind of bug that's easy to reintroduce if someone "simplifies" this later, so watch for it.

## Data model

Projects save as `.pump.json`:

```json
{ "version": "1.0", "project": { /* fluid, safety factor, materials, etc. */ }, "nodes": [ /* React Flow nodes */ ], "edges": [ /* pipe runs */ ] }
```

Node kinds: `pump`, `chiller_boiler`, `plate_hx`, `buffer_tank`, `hydraulic_sep`, `air_sep`, `expansion_tank`, `coil`, `flow_meter`, `branch` (reference only, excluded from TDH), and `user_defined`.

Edges are pipe runs: nominal size, material, flow, length, and a list of fittings with quantities. Traversal walks edges from the pump, source to target, accumulating losses until the path either closes back on the pump or just runs out.

Control valves and PICVs are fitting types you can attach to a pipe run, but they also show up in the palette as standalone components. Under the hood those map to `user_defined` nodes with a default ΔP you're expected to override once you have actual submittal data.

## Stack

React 18 with TypeScript in strict mode (no `any` anywhere) and Vite 8. The canvas is React Flow 11 with a custom pipe-run edge and custom node types. State lives in Zustand, handling undo/redo history, clipboard, save/load, and derived results. Styling is Tailwind. Exports use jsPDF for PDF and SheetJS for Excel, with plain CSV as a fallback. The portable build comes from vite-plugin-singlefile. Tests run on Vitest, covering the engine and critical-path logic.

## Where things live

```
src/
  calc/
    constants.ts     # pipe size tables, roughness, fluid properties, fitting EL/K tables, node defaults
    engine.ts         # fluid properties, pipe-run hydraulics, Colebrook/Swamee-Jain, fitting losses, ft-to-psi
    criticalPath.ts   # computeTDH() - the closed-loop traversal, per-segment rows, warnings
    __tests__/        # Vitest tests for engine.ts and criticalPath.ts
  components/
    App.tsx, Toolbar, Palette, Canvas, PipeRunEdge, nodes, PropertiesPanel,
    ResultsPanel, SettingsModal, ExportModal, GettingStarted, ContextMenu,
    Resizer, icons
  utils/
    export.ts   # PDF, Excel, and CSV generation
    units.ts    # ft-to-psi conversion, filename slugging
    pipePath.ts # the slidable pipe-routing geometry
  store.ts    # Zustand store: nodes, edges, history, selection, project settings
  types.ts    # shared types for node/edge data and calc results
  App.tsx, main.tsx, index.css
```

## Scripts

```bash
npm run dev            # dev server, picks a free port on its own
npm run build           # tsc -b && vite build, output to dist/
npm run build:single    # portable single-file build, output to dist-portable/index.html
npm run preview         # preview a production build
npm run preview:single  # preview the portable build
npm run typecheck       # tsc --noEmit, should always pass clean
npm run test            # run the Vitest suite once
npm run test:watch      # Vitest in watch mode
```

## What you need

Node.js 18 or newer, npm, and a reasonably modern browser (Chrome, Edge, Firefox) for both development and actually using the thing.

## License

There's no license file in here yet, so treat this as all rights reserved until one gets added.
