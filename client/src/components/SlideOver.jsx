import { useEffect } from 'react';
import { useTheme } from '../../ui-kit';

/**
 * Right-edge slide-in panel. Slides from right → left when `open`.
 * - backdrop click closes
 * - Escape closes
 * - 460px wide on desktop, full width below 600px
 */
export default function SlideOver({ open, onClose, title, subtitle, accent, children, width = 460 }) {
  const { C } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />
      <aside
        role="dialog"
        aria-hidden={!open}
        className="fixed top-0 right-0 bottom-0 z-50 bg-surface border-l border-border flex flex-col"
        style={{
          width: `min(${width}px, 100vw)`,
          boxShadow: C.shadow,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <header className="px-4 py-3.5 border-b border-border bg-surface2 flex items-center gap-2.5">
          {accent ? (
            <div
              className="w-[3px] h-[22px] rounded-sm shrink-0"
              style={{ background: accent }}
            />
          ) : null}
          <div className="flex-1 min-w-0">
            {title ? (
              <div className="text-[13px] font-bold text-text truncate">{title}</div>
            ) : null}
            {subtitle ? (
              <div className="text-[11px] text-text3 mt-px">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-md bg-transparent border border-border text-text2 cursor-pointer flex items-center justify-center text-base leading-none hover:text-text hover:bg-hover-bg transition-colors"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-[18px]">{children}</div>
      </aside>
    </>
  );
}
