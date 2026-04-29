import { useTheme } from '../theme';
import { VIZ } from '../dataviz';

/**
 * Inline delta indicator: "▲ 12.4%" / "▼ -3.1%" / "—"
 * `goodDirection` flips colors for metrics where down is good.
 */
export default function KPIDelta({ value, suffix = '%', goodDirection = 'up' }) {
  const { C } = useTheme();
  if (value == null || isNaN(value)) {
    return <span style={{ color: C.text3, fontSize: 11 }}>—</span>;
  }
  const v = Number(value);
  const isUp = v > 0;
  const isFlat = v === 0;
  const isGood = isFlat ? null : (goodDirection === 'up' ? isUp : !isUp);
  const color = isFlat ? C.text3 : isGood ? VIZ.ok : VIZ.alert;
  const arrow = isFlat ? '—' : isUp ? '▲' : '▼';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color,
    }}>
      <span style={{ fontSize: 9 }}>{arrow}</span>
      {Math.abs(v).toFixed(1)}{suffix}
    </span>
  );
}
