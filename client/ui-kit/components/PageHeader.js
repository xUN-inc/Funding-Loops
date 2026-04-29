import { useTheme } from '../theme';
import Badge from './Badge';

export default function PageHeader({ title, subtitle, accent, count, section }) {
  const { C } = useTheme();
  const a = accent ?? C.primary;
  return (
    <div className="mb-6 pb-[18px] border-b border-border">
      {section ? (
        <div
          className="text-[9px] font-bold uppercase font-mono mb-[7px]"
          style={{ color: a, letterSpacing: '.14em', opacity: 0.9 }}
        >
          {section}
        </div>
      ) : null}
      <div className="flex items-center gap-2.5 mb-1">
        <div
          className="w-1 h-[22px] rounded-sm shrink-0"
          style={{
            background: a,
            boxShadow: `0 0 8px ${a}55`,
          }}
        />
        <h1
          className="text-[21px] font-bold text-text m-0"
          style={{ letterSpacing: '-.02em', textWrap: 'balance' }}
        >
          {title}
        </h1>
        {count != null ? <Badge color="gray">{count}</Badge> : null}
      </div>
      {subtitle ? (
        <p className="text-[13px] text-text2 ml-3.5 mt-0 mb-0">{subtitle}</p>
      ) : null}
    </div>
  );
}
