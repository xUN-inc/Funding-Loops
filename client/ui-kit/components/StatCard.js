import { useTheme } from '../theme';

export default function StatCard({ label, value, sub, accent, icon }) {
  const { C } = useTheme();
  const a = accent ?? C.primary;
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 18px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: C.isDark ? 'none' : '0 1px 0 rgba(0,0,0,.02)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: a,
        boxShadow: `0 0 12px ${a}55`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: C.text3,
          textTransform: 'uppercase', letterSpacing: '.12em',
          fontFamily: 'var(--font-geist-mono), monospace',
        }}>
          {label}
        </span>
        {icon && (
          <div style={{
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            background: `${a}18`,
            border: `1px solid ${a}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: a,
          }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: C.text,
        letterSpacing: '-.02em', lineHeight: 1,
        fontFamily: 'var(--font-geist-mono), monospace',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: C.text3, marginTop: 6, letterSpacing: '.01em' }}>{sub}</div>}
    </div>
  );
}
