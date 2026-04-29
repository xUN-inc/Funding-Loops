// Convenience barrel. For tighter bundles, import directly:
//   import Sidebar from 'ui-kit/Sidebar';
//   import StatCard from 'ui-kit/components/StatCard';

export {
  ThemeProvider, ThemeFlickerGuard, useTheme,
  PALETTES, C, CHART_COLORS, CHART_COLORS_FOR,
} from './theme';
export { default as Icons } from './icons';
export { default as Sidebar } from './Sidebar';

// UI primitives
export { default as Badge }       from './components/Badge';
export { default as SectionCard } from './components/SectionCard';
export { default as StatCard }    from './components/StatCard';
export { default as PageHeader }  from './components/PageHeader';
export { default as SearchBar, filterRows } from './components/SearchBar';
export { default as DarkTooltip } from './components/DarkTooltip';
export { LoadingState, ErrorState, EmptyState } from './components/States';
export { Th, Td } from './components/TablePrimitives';

// Chart tokens
export {
  VIZ, PALETTES as VIZ_PALETTES, GRID, AXIS, BAR, PIE, SCATTER,
  TOOLTIP, SPARK, NET, CHART_HEIGHT,
  seriesColor, riskColor, rampColor,
} from './dataviz';

// Chart components (require `recharts` peer dep, except NetworkGraph)
export { default as Sparkline }          from './charts/Sparkline';
export { default as KPIDelta }           from './charts/KPIDelta';
export { default as CategoryBar }        from './charts/CategoryBar';
export { default as AmendmentCreepLine } from './charts/AmendmentCreepLine';
export { default as FlagDonut }          from './charts/FlagDonut';
export { default as ScatterAnomaly }     from './charts/ScatterAnomaly';
export { default as RadarSignal }        from './charts/RadarSignal';
export { default as NetworkGraph }       from './charts/NetworkGraph';
