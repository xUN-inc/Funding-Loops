import { useTheme } from '../theme';
import Badge from './Badge';

export default function PageHeader({ title, subtitle, accent, count, section }) {
  const { C } = useTheme();
  const a = accent ?? C.primary;
  return (
    <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: `1px solid ${C.border}` }}>
      {section && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: a,
          textTransform: 'uppercase', letterSpacing: '.14em',
          fontFamily: 'var(--font-geist-mono), monospace',
          marginBottom: 7, opacity: .9,
        }}>
          {section}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
        <div style={{
          width: 4, height: 22, borderRadius: 2, background: a, flexShrink: 0,
          boxShadow: `0 0 8px ${a}55`,
        }} />
        <h1 style={{
          fontSize: 21, fontWeight: 700, color: C.text,
          letterSpacing: '-.02em', margin: 0, textWrap: 'balance',
        }}>{title}</h1>
        {count != null && <Badge color="gray">{count}</Badge>}
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: C.text2, marginLeft: 14, marginTop: 0, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
