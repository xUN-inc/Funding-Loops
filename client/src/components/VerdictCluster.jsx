import { useState } from 'react';
import { RadarSignal, useTheme } from '../../ui-kit';
import { computeOrgProfiles } from '../lib/riskProfile';

/**
 * Forensic instrument: per-charity spending fingerprint overlay
 * sharing a frame with the three load-bearing KPIs. Each org gets
 * its own radar series across six dollar-flow axes — comparing
 * shapes shows who behaves like a shell vs who behaves like a
 * working charity.
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

  // Hide muted series by passing a transparent color (still in chart for axes)
  const renderSeries = series.map(s => muted.has(s.key)
    ? { ...s, color: 'rgba(0,0,0,0)' }
    : s
  );

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '11px 18px',
        background: C.surface2,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Spending Fingerprint</div>
          <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>
            Per-charity dollar flow · 0–100% · click legend to isolate
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, color: accent,
          textTransform: 'uppercase', letterSpacing: '.12em',
          fontFamily: 'var(--font-geist-mono), monospace',
          background: `${accent}15`, padding: '3px 7px', borderRadius: 4,
          border: `1px solid ${accent}38`,
        }}>
          {loop.worst_classification_label}
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
        gap: 0,
      }}>
        <div style={{
          padding: '14px 4px 6px',
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {data.length ? (
            <RadarSignal data={data} series={renderSeries} height={260} />
          ) : (
            <div style={{ color: C.text3, fontSize: 12, padding: 24, textAlign: 'center' }}>
              No spending data for this loop.
            </div>
          )}
          <OrgLegend series={series} muted={muted} onToggle={toggle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '0 14px 6px',
    }}>
      {series.map(s => {
        const isMuted = muted.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            title={s.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
              background: isMuted ? 'transparent' : `${s.color}10`,
              border: `1px solid ${isMuted ? C.border : `${s.color}40`}`,
              fontSize: 10, color: isMuted ? C.text3 : C.text2,
              fontFamily: 'var(--font-geist-mono), monospace',
              maxWidth: 220,
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: 2, flexShrink: 0,
              background: isMuted ? C.text3 : s.color,
              opacity: isMuted ? 0.4 : 1,
            }} />
            <span style={{
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{shorten(s.label, 24)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  const { C } = useTheme();
  return (
    <div style={{
      flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4,
      borderLeft: `2px solid ${accent}`,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color: C.text3,
        textTransform: 'uppercase', letterSpacing: '.12em',
        fontFamily: 'var(--font-geist-mono), monospace',
      }}>{label}</span>
      <span style={{
        fontSize: 22, fontWeight: 700, color: C.text,
        letterSpacing: '-.02em', lineHeight: 1.1,
        fontFamily: 'var(--font-geist-mono), monospace',
      }}>{value}</span>
      {sub ? (
        <span style={{ fontSize: 10, color: C.text3, fontFamily: 'var(--font-geist-mono), monospace' }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function Divider() {
  const { C } = useTheme();
  return <div style={{ height: 1, background: C.border }} />;
}

function shorten(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
