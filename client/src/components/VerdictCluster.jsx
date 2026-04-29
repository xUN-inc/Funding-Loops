import { useState } from 'react';
import { RadarSignal, useTheme } from '../../ui-kit';
import { computeOrgProfiles } from '../lib/riskProfile';

/**
 * Forensic instrument: per-charity spending fingerprint overlay
 * sharing a frame with the three load-bearing KPIs.
 */
export default function VerdictCluster({ loop, nodes, leakage }) {
  const { C } = useTheme();
  const { data, series } = computeOrgProfiles({ nodes, leakage });
  const [muted, setMuted] = useState(() => new Set());

  const sev = loop.worst_classification;
  const accent =
    sev === 'overhead_extraction' || sev === 'receipt_generation' ? C.danger :
    sev === 'revenue_inflation'                                   ? C.warning :
    sev === 'low_risk'                                            ? C.success :
                                                                    C.text2;

  const toggle = (key) => setMuted(curr => {
    const next = new Set(curr);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const renderSeries = series.map(s => muted.has(s.key)
    ? { ...s, color: 'rgba(0,0,0,0)' }
    : s
  );

  return (
    <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
      <div className="px-[18px] py-[11px] bg-surface2 border-b border-border flex items-center gap-2.5">
        <div
          className="w-[3px] h-[14px] rounded-sm shrink-0"
          style={{ background: accent }}
        />
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-text">Spending Fingerprint</div>
          <div className="text-[10px] text-text3 mt-px">
            Per-charity dollar flow · 0–100% · click legend to isolate
          </div>
        </div>
        <span
          className="text-[9px] font-bold uppercase font-mono px-[7px] py-[3px] rounded"
          style={{
            color: accent,
            letterSpacing: '.12em',
            background: `${accent}15`,
            border: `1px solid ${accent}38`,
          }}
        >
          {loop.worst_classification_label}
        </span>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)' }}
      >
        <div className="pt-3.5 pb-1.5 px-1 border-r border-border flex flex-col gap-2">
          {data.length ? (
            <RadarSignal data={data} series={renderSeries} height={260} />
          ) : (
            <div className="text-text3 text-[12px] p-6 text-center">
              No spending data for this loop.
            </div>
          )}
          <OrgLegend series={series} muted={muted} onToggle={toggle} />
        </div>

        <div className="flex flex-col">
          <Metric
            label="Total Flow"
            value={loop.total_flow_fmt}
            sub={`bottleneck ${loop.bottleneck_amt_fmt}`}
            accent={C.primary}
          />
          <Divider />
          <Metric
            label="Leakage"
            value={leakage.leakage_pct != null ? `${leakage.leakage_pct}%` : '—'}
            sub={`coverage ${(leakage.data_coverage * 100).toFixed(0)}% · useful ${leakage.useful_dollars_fmt}`}
            accent={leakage.leakage_pct > 60 ? C.danger : leakage.leakage_pct > 30 ? C.warning : C.success}
          />
          <Divider />
          <Metric
            label="Span"
            value={`${loop.hops} hops`}
            sub={`${loop.min_year}–${loop.max_year}`}
            accent={C.cyan}
          />
        </div>
      </div>
    </div>
  );
}

function OrgLegend({ series, muted, onToggle }) {
  const { C } = useTheme();
  return (
    <div className="flex flex-wrap gap-1.5 px-3.5 pb-1.5">
      {series.map(s => {
        const isMuted = muted.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            title={s.label}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] font-mono max-w-[220px]"
            style={{
              background: isMuted ? 'transparent' : `${s.color}10`,
              border: `1px solid ${isMuted ? C.border : `${s.color}40`}`,
              color: isMuted ? C.text3 : C.text2,
            }}
          >
            <span
              className="w-[7px] h-[7px] rounded-sm shrink-0"
              style={{
                background: isMuted ? C.text3 : s.color,
                opacity: isMuted ? 0.4 : 1,
              }}
            />
            <span className="truncate">{shorten(s.label, 24)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  return (
    <div
      className="flex-1 px-[18px] py-3.5 flex flex-col gap-1"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <span
        className="text-[9px] font-bold text-text3 uppercase font-mono"
        style={{ letterSpacing: '.12em' }}
      >
        {label}
      </span>
      <span
        className="text-[22px] font-bold text-text font-mono leading-tight"
        style={{ letterSpacing: '-.02em' }}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-[10px] text-text3 font-mono">{sub}</span>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border" />;
}

function shorten(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
