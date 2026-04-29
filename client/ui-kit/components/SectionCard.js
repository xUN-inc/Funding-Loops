import { useTheme } from '../theme';

export default function SectionCard({ title, subtitle, children, style: extraStyle, accent }) {
  const { C } = useTheme();
  const hasHeader = title || subtitle;
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: C.isDark ? 'none' : '0 1px 0 rgba(0,0,0,.02)',
      ...extraStyle,
    }}>
      {hasHeader && (
        <div style={{
          padding: '11px 18px',
          background: C.surface2,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {accent && (
            <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
          )}
          <div>
            {title && <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
      )}
      <div style={{ padding: 18 }}>
        {children}
      </div>
    </div>
  );
}
