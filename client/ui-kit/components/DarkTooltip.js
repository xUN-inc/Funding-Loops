import { useTheme } from '../theme';

// Recharts-compatible tooltip component.
export default function DarkTooltip({ active, payload, label, fmtValue }) {
  const { C } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-tooltip-bg rounded-lg px-3 py-2 pointer-events-none"
      style={{
        border: `1px solid ${C.borderLight}`,
        boxShadow: C.shadow,
      }}
    >
      {label ? (
        <p className="text-text2 text-[11px] mb-1 mt-0">{label}</p>
      ) : null}
      {payload.map((p, i) => (
        <p
          key={i}
          className="text-[13px] font-semibold my-0.5"
          style={{ color: p.color ?? C.text }}
        >
          {fmtValue ? fmtValue(p.value, p.name, p) : `${p.name}: ${p.value}`}
        </p>
      ))}
    </div>
  );
}
