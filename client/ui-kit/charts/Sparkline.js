import { LineChart, Line, ResponsiveContainer, YAxis, Area, AreaChart } from 'recharts';
import { VIZ, SPARK } from '../dataviz';

/**
 * Tiny inline trend line for stat cards / table rows.
 * <Sparkline data={[1,3,2,5,4]} color={VIZ.ok} area />
 */
export default function Sparkline({
  data,
  color = VIZ.neutral,
  height = SPARK.height,
  area = false,
  width = '100%',
}) {
  if (!data?.length) return <div style={{ height, width: '100%' }} />;

  const points = data.map((v, i) => ({ i, v: Number(v) }));
  const Wrap = area ? AreaChart : LineChart;
  const Mark = area ? Area : Line;

  return (
    <ResponsiveContainer width={width} height={height}>
      <Wrap data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Mark
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={SPARK.strokeWidth}
          fill={color}
          fillOpacity={area ? SPARK.areaOpacity : 0}
          isAnimationActive={false}
          dot={false}
        />
      </Wrap>
    </ResponsiveContainer>
  );
}
