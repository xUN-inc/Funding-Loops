import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea,
} from 'recharts';
import { GRID, AXIS, TOOLTIP, SCATTER, VIZ, CHART_HEIGHT } from '../dataviz';

/**
 * Scatter / bubble chart with optional risk-quadrant shading.
 *
 * <ScatterAnomaly
 *   data={[{ x: 95, y: 2, z: 100, name: 'Foo' }]}
 *   xLabel="X" yLabel="Y"
 *   xDomain={[80, 105]} yDomain={[0, 100]}
 *   dangerZone={{ x: [95, 105], y: [0, 5] }}
 *   tooltip={(d) => <>{d.name}<br/>{d.x}% / {d.y}%</>}
 * />
 */
export default function ScatterAnomaly({
  data,
  xKey = 'x', yKey = 'y', zKey = 'z',
  xLabel, yLabel,
  xDomain, yDomain,
  xTickFormatter, yTickFormatter,
  dangerZone,
  height = CHART_HEIGHT.large,
  color = VIZ.alert,
  tooltip,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
        <CartesianGrid {...GRID.both} />

        {dangerZone && (
          <ReferenceArea
            x1={dangerZone.x[0]} x2={dangerZone.x[1]}
            y1={dangerZone.y[0]} y2={dangerZone.y[1]}
            fill={VIZ.alert} fillOpacity={0.06}
            stroke={VIZ.alert} strokeOpacity={0.3} strokeDasharray="3 3"
          />
        )}

        <XAxis
          dataKey={xKey} type="number" domain={xDomain} tickFormatter={xTickFormatter}
          {...AXIS.x} axisLine={{ stroke: VIZ.axisStroke }}
          label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -14, fill: VIZ.axisTick, fontSize: 10 } : undefined}
        />
        <YAxis
          dataKey={yKey} type="number" domain={yDomain} tickFormatter={yTickFormatter}
          {...AXIS.y} axisLine={{ stroke: VIZ.axisStroke }}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: VIZ.axisTick, fontSize: 10 } : undefined}
        />
        <ZAxis dataKey={zKey} range={SCATTER.zRange} />

        <Tooltip
          cursor={{ stroke: VIZ.reference, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div style={TOOLTIP.wrapper}>
                {tooltip ? tooltip(d) : (
                  <span style={{ color: '#fff', fontSize: 12 }}>{d?.name ?? '—'}</span>
                )}
              </div>
            );
          }}
        />
        <Scatter data={data} fill={color} fillOpacity={SCATTER.fillOpacity} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
