import { useState, useEffect } from "react";
import { useTheme } from "./theme";
import Icons from "./icons";

const COLLAPSE_KEY = "ui-kit:sidebar-collapsed:v1";
const W_EXPANDED = 216;
const W_COLLAPSED = 60;

// Hoisted static styles — never re-allocated.
const ASIDE_BASE = {
  flexShrink: 0,
  height: "100vh",
  position: "sticky",
  top: 0,
  display: "flex",
  flexDirection: "column",
  transition: "width .18s ease",
};
const BRAND_LOGO = {
  width: 30,
  height: 30,
  borderRadius: 8,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
};
const NAV_BOX = { flex: 1, padding: "10px 8px", overflowY: "auto" };
const SEC_HEADER = {
  padding: "4px 8px 8px",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".1em",
};
const ITEM_INNER = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};
const FOOTER_BOX = {
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const TOGGLE_BTN = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderRadius: 6,
  padding: "6px 9px",
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono), monospace",
  letterSpacing: ".04em",
  transition: "background .1s, color .1s",
};
const DEFAULT_BRAND = { title: "Dashboard", subtitle: "" };
const EMPTY_ITEMS = [];

const ChevronLeft = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M10 3l-5 5 5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const ChevronRight = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 3l5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function readStoredCollapsed(fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
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
 *   collapsed:    controlled collapse flag (optional)
 *   onToggleCollapse: controlled setter (optional)
 *   defaultCollapsed: bool (default false) — only used when uncontrolled
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
  const { C, theme, toggleTheme } = useTheme();

  const isControlled = collapsedProp != null;
  const [internalCollapsed, setInternalCollapsed] = useState(() =>
    readStoredCollapsed(defaultCollapsed),
  );
  const collapsed = isControlled ? collapsedProp : internalCollapsed;

  useEffect(() => {
    if (isControlled) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, internalCollapsed ? "1" : "0");
    } catch {}
  }, [internalCollapsed, isControlled]);

  const handleToggle = () => {
    if (onToggleCollapse) onToggleCollapse(!collapsed);
    if (!isControlled) setInternalCollapsed((v) => !v);
  };

  return (
    <aside
      style={{
        ...ASIDE_BASE,
        width: collapsed ? W_COLLAPSED : W_EXPANDED,
        background: C.sidebarBg,
        borderRight: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          padding: collapsed ? "14px 8px" : "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 10,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: collapsed ? "0 0 auto" : 1,
          }}
        >
          <div
            style={{
              ...BRAND_LOGO,
              background: `linear-gradient(135deg, ${C.primary} 0%, ${C.purple} 100%)`,
              boxShadow: `0 0 12px ${C.primary}40`,
            }}
          >
            {brand.icon ?? Icons.logo}
          </div>
          {!collapsed ? (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  letterSpacing: "-.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {brand.title}
              </div>
              {brand.subtitle ? (
                <div
                  style={{
                    fontSize: 10,
                    color: C.text3,
                    marginTop: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {brand.subtitle}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <CollapseButton C={C} collapsed={collapsed} onClick={handleToggle} />
        ) : null}
      </div>

      {collapsed ? (
        <div
          style={{
            padding: "8px 0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CollapseButton C={C} collapsed={collapsed} onClick={handleToggle} />
        </div>
      ) : null}

      <nav style={NAV_BOX}>
        {items.map((item, idx) => {
          if (item.type === "section") {
            return (
              <div key={item.id ?? `sec-${idx}`}>
                {idx > 0 ? (
                  <div
                    style={{
                      height: 1,
                      background: C.border,
                      margin: collapsed ? "8px 6px 10px" : "8px 8px 10px",
                    }}
                  />
                ) : null}
                {!collapsed ? (
                  <div style={{ ...SEC_HEADER, color: C.text3 }}>
                    {item.label}
                  </div>
                ) : null}
              </div>
            );
          }

          const accent = item.accent ?? C.primary;
          const isActive = active === item.id;
          const count = dataCounts?.[item.id];
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
              collapsed={collapsed}
              onSelect={onSelect}
            />
          );
        })}
      </nav>

      {footer || showThemeToggle ? (
        <div style={{ ...FOOTER_BOX, borderTop: `1px solid ${C.border}` }}>
          {showThemeToggle ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={collapsed ? `Theme: ${theme}` : undefined}
              style={{
                ...TOGGLE_BTN,
                background: C.surface2,
                border: `1px solid ${C.border}`,
                color: C.text2,
                justifyContent: collapsed ? "center" : "space-between",
                padding: collapsed ? "6px" : "6px 9px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = C.text2;
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: C.primary,
                    boxShadow: `0 0 6px ${C.primary}80`,
                    flexShrink: 0,
                  }}
                />
                {!collapsed ? (
                  <span style={{ textTransform: "uppercase", fontWeight: 700 }}>
                    {theme}
                  </span>
                ) : null}
              </span>
              {!collapsed ? <span style={{ color: C.text3 }}>›</span> : null}
            </button>
          ) : null}
          {!collapsed ? footer : null}
        </div>
      ) : null}
    </aside>
  );
}

function CollapseButton({ C, collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.surface2,
        border: `1px solid ${C.border}`,
        color: C.text2,
        cursor: "pointer",
        flexShrink: 0,
        transition: "background .1s, color .1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.hoverBg;
        e.currentTarget.style.color = C.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = C.surface2;
        e.currentTarget.style.color = C.text2;
      }}
    >
      {collapsed ? ChevronRight : ChevronLeft}
    </button>
  );
}

function SidebarItem({
  item,
  accent,
  isActive,
  count,
  isLoading,
  C,
  collapsed,
  onSelect,
}) {
  const handleClick = () => onSelect?.(item.id);
  const handleEnter = (e) => {
    if (isActive) return;
    e.currentTarget.style.background = C.hoverBg;
    e.currentTarget.style.color = C.text;
  };
  const handleLeave = (e) => {
    if (isActive) return;
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = C.text2;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: collapsed ? "8px 0" : "7px 10px",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        marginBottom: 2,
        background: isActive ? `${accent}1A` : "transparent",
        color: isActive ? accent : C.text2,
        transition: "background .1s, color .1s",
        textAlign: "left",
        touchAction: "manipulation",
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        style={{
          ...ITEM_INNER,
          justifyContent: collapsed ? "center" : "flex-start",
          width: collapsed ? "100%" : "auto",
        }}
      >
        {item.icon ? (
          <span style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }}>
            {item.icon}
          </span>
        ) : null}
        {!collapsed ? (
          <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
            {item.label}
          </span>
        ) : null}
      </div>
      {!collapsed && item.tag ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "var(--font-geist-mono), monospace",
            flexShrink: 0,
            color: isActive ? "#fff" : accent,
            background: isActive ? accent : `${accent}18`,
            border: `1px solid ${accent}40`,
            borderRadius: 3,
            padding: "1px 5px",
            letterSpacing: ".06em",
          }}
        >
          {item.tag}
        </span>
      ) : !collapsed && isLoading ? (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.warning,
            animation: "pulse-dot 1s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      ) : !collapsed && count != null ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "monospace",
            flexShrink: 0,
            color: isActive ? accent : C.text3,
            background: isActive ? `${accent}1A` : C.surface2,
            border: `1px solid ${isActive ? `${accent}30` : C.border}`,
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
