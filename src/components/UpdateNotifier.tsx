import { useEffect, useState } from 'react';

// Only present inside the Tauri desktop shell — absent in the browser/portable builds.
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'downloading' }
  | { status: 'error'; message: string };

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) setState({ status: 'available', version: update.version });
      } catch (err) {
        setState({ status: 'error', message: String(err) });
      }
    })();
  }, []);

  if (state.status === 'idle' || state.status === 'error') return null;

  const installAndRestart = async () => {
    setState({ status: 'downloading' });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (err) {
      setState({ status: 'error', message: String(err) });
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-blue-600 text-white text-sm py-1.5 px-4">
      {state.status === 'available' && (
        <>
          <span>Update {state.version} is available.</span>
          <button
            onClick={installAndRestart}
            className="underline font-medium hover:no-underline"
          >
            Install &amp; restart
          </button>
        </>
      )}
      {state.status === 'downloading' && <span>Downloading update…</span>}
    </div>
  );
}
