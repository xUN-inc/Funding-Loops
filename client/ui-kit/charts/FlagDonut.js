import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../theme';
import { PIE, TOOLTIP, seriesColor, CHART_HEIGHT } from '../dataviz';
import DarkTooltip from '../components/DarkTooltip';

/**
 * Donut chart with built-in legend list.
 * <FlagDonut data={[{ name: 'A', value: 12 }, ...]} />
 */
export default function FlagDonut({
  data,
  height = CHART_HEIGHT.small + 30,
  innerLabel,
  showLegend = true,
}) {
  const { C } = useTheme();
  const items = data
    .filter(d => Number(d.value) > 0)
    .map((d, i) => ({ ...d, color: d.color ?? seriesColor(i) }));
  const total = items.reduce((a, d) => a + Number(d.value), 0);

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" {...PIE.donut} dataKey="value">
              {items.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              cursor={TOOLTIP.cursor}
              content={<DarkTooltip fmtValue={(v, n) => `${n}: ${v}`} />}
            />
          </PieChart>
        </ResponsiveContainer>
        {innerLabel && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-.02em' }}>
                {typeof innerLabel === 'function' ? innerLabel(total) : innerLabel}
              </div>
              <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>
                total
              </div>
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 6 }}>
          {items.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.text2 }}>{d.name}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
