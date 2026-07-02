import { useEffect } from 'react';
import { useStore } from '../store';

export default function ContextMenu() {
  const menu = useStore((s) => s.contextMenu);
  const setContextMenu = useStore((s) => s.setContextMenu);
  const deleteElement = useStore((s) => s.deleteElement);
  const duplicateElement = useStore((s) => s.duplicateElement);
  const select = useStore((s) => s.select);
  const resetEdgeShape = useStore((s) => s.resetEdgeShape);
  const hasOffset = useStore((s) => {
    if (menu?.elementType !== 'edge') return false;
    const o = s.edges.find((e) => e.id === menu.elementId)?.data?.offset;
    return !!o && (o.x !== 0 || o.y !== 0);
  });

  useEffect(() => {
    if (!menu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu, setContextMenu]);

  if (!menu) return null;

  const item = 'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100';

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[150px]"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className={item}
        onClick={() => {
          select(menu.elementId, menu.elementType);
          setContextMenu(null);
        }}
      >
        Properties / Rename
      </button>
      {menu.elementType === 'node' && (
        <button className={item} onClick={() => duplicateElement(menu.elementId, menu.elementType)}>
          Duplicate
        </button>
      )}
      {menu.elementType === 'edge' && hasOffset && (
        <button className={item} onClick={() => resetEdgeShape(menu.elementId)}>
          Reset pipe shape
        </button>
      )}
      <div className="h-px bg-gray-100 my-1" />
      <button
        className={`${item} text-red-600`}
        onClick={() => deleteElement(menu.elementId, menu.elementType)}
      >
        Delete
      </button>
    </div>
  );
}
