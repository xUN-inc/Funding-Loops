import { useEffect } from 'react';
import { useTheme } from '../../ui-kit';

/**
 * Right-edge slide-in panel. Slides from right → left when `open`.
 * - backdrop click closes
 * - Escape closes
 * - 420px wide on desktop, full width below 600px
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
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .2s ease',
        }}
      />
      <aside
        role="dialog"
        aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: `min(${width}px, 100vw)`,
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: C.shadow,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface2,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {accent ? (
            <div style={{ width: 3, height: 22, borderRadius: 2, background: accent, flexShrink: 0 }} />
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{title}</div>
            ) : null}
            {subtitle ? (
              <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.text2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = 'transparent'; }}
          >×</button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {children}
        </div>
      </aside>
    </>
  );
}
