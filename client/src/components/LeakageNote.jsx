import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../../ui-kit';

/**
 * LeakageNote — yellow callout that summarizes where one bottleneck
 * dollar lands: useful (own programs + grants to other charities)
 * vs absorbed by compensation/admin/fundraising.
 *
 * Two modes:
 *   1. Self-fetching:   <LeakageNote loopId="abc" />
 *   2. Pre-loaded data: <LeakageNote loop={loop} leakage={leakage} />
 */
export default function LeakageNote({ loopId, loop: loopProp, leakage: leakageProp }) {
  const { C } = useTheme();
  const [state, setState] = useState(() =>
    loopProp && leakageProp
      ? { status: 'ready', loop: loopProp, leakage: leakageProp }
      : { status: 'loading' }
  );

  useEffect(() => {
    if (loopProp && leakageProp) {
      setState({ status: 'ready', loop: loopProp, leakage: leakageProp });
      return;
    }
    if (!loopId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    api.loop(loopId)
      .then(d => {
        if (cancelled) return;
        setState({ status: 'ready', loop: d.loop, leakage: d.leakage });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ status: 'error', error: err });
      });
    return () => { cancelled = true; };
  }, [loopId, loopProp, leakageProp]);

  if (state.status === 'loading') {
    return <Shell C={C}><div className="h-12 animate-pulse opacity-50" /></Shell>;
  }
  if (state.status === 'error' || !state.leakage) return null;

  const { loop, leakage } = state;
  const pct = leakage.leakage_pct;
  if (pct == null) return null;

  const bottleneck = leakage.bottleneck_input_fmt ?? loop?.bottleneck_amt_fmt ?? '—';
  const useful     = leakage.useful_dollars_fmt ?? '—';
  const programs   = leakage.program_dollars_fmt ?? '—';
  const gifts      = leakage.gifts_dollars_fmt ?? '—';
  const leaked     = leakage.leaked_dollars_fmt ?? '—';

  return (
    <Shell C={C}>
      <div className="grid items-center gap-4" style={{ gridTemplateColumns: 'auto 1fr' }}>
        <div className="flex flex-col gap-1 pr-4 border-r" style={{ borderColor: `${C.warning}30` }}>
          <span
            className="text-[9px] font-bold uppercase font-mono"
            style={{ color: C.warning, letterSpacing: '.14em' }}
          >
            Loop Leakage
          </span>
          <span
            className="text-[28px] font-bold font-mono leading-none text-text"
            style={{ letterSpacing: '-.02em' }}
          >
            {pct}%
          </span>
        </div>

        <p className="text-[12px] leading-snug text-text2">
          Of the <Money C={C}>{bottleneck}</Money> bottleneck dollar circulating this loop,
          roughly <Money C={C}>{useful}</Money> reaches charitable purposes
          (<Money C={C}>{programs}</Money> own programs + <Money C={C}>{gifts}</Money> grants
          to other charities) — <Money C={C}>{leaked}</Money> is absorbed by compensation,
          admin, and fundraising.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ C, children }) {
  return (
    <div
      className="rounded-[10px] px-[18px] py-3.5 border"
      style={{
        background: C.isDark ? `${C.warning}10` : '#FEF6E0',
        borderColor: `${C.warning}40`,
        borderLeftWidth: 3,
        borderLeftColor: C.warning,
      }}
    >
      {children}
    </div>
  );
}

function Money({ C, children }) {
  return (
    <strong className="font-mono font-semibold" style={{ color: C.text }}>
      {children}
    </strong>
  );
}
