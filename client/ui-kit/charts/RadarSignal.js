import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { VIZ, TOOLTIP, CHART_HEIGHT, seriesColor } from '../dataviz';
import DarkTooltip from '../components/DarkTooltip';

/**
 * Radar / spider chart for showing a single entity's profile across
 * multiple dimensions, or comparing two.
 *
 * <RadarSignal
 *   data={[{ axis: 'A', subject: 98, baseline: 40 }, ...]}
 *   series={[{ key: 'subject', label: 'This', color: VIZ.alert }, { key: 'baseline', label: 'Avg' }]}
 * />
 */
export default function RadarSignal({
  data,
  series,
  height = CHART_HEIGHT.medium,
  axisKey = 'axis',
  domain = [0, 100],
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="78%">
        <PolarGrid stroke={VIZ.gridStroke} />
        <PolarAngleAxis dataKey={axisKey} tick={{ fill: VIZ.axisLabel, fontSize: 10 }} />
        <PolarRadiusAxis
          domain={domain}
          tick={{ fill: VIZ.axisTick, fontSize: 9 }}
          stroke={VIZ.gridStroke}
          axisLine={false}
          tickCount={4}
        />
        <Tooltip cursor={TOOLTIP.cursor} content={<DarkTooltip />} />
        {series.map((s, i) => {
          const color = s.color ?? seriesColor(i);
          return (
            <Radar
              key={s.key}
              name={s.label}
              dataKey={s.key}
              stroke={color}
              fill={color}
              fillOpacity={0.16}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          );
        })}
      </RadarChart>
    </ResponsiveContainer>
  );
}
