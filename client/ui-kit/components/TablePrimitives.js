import { useTheme } from '../theme';

export function Th({ children, right }) {
  const { C } = useTheme();
  return (
    <th style={{
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      fontSize: 10, fontWeight: 700, color: C.text3,
      textTransform: 'uppercase', letterSpacing: '.07em',
      borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
      background: C.surface2,
    }}>{children}</th>
  );
}

export function Td({ children, right, mono, muted }) {
  const { C } = useTheme();
  return (
    <td style={{
      padding: '10px 12px', textAlign: right ? 'right' : 'left',
      color: muted ? C.text2 : C.text,
      fontFamily: mono ? 'var(--font-geist-mono), monospace' : undefined,
      fontSize: mono ? 12 : 13,
      borderBottom: `1px solid ${C.border}`,
    }}>{children}</td>
  );
}
