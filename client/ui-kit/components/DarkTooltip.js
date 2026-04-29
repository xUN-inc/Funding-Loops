import { useTheme } from '../theme';

// Recharts-compatible tooltip component.
export default function DarkTooltip({ active, payload, label, fmtValue }) {
  const { C } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.tooltipBg, border: `1px solid ${C.borderLight}`,
      borderRadius: 8, padding: '8px 12px',
      boxShadow: C.shadow,
      pointerEvents: 'none',
    }}>
      {label && <p style={{ color: C.text2, fontSize: 11, marginBottom: 4, marginTop: 0 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? C.text, fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
          {fmtValue ? fmtValue(p.value, p.name, p) : `${p.name}: ${p.value}`}
        </p>
      ))}
    </div>
  );
}
