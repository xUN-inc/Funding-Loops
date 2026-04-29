import { useState, useEffect } from 'react';
import { useTheme } from './theme';
import Icons from './icons';

const COLLAPSE_KEY = 'ui-kit:sidebar-collapsed:v1';

const DEFAULT_BRAND = { title: 'Dashboard', subtitle: '' };
const EMPTY_ITEMS = [];

const ChevronLeft = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronRight = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function readStoredCollapsed(fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {}
  return fallback;
}

/**
 * Generic sidebar. Drive content via `items` prop.
 *
 * Props:
 *   brand:        { title, subtitle, icon? }
 *   items:        Array<{ id, label, icon?, accent?, tag?, type?: 'section' }>
 *   active:       current item id
 *   onSelect:     (id) => void
 *   loadingTabs:  { [id]: boolean }
 *   dataCounts:   { [id]: number }
 *   footer:       ReactNode
 *   showThemeToggle: bool (default true)
 *   collapsed:    controlled flag (optional)
 *   onToggleCollapse: controlled setter (optional)
 *   defaultCollapsed: bool (default false) — uncontrolled init
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
  collapsed: collapsedProp,
  onToggleCollapse,
  defaultCollapsed = false,
}) {
  const { theme, toggleTheme } = useTheme();

  const isControlled = collapsedProp != null;
  const [internalCollapsed, setInternalCollapsed] = useState(
    () => readStoredCollapsed(defaultCollapsed),
  );
  const collapsed = isControlled ? collapsedProp : internalCollapsed;

  useEffect(() => {
    if (isControlled) return;
    try { localStorage.setItem(COLLAPSE_KEY, internalCollapsed ? '1' : '0'); } catch {}
  }, [internalCollapsed, isControlled]);

  const handleToggle = () => {
    if (onToggleCollapse) onToggleCollapse(!collapsed);
    if (!isControlled) setInternalCollapsed(v => !v);
  };

  const widthCls = collapsed ? 'w-[60px]' : 'w-[216px]';

  return (
    <aside
      className={`${widthCls} shrink-0 sticky top-0 h-screen flex flex-col bg-sidebar-bg border-r border-border transition-[width] duration-200 ease-out`}
    >
      {/* Brand bar */}
      {/* Toggle row — own row, sits above brand so brand title never gets squeezed */}
      <div
        className={`flex items-center border-b border-border ${
          collapsed ? 'justify-center px-2 py-2' : 'justify-end px-2 py-2'
        }`}
      >
        <CollapseButton collapsed={collapsed} onClick={handleToggle} />
      </div>

      {/* Brand row — full width below toggle */}
      <div
        className={`flex items-center gap-2.5 border-b border-border ${
          collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
        }`}
      >
        <div
          className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center text-white"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-purple) 100%)',
            boxShadow: '0 0 12px color-mix(in srgb, var(--color-primary) 25%, transparent)',
          }}
        >
          {brand.icon ?? Icons.logo}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-text tracking-tight truncate">
              {brand.title}
            </div>
            {brand.subtitle ? (
              <div className="text-[10px] text-text3 mt-px truncate">{brand.subtitle}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 px-2 py-2.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={item.id ?? `sec-${idx}`}>
                {idx > 0 ? (
                  <div
                    className={`h-px bg-border ${collapsed ? 'mx-1.5 my-2' : 'mx-2 my-2.5'}`}
                  />
                ) : null}
                {!collapsed ? (
                  <div className="px-2 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-text3">
                    {item.label}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={active === item.id}
              count={dataCounts?.[item.id]}
              isLoading={loadingTabs?.[item.id]}
              collapsed={collapsed}
              onSelect={onSelect}
            />
          );
        })}
      </nav>

      {(footer || showThemeToggle) ? (
        <div className="px-3 py-2.5 flex flex-col gap-2 border-t border-border">
          {showThemeToggle ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={collapsed ? `Theme: ${theme}` : undefined}
              className={`flex items-center rounded-md cursor-pointer text-[11px] font-mono tracking-wider transition-colors bg-surface2 border border-border text-text2 hover:text-text ${
                collapsed ? 'justify-center p-1.5' : 'justify-between px-2.5 py-1.5'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full bg-primary shrink-0"
                  style={{ boxShadow: '0 0 6px color-mix(in srgb, var(--color-primary) 50%, transparent)' }}
                />
                {!collapsed ? (
                  <span className="uppercase font-bold">{theme}</span>
                ) : null}
              </span>
              {!collapsed ? <span className="text-text3">›</span> : null}
            </button>
          ) : null}
          {!collapsed ? footer : null}
        </div>
      ) : null}
    </aside>
  );
}

function CollapseButton({ collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="w-[26px] h-[26px] rounded-md flex items-center justify-center bg-surface2 border border-border text-text2 cursor-pointer shrink-0 transition-colors hover:text-text hover:bg-hover-bg"
    >
      {collapsed ? ChevronRight : ChevronLeft}
    </button>
  );
}

function SidebarItem({ item, isActive, count, isLoading, collapsed, onSelect }) {
  const { C } = useTheme();
  const accent = item.accent ?? C.primary;

  const handleClick = () => onSelect?.(item.id);

  const baseStyle = {
    background: isActive ? `${accent}1A` : 'transparent',
    color: isActive ? accent : undefined,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center rounded-md border-0 cursor-pointer mb-0.5 text-left transition-colors ${
        collapsed ? 'justify-center py-2' : 'justify-between px-2.5 py-1.5'
      } ${isActive ? '' : 'text-text2 hover:bg-hover-bg hover:text-text'}`}
      style={baseStyle}
    >
      <div
        className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center w-full' : 'justify-start'}`}
      >
        {item.icon ? (
          <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.65 }}>
            {item.icon}
          </span>
        ) : null}
        {!collapsed ? (
          <span className={`text-[13px] ${isActive ? 'font-semibold' : 'font-normal'}`}>
            {item.label}
          </span>
        ) : null}
      </div>
      {!collapsed && item.tag ? (
        <span
          className="text-[9px] font-bold font-mono shrink-0 rounded px-1.5 py-px tracking-wider"
          style={{
            color: isActive ? '#fff' : accent,
            background: isActive ? accent : `${accent}18`,
            border: `1px solid ${accent}40`,
          }}
        >
          {item.tag}
        </span>
      ) : !collapsed && isLoading ? (
        <div
          className="w-1.5 h-1.5 rounded-full bg-warning shrink-0"
          style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}
        />
      ) : !collapsed && count != null ? (
        <span
          className="text-[10px] font-bold font-mono shrink-0 rounded px-1.5 py-px"
          style={{
            color: isActive ? accent : 'var(--color-text3)',
            background: isActive ? `${accent}1A` : 'var(--color-surface2)',
            border: `1px solid ${isActive ? `${accent}30` : 'var(--color-border)'}`,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
