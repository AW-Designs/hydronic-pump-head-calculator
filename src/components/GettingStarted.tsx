import { useStore } from '../store';

const STEPS = [
  {
    title: 'Configure the project',
    body: 'Open ⚙ Settings to enter project info and set the fluid, temperature, default pipe material, fitting method, and safety factor. These drive every calculation.',
  },
  {
    title: 'Place the Pump',
    body: 'Drag a Pump node from the palette onto the canvas. Every loop starts and ends here — the pump is the source of head and the anchor for traversal.',
  },
  {
    title: 'Build the critical loop',
    body: 'Drag equipment nodes (chiller, coil, HX, etc.) and connect them in flow order. Each node has inlets on the left and top and outlets on the right and bottom — run the supply across the top (right outlet → next left inlet). A pipe run appears between each pair.',
  },
  {
    title: 'Enter pipe-run data',
    body: 'Click each pipe run to set size, flow (GPM), length, material, and fittings. Velocity warnings flag runs above 4 fps; a red “!” marks runs still missing data.',
  },
  {
    title: 'Enter component pressure drops',
    body: 'Click each component to enter its ΔP (ft WC or psi) from manufacturer data. The coil is often the index component that sets the critical loop.',
  },
  {
    title: 'Close the loop',
    body: 'Connect the last component back to the Pump\'s inlet — drag from its bottom outlet to the pump\'s top or left inlet so the return leg routes around the bottom without crossing the supply. Once the loop closes, the Results panel shows the full Total Dynamic Head — export to PDF or Excel when ready.',
  },
];

export default function GettingStarted() {
  const show = useStore((s) => s.showGettingStarted);
  const dismiss = useStore((s) => s.dismissGettingStarted);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[540px] max-h-[90vh] overflow-y-auto">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            <h2 className="text-lg font-bold text-gray-800">Hydronic Pump Head Calculator — Getting Started</h2>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Trace the <span className="font-semibold text-gray-700">critical loop</span> of your hydronic system — pump → equipment →
            back to pump. The tool sums every pipe, fitting, and component loss into the
            <span className="font-semibold text-gray-700"> Total Dynamic Head</span> the pump must overcome.
          </p>

          <ol className="space-y-3 mb-5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-gray-800 mb-0.5">{s.title}</div>
                  <div className="text-xs text-gray-600 leading-relaxed">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Key principle</div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              This is a manual single-loop calculator, not a branched-network solver. You model only the
              single worst-case (index) loop; Branch / Tee nodes mark where non-critical sub-loops split
              off — shown for context but excluded from the TDH total. If a node has more than one
              continuing run, the tool traces the first and warns you, so the choice is never silent.
            </p>
          </div>

          <button
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            onClick={dismiss}
          >
            Got it — Start Building
          </button>
        </div>
      </div>
    </div>
  );
}
