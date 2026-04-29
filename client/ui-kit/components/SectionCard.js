import { useTheme } from '../theme';

export default function SectionCard({ title, subtitle, children, style: extraStyle, accent }) {
  const { C } = useTheme();
  const hasHeader = title || subtitle;
  return (
    <div
      className="bg-surface border border-border rounded-[10px] overflow-hidden"
      style={{
        boxShadow: C.isDark ? 'none' : '0 1px 0 rgba(0,0,0,.02)',
        ...extraStyle,
      }}
    >
      {hasHeader ? (
        <div className="px-[18px] py-[11px] bg-surface2 border-b border-border flex items-center gap-2">
          {accent ? (
            <div
              className="w-[3px] h-[14px] rounded-sm shrink-0"
              style={{ background: accent }}
            />
          ) : null}
          <div>
            {title ? <div className="text-[12px] font-semibold text-text">{title}</div> : null}
            {subtitle ? <div className="text-[10px] text-text3 mt-px">{subtitle}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="p-[18px]">{children}</div>
    </div>
  );
}
