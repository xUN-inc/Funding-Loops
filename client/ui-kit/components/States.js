import { useTheme } from '../theme';

export function LoadingState({ message = 'Loading…' }) {
  const { C } = useTheme();
  return (
    <div className="flex items-center justify-center h-[300px] text-text3">
      <div className="text-center">
        <div
          className="w-[22px] h-[22px] rounded-full mx-auto mb-3"
          style={{
            border: `2px solid ${C.border}`,
            borderTopColor: C.primary,
            animation: 'spin .8s linear infinite',
          }}
        />
        <div className="text-[13px]">{message}</div>
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  const { C } = useTheme();
  return (
    <div
      className="rounded-lg p-4 text-[13px] font-mono"
      style={{
        background: `${C.danger}10`,
        border: `1px solid ${C.danger}30`,
        color: C.danger,
      }}
    >
      {message}
    </div>
  );
}

export function EmptyState({ title = 'No results', subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center h-60 text-text3 text-center gap-1">
      <div className="text-[14px] font-semibold text-text2">{title}</div>
      {subtitle ? <div className="text-[12px]">{subtitle}</div> : null}
    </div>
  );
}
