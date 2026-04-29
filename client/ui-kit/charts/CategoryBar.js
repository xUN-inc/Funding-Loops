import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { GRID, AXIS, BAR, TOOLTIP, riskColor, VIZ, CHART_HEIGHT } from '../dataviz';
import DarkTooltip from '../components/DarkTooltip';

/**
 * Categorical bar chart with built-in risk coloring.
 *
 * <CategoryBar
 *   data={[{ label: 'Foo', value: 22 }, ...]}
 *   thresholds={{ high: 20, medium: 10 }}
 *   tooltipFmt={(v, _n, p) => `${p.payload.label}: ${v}`}
 *   orientation="horizontal" // or "vertical"
 *   height={230}
 * />
 */
export default function CategoryBar({
  data,
  thresholds,
  color,
  tooltipFmt,
  orientation = 'vertical',
  height = CHART_HEIGHT.medium,
  domain,
  tickFormatter,
  labelKey = 'label',
  valueKey = 'value',
  yAxisWidth,
}) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={isHorizontal
          ? { left: 4, right: 20, top: 4, bottom: 4 }
          : { left: 0, right: 8, top: 4, bottom: 48 }}
      >
        <CartesianGrid {...(isHorizontal ? GRID.vertical : GRID.horizontal)} />

        {isHorizontal ? (
          <>
            <XAxis {...AXIS.x} type="number" domain={domain} tickFormatter={tickFormatter} />
            <YAxis {...AXIS.yCategory} type="category" dataKey={labelKey} width={yAxisWidth ?? 148} />
          </>
        ) : (
          <>
            <XAxis
              dataKey={labelKey}
              tick={{ fill: VIZ.axisTick, fontSize: 9 }}
              axisLine={{ stroke: VIZ.axisStroke }}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis {...AXIS.y} domain={domain} tickFormatter={tickFormatter} />
          </>
        )}

        <Tooltip cursor={TOOLTIP.cursor} content={<DarkTooltip fmtValue={tooltipFmt} />} />
        <Bar dataKey={valueKey} {...(isHorizontal ? BAR.horizontal : BAR.vertical)}>
          {data.map((d, i) => {
            const v = Number(d[valueKey]);
            const fill = thresholds ? riskColor(v, thresholds) : (color ?? VIZ.ok);
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
