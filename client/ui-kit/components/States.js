import { useTheme } from '../theme';

export function LoadingState({ message = 'Loading…' }) {
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.text3 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 22, height: 22, border: `2px solid ${C.border}`, borderTopColor: C.primary,
          borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 13 }}>{message}</div>
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  const { C } = useTheme();
  return (
    <div style={{
      background: `${C.danger}10`, border: `1px solid ${C.danger}30`,
      borderRadius: 8, padding: 16, color: C.danger, fontSize: 13,
      fontFamily: 'var(--font-geist-mono), monospace',
    }}>{message}</div>
  );
}

export function EmptyState({ title = 'No results', subtitle }) {
  const { C } = useTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: 240, color: C.text3, textAlign: 'center', gap: 4,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12 }}>{subtitle}</div>}
    </div>
  );
}
