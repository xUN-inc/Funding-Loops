import {
  Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Area, ComposedChart,
} from 'recharts';
import { GRID, AXIS, VIZ, CHART_HEIGHT } from '../dataviz';
import DarkTooltip from '../components/DarkTooltip';

/**
 * Time-series line for "growth from baseline" pattern.
 * Color shifts to alert if final > baseline * (1 + alertGrowth).
 *
 * <AmendmentCreepLine data={[{ year: 2020, value: 50_000 }, ...]} tickFormatter={fmt} />
 */
export default function AmendmentCreepLine({
  data,
  xKey = 'year',
  yKey = 'value',
  tickFormatter,
  height = CHART_HEIGHT.medium,
  alertGrowth = 5,
}) {
  if (!data?.length) return null;
  const baseline = Number(data[0][yKey]) || 0;
  const final    = Number(data[data.length - 1][yKey]) || 0;
  const exploded = baseline > 0 && final > baseline * alertGrowth;
  const color    = exploded ? VIZ.alert : VIZ.watch;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="creepFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID.horizontal} />
        <XAxis dataKey={xKey} {...AXIS.x} />
        <YAxis {...AXIS.y} tickFormatter={tickFormatter} width={56} />
        <Tooltip
          cursor={{ stroke: VIZ.reference, strokeDasharray: '3 3' }}
          content={<DarkTooltip fmtValue={(v) => (tickFormatter ? tickFormatter(v) : v)} />}
        />
        <ReferenceLine
          y={baseline}
          stroke={VIZ.reference}
          strokeDasharray="4 4"
          label={{ value: 'baseline', position: 'right', fill: VIZ.axisTick, fontSize: 9 }}
        />
        <Area type="monotone" dataKey={yKey} stroke="none" fill="url(#creepFill)" isAnimationActive={false} />
        <Line
          type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.75}
          dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
