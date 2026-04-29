/**
 * Chart design tokens. Single source of truth for Recharts styling.
 *
 * Mental model:
 *   - Categorical → PALETTES.series
 *   - Risk thresholds → riskColor()
 *   - Diverging → PALETTES.diverging
 *   - Sequential intensity → PALETTES.heat
 *
 * Tokens are module-level for ease of import inside chart props.
 * They consume the dark palette by default. To re-theme charts, edit
 * PALETTES in theme.js — VIZ tokens here will follow.
 */

import { PALETTES as THEMES } from './theme';

const C = THEMES.dark;

export const VIZ = {
  surface:    C.surface,
  surface2:   C.surface2,
  gridStroke: C.border,
  axisStroke: C.border,
  axisTick:   C.text3,
  axisLabel:  C.text2,
  reference:  'rgba(255,255,255,.18)',
  baseline:   'rgba(255,255,255,.08)',
  ok:         C.success,
  watch:      C.warning,
  alert:      C.danger,
  neutral:    C.text2,
  highlight:  '#FFFFFF',
  dim:        'rgba(255,255,255,.14)',
};

export const PALETTES = {
  series: [
    C.primary, C.success, C.warning, C.danger, C.purple, C.cyan,
    '#F472B6', '#A3E635',
  ],
  diverging: ['#EF4444', '#F59E0B', '#A1A1AA', '#34D399', '#10B981'],
  heat: ['#1E1B4B', '#3730A3', '#4F46E5', '#6366F1', '#818CF8', '#C7D2FE'],
  risk: {
    low:    C.success,
    medium: C.warning,
    high:   C.danger,
    extreme:'#B91C1C',
  },
};

export function seriesColor(i) {
  const p = PALETTES.series;
  return p[i % p.length];
}

export function riskColor(value, { high, medium, extreme } = {}) {
  const v = Number(value);
  if (extreme != null && v >= extreme) return PALETTES.risk.extreme;
  if (high    != null && v >= high)    return VIZ.alert;
  if (medium  != null && v >= medium)  return VIZ.watch;
  return VIZ.ok;
}

export function rampColor(t, palette = PALETTES.heat) {
  if (t == null || isNaN(t)) return VIZ.dim;
  const idx = Math.max(0, Math.min(palette.length - 1, Math.round(t * (palette.length - 1))));
  return palette[idx];
}

export const GRID = {
  horizontal: { strokeDasharray: '3 3', stroke: VIZ.gridStroke, vertical: false },
  vertical:   { strokeDasharray: '3 3', stroke: VIZ.gridStroke, horizontal: false },
  both:       { strokeDasharray: '3 3', stroke: VIZ.gridStroke },
};

export const AXIS = {
  x: {
    tick:     { fill: VIZ.axisTick, fontSize: 10 },
    axisLine: { stroke: VIZ.axisStroke },
    tickLine: false,
  },
  y: {
    tick:     { fill: VIZ.axisTick, fontSize: 10 },
    axisLine: false,
    tickLine: false,
  },
  yCategory: {
    tick:     { fill: VIZ.axisLabel, fontSize: 10 },
    axisLine: false,
    tickLine: false,
  },
};

export const BAR = {
  vertical:   { radius: [3, 3, 0, 0], maxBarSize: 26 },
  horizontal: { radius: [0, 3, 3, 0], maxBarSize: 14 },
  thin:       { radius: [2, 2, 0, 0], maxBarSize: 10 },
};

export const PIE = {
  donut: { innerRadius: 58, outerRadius: 86, paddingAngle: 3 },
  ring:  { innerRadius: 70, outerRadius: 80, paddingAngle: 2 },
};

export const SCATTER = {
  zRange: [24, 220],
  fillOpacity: 0.65,
};

export const TOOLTIP = {
  cursor: { fill: 'rgba(255,255,255,.04)' },
  wrapper: {
    background: VIZ.surface2,
    border: `1px solid ${C.borderLight}`,
    borderRadius: 8,
    padding: '8px 12px',
    boxShadow: '0 8px 32px rgba(0,0,0,.5)',
  },
};

export const SPARK = {
  height:      36,
  strokeWidth: 1.75,
  areaOpacity: 0.18,
};

export const NET = {
  node: {
    base:    { fill: C.surface2,                stroke: C.borderLight, strokeWidth: 1.25, r: 22 },
    flagged: { fill: 'rgba(239,68,68,.16)',     stroke: VIZ.alert,      strokeWidth: 1.5,  r: 24 },
    suspect: { fill: 'rgba(245,158,11,.14)',    stroke: VIZ.watch,      strokeWidth: 1.25, r: 22 },
    person:  { fill: 'rgba(99,102,241,.12)',    stroke: C.primary,      strokeWidth: 1.25, r: 18 },
  },
  edge: {
    base: { stroke: C.borderLight,  strokeWidth: 1,    opacity: 0.55 },
    flow: { stroke: VIZ.alert,      strokeWidth: 1.5,  opacity: 0.85 },
    weak: { stroke: VIZ.gridStroke, strokeWidth: 0.75, opacity: 0.5  },
  },
  label: {
    fontSize: 10,
    fill: C.text2,
    fontWeight: 500,
  },
};

export const CHART_HEIGHT = {
  spark:  36,
  small:  160,
  medium: 230,
  large:  290,
  xlarge: 360,
};
