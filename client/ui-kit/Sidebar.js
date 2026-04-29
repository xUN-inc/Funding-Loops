import { useTheme } from './theme';
import Icons from './icons';

// Hoisted static styles — never re-allocated.
const ASIDE_BASE = {
  width: 216, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
  display: 'flex', flexDirection: 'column',
};
const BRAND_BOX = {
  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
};
const BRAND_LOGO = {
  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff',
};
const NAV_BOX = { flex: 1, padding: '10px 8px', overflowY: 'auto' };
const SEC_HEADER = {
  padding: '4px 8px 8px', fontSize: 9, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.1em',
};
const ITEM_INNER = { display: 'flex', alignItems: 'center', gap: 9 };
const FOOTER_BOX = {
  padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8,
};
const TOGGLE_BTN = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderRadius: 6, padding: '6px 9px', cursor: 'pointer',
  fontSize: 11, fontFamily: 'var(--font-geist-mono), monospace',
  letterSpacing: '.04em', transition: 'background .1s, color .1s',
};
const DEFAULT_BRAND = { title: 'Dashboard', subtitle: '' };
const EMPTY_ITEMS = [];

/**
 * Generic sidebar. Drive content via `items` prop.
 *
 * Props:
 *   brand:        { title, subtitle, icon? }
 *   items:        Array<{
 *                   id, label, icon?, accent?, tag?,
 *                   type?: 'section'  // divider + section header (uses `label`)
 *                 }>
 *   active:       current item id
 *   onSelect:     (id) => void
 *   loadingTabs:  { [id]: boolean }   optional
 *   dataCounts:   { [id]: number }    optional
 *   footer:       ReactNode           optional
 *   showThemeToggle: bool (default true)
 */
export default function Sidebar({
  brand = DEFAULT_BRAND,
  items = EMPTY_ITEMS,
  active,
  onSelect,
  loadingTabs,
  dataCounts,
  footer,
  showThemeToggle = true,
}) {
  const { C, theme, toggleTheme } = useTheme();

  return (
    <aside style={{
      ...ASIDE_BASE,
      background: C.sidebarBg, borderRight: `1px solid ${C.border}`,
    }}>
      <div style={{ ...BRAND_BOX, borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          ...BRAND_LOGO,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.purple} 100%)`,
          boxShadow: `0 0 12px ${C.primary}40`,
        }}>
          {brand.icon ?? Icons.logo}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-.01em' }}>
            {brand.title}
          </div>
          {brand.subtitle ? (
            <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>
              {brand.subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <nav style={NAV_BOX}>
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={item.id ?? `sec-${idx}`}>
                {idx > 0 ? (
                  <div style={{ height: 1, background: C.border, margin: '8px 8px 10px' }} />
                ) : null}
                <div style={{ ...SEC_HEADER, color: C.text3 }}>
                  {item.label}
                </div>
              </div>
            );
          }

          const accent    = item.accent ?? C.primary;
          const isActive  = active === item.id;
          const count     = dataCounts?.[item.id];
          const isLoading = loadingTabs?.[item.id];

          return (
            <SidebarItem
              key={item.id}
              item={item}
              accent={accent}
              isActive={isActive}
              count={count}
              isLoading={isLoading}
              C={C}
              onSelect={onSelect}
            />
          );
        })}
      </nav>

      {(footer || showThemeToggle) ? (
        <div style={{ ...FOOTER_BOX, borderTop: `1px solid ${C.border}` }}>
          {showThemeToggle ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{
                ...TOGGLE_BTN,
                background: C.surface2, border: `1px solid ${C.border}`,
                color: C.text2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text2; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: C.primary, boxShadow: `0 0 6px ${C.primary}80`,
                  flexShrink: 0,
                }} />
                <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{theme}</span>
              </span>
              <span style={{ color: C.text3 }}>›</span>
            </button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

// Extracted to keep map body lean and avoid in-component component definition.
function SidebarItem({ item, accent, isActive, count, isLoading, C, onSelect }) {
  const handleClick = () => onSelect?.(item.id);
  const handleEnter = (e) => {
    if (isActive) return;
    e.currentTarget.style.background = C.hoverBg;
    e.currentTarget.style.color = C.text;
  };
  const handleLeave = (e) => {
    if (isActive) return;
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = C.text2;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', marginBottom: 2,
        background: isActive ? `${accent}1A` : 'transparent',
        color: isActive ? accent : C.text2,
        transition: 'background .1s, color .1s',
        textAlign: 'left',
        touchAction: 'manipulation',
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div style={ITEM_INNER}>
        {item.icon ? (
          <span style={{ opacity: isActive ? 1 : 0.55, flexShrink: 0 }}>{item.icon}</span>
        ) : null}
        <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
      </div>
      {item.tag ? (
        <span style={{
          fontSize: 9, fontWeight: 700,
          fontFamily: 'var(--font-geist-mono), monospace', flexShrink: 0,
          color: isActive ? '#fff' : accent,
          background: isActive ? accent : `${accent}18`,
          border: `1px solid ${accent}40`,
          borderRadius: 3, padding: '1px 5px', letterSpacing: '.06em',
        }}>{item.tag}</span>
      ) : isLoading ? (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: C.warning, animation: 'pulse-dot 1s ease-in-out infinite',
          flexShrink: 0,
        }} />
      ) : count != null ? (
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
          color: isActive ? accent : C.text3,
          background: isActive ? `${accent}1A` : C.surface2,
          border: `1px solid ${isActive ? `${accent}30` : C.border}`,
          borderRadius: 4, padding: '1px 5px',
        }}>{count}</span>
      ) : null}
    </button>
  );
}
