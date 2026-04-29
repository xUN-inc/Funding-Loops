import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

// Versioned key — bump when storage shape changes.
const THEME_KEY = 'ui-kit:theme:v1';
const VALID_THEMES = new Set(['dark', 'light']);

// Neutral zinc + indigo. Edit values here to retheme entire kit.
export const PALETTES = {
  dark: {
    bg:          '#09090B',
    surface:     '#0F0F12',
    surface2:    '#141418',
    border:      '#1F1F23',
    borderLight: '#27272A',
    primary:     '#6366F1',
    success:     '#10B981',
    warning:     '#F59E0B',
    danger:      '#EF4444',
    purple:      '#A855F7',
    cyan:        '#06B6D4',
    text:        '#F4F4F5',
    text2:       '#A1A1AA',
    text3:       '#52525B',
    rowAlt:      'rgba(255,255,255,.018)',
    hoverBg:     'rgba(255,255,255,.04)',
    sidebarBg:   '#0F0F12',
    inputBg:     '#0A0A0C',
    tooltipBg:   '#141418',
    shadow:      '0 8px 32px rgba(0,0,0,.5)',
    isDark:      true,
  },
  light: {
    bg:          '#FAFAFA',
    surface:     '#FFFFFF',
    surface2:    '#F4F4F5',
    border:      '#E4E4E7',
    borderLight: '#D4D4D8',
    primary:     '#4F46E5',
    success:     '#059669',
    warning:     '#D97706',
    danger:      '#DC2626',
    purple:      '#7C3AED',
    cyan:        '#0891B2',
    text:        '#18181B',
    text2:       '#52525B',
    text3:       '#71717A',
    rowAlt:      'rgba(0,0,0,.022)',
    hoverBg:     'rgba(0,0,0,.04)',
    sidebarBg:   '#F4F4F5',
    inputBg:     '#F4F4F5',
    tooltipBg:   '#FFFFFF',
    shadow:      '0 8px 24px rgba(0,0,0,.08)',
    isDark:      false,
  },
};

export const CHART_COLORS_FOR = (C) => [
  C.primary, C.success, C.warning, C.danger, C.purple, C.cyan,
];

export const C = PALETTES.light;
export const CHART_COLORS = CHART_COLORS_FOR(PALETTES.light);

const NOOP = () => {};
const DEFAULT_CTX = { C: PALETTES.light, theme: 'light', setTheme: NOOP, toggleTheme: NOOP };
const ThemeContext = createContext(DEFAULT_CTX);

function readStoredTheme(fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return VALID_THEMES.has(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/**
 * SSR-safe inline script. Renders the saved theme onto <html data-theme="…">
 * before React hydrates — prevents the flash-of-default-theme flicker.
 *
 * Usage (Vite/CRA: not needed; SSR/Next.js):
 *   <head>{ThemeFlickerGuard()}</head>
 */
export function ThemeFlickerGuard() {
  const code = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children, defaultTheme = 'light' }) {
  // Lazy init — read storage once on mount instead of every render
  const [theme, setThemeState] = useState(() => readStoredTheme(defaultTheme));

  // Stable setter. Accepts 'dark' | 'light' | (prev) => next.
  const setTheme = useCallback((next) => {
    setThemeState(curr => {
      const resolved = typeof next === 'function' ? next(curr) : next;
      return VALID_THEMES.has(resolved) ? resolved : curr;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(curr => (curr === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  // Memoize so consumers using `useTheme()` don't re-render unless theme flips
  const value = useMemo(
    () => ({ C: PALETTES[theme], theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
