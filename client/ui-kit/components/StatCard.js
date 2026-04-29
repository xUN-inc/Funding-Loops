import { useTheme } from '../theme';

export default function StatCard({ label, value, sub, accent, icon }) {
  const { C } = useTheme();
  const a = accent ?? C.primary;
  return (
    <div
      className="bg-surface border border-border rounded-[10px] px-[18px] py-3.5 relative overflow-hidden"
      style={{ boxShadow: C.isDark ? 'none' : '0 1px 0 rgba(0,0,0,.02)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: a,
          boxShadow: `0 0 12px ${a}55`,
        }}
      />
      <div className="flex justify-between items-start mb-3">
        <span
          className="text-[9px] font-bold text-text3 uppercase font-mono"
          style={{ letterSpacing: '.12em' }}
        >
          {label}
        </span>
        {icon ? (
          <div
            className="w-[26px] h-[26px] rounded-md shrink-0 flex items-center justify-center"
            style={{
              background: `${a}18`,
              border: `1px solid ${a}28`,
              color: a,
            }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        className="text-[28px] font-bold text-text leading-none font-mono"
        style={{ letterSpacing: '-.02em' }}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] text-text3 mt-1.5 tracking-tight">{sub}</div>
      ) : null}
    </div>
  );
}
