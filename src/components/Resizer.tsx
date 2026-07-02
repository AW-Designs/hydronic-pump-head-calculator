import { useCallback, useRef } from 'react';

interface Props {
  /** 'col' = a vertical bar you drag left/right to resize a width;
   *  'row' = a horizontal bar you drag up/down to resize a height. */
  axis: 'col' | 'row';
  /** Called with the incremental pixel delta along the drag axis. */
  onResize: (delta: number) => void;
}

/** A thin draggable divider for resizing adjacent panels. */
export default function Resizer({ axis, onResize }: Props) {
  const last = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      last.current = axis === 'col' ? e.clientX : e.clientY;

      const move = (ev: PointerEvent) => {
        const cur = axis === 'col' ? ev.clientX : ev.clientY;
        const delta = cur - last.current;
        last.current = cur;
        if (delta !== 0) onResize(delta);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = axis === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [axis, onResize]
  );

  const base =
    'shrink-0 z-20 bg-transparent hover:bg-accent/40 active:bg-accent/60 transition-colors';
  const dims =
    axis === 'col'
      ? 'w-1.5 h-full cursor-col-resize'
      : 'h-1.5 w-full cursor-row-resize';

  return <div className={`${base} ${dims}`} onPointerDown={onPointerDown} />;
}
