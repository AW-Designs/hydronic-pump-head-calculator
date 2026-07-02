import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two build modes (same setup as the sister HVAC ESP Calculator):
//  • default    → normal chunked build into dist/ (use this if you ever host it).
//  • singlefile → everything (JS, CSS, app) inlined into ONE self-contained
//    dist-portable/index.html that runs by double-clicking, even from file://.
//
// base: './' keeps all paths relative so the app works under the file://
// protocol (and, later, inside Electron) without changes.
export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    server: {
      // autoPort: start at 5173 but fall back to a free port if taken
      // (strictPort: false). No hardcoded/locked port.
      port: 5173,
      strictPort: false,
    },
    build: {
      outDir: single ? 'dist-portable' : 'dist',
      assetsDir: 'assets',
      // Inline everything when building the portable single file.
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
      chunkSizeWarningLimit: 4000,
    },
  };
});
