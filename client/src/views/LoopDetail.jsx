import { useEffect, useState } from 'react';
import {
  SectionCard, LoadingState, ErrorState, Th, Td, useTheme,
} from '../../ui-kit';
import NetworkCanvas   from '../components/NetworkCanvas.jsx';
import VerdictCluster  from '../components/VerdictCluster.jsx';
import LeakageNote     from '../components/LeakageNote.jsx';
import { api } from '../lib/api';

export default function LoopDetail({ loopId }) {
  const { C } = useTheme();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    setData(null); setErr(null);
    api.loop(loopId).then(setData).catch(e => setErr(e.message));
  }, [loopId]);

  if (err)   return <SectionCard title="Loop"><ErrorState message={err} /></SectionCard>;
  if (!data) return <SectionCard title="Loop"><LoadingState message="Loading loop…" /></SectionCard>;

  const { loop, nodes, edges, leakage, federal_grants, directors } = data;
  const graphEdges = edges.map(e => ({ source: e.source, target: e.target }));
  const hasGrants    = federal_grants?.has_grants;

  return (
    <div className="flex flex-col gap-[18px]">
      <IdentificationStrip loop={loop} nodes={nodes} />

      <LeakageNote loop={loop} leakage={leakage} />

      <VerdictCluster loop={loop} leakage={leakage} directors={directors} />

      <SectionCard
        title="Flow Network"
        subtitle="Drag nodes · radius scales with revenue · color = government dependency"
      >
        <NetworkCanvas nodes={nodes} edges={graphEdges} height={Math.min(520, 240 + nodes.length * 40)} />
      </SectionCard>

      <SectionCard
        title="Per-Hop Leakage Waterfall"
        subtitle={
          <>
            Modelling the <strong>{loop.bottleneck_amt_fmt}</strong> bottleneck dollar moving once around the cycle.
            At each hop, destination charity's most recent T3010 spending mix determines what survives.
          </>
        }
      >
        <WaterfallBars rows={leakage.waterfall} />
      </SectionCard>

      {hasGrants ? (
        <SectionCard
          title="Federal Grants Touching This Loop"
          subtitle={`${federal_grants.grants.length} agreements · ${federal_grants.dept_count} depts · total ${federal_grants.total_fmt}`}
          accent={C.warning}
        >
          <GrantsTable grants={federal_grants.grants} />
        </SectionCard>
      ) : null}
    </div>
  );
}

function IdentificationStrip({ loop }) {
  const cells = [
    { label: 'LOOP',  value: `#${loop.id}` },
    { label: 'HOPS',  value: String(loop.hops) },
    { label: 'YEARS', value: `${loop.min_year}–${loop.max_year}` },
    { label: 'TIER',  value: String(loop.tier ?? '—').toUpperCase() },
  ];
  return (
    <div className="flex items-stretch bg-surface border border-border rounded-lg overflow-hidden">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`px-4 py-2.5 flex flex-col gap-0.5 ${i < cells.length - 1 ? 'border-r border-border' : ''}`}
        >
          <span
            className="text-[9px] font-bold text-text3 font-mono"
            style={{ letterSpacing: '.14em' }}
          >
            {c.label}
          </span>
          <span
            className="text-[13px] font-bold text-text font-mono"
            style={{ letterSpacing: '-.01em' }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function WaterfallBars({ rows }) {
  const { C } = useTheme();

  const SEGMENTS = [
    { key: 'program_share',     label: 'Programs',              color: C.success },
    { key: 'gifts_share',       label: 'Gifts to other charities', color: C.cyan },
    { key: 'comp_share',        label: 'Compensation',          color: C.warning },
    { key: 'admin_share',       label: 'Admin',                 color: C.danger },
    { key: 'fundraising_share', label: 'Fundraising',           color: C.purple },
  ];

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-2">
        {rows.map((w) => {
          const designation = (w.designation || '—').toUpperCase();
          return (
            <div
              key={w.bn}
              className="grid items-center gap-3 py-1.5"
              style={{ gridTemplateColumns: '64px minmax(0, 220px) 1fr 88px' }}
            >
              <span
                className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider"
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  color: C.text2,
                  letterSpacing: '.08em',
                }}
                title={w.designation || 'No designation'}
              >
                {shorten(designation, 6)}
              </span>
              <span className="text-[12px] font-semibold text-text truncate" title={w.legal_name}>
                {shorten(w.legal_name, 38)}
              </span>
              <BarStack segments={SEGMENTS} row={w} noDataColor={C.text3} bg={C.surface2} />
              <span className="text-[12px] font-bold text-text font-mono text-right">
                {w.useful_amt_fmt}
              </span>
            </div>
          );
        })}
      </div>
      <Legend segments={SEGMENTS} noDataColor={C.text3} />
    </div>
  );
}

function BarStack({ segments, row, noDataColor, bg }) {
  if (!row.has_data) {
    return (
      <div
        className="h-[18px] rounded-sm overflow-hidden flex"
        style={{ background: bg, border: `1px solid ${noDataColor}30` }}
      >
        <div
          className="h-full w-full"
          style={{ background: `repeating-linear-gradient(45deg, ${noDataColor}30 0 6px, ${noDataColor}10 6px 12px)` }}
          title="No T3010 data"
        />
      </div>
    );
  }
  const total = segments.reduce((s, seg) => s + (Number(row[seg.key]) || 0), 0);
  return (
    <div
      className="h-[18px] rounded-sm overflow-hidden flex"
      style={{ background: bg }}
    >
      {segments.map((seg) => {
        const v = Number(row[seg.key]) || 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        if (pct <= 0) return null;
        return (
          <div
            key={seg.key}
            className="h-full"
            style={{ width: `${pct}%`, background: seg.color }}
            title={`${seg.label}: ${(v * 100).toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

function Legend({ segments, noDataColor }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-border">
      {segments.map((seg) => (
        <div key={seg.key} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: seg.color }}
          />
          <span className="text-[11px] text-text2">{seg.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{
            background: `repeating-linear-gradient(45deg, ${noDataColor}40 0 3px, ${noDataColor}15 3px 6px)`,
          }}
        />
        <span className="text-[11px] text-text2">No data</span>
      </div>
    </div>
  );
}

function GrantsTable({ grants }) {
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[280px]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Recipient</Th>
            <Th>Department</Th>
            <Th>Program</Th>
            <Th right>Value</Th>
          </tr>
        </thead>
        <tbody>
          {grants.slice(0, 25).map((g, i) => (
            <tr key={i}>
              <Td>{shorten(g.recipient_legal_name, 30)}</Td>
              <Td muted>{shorten(g.owner_org_title || '—', 28)}</Td>
              <Td muted>{shorten(g.prog_name_en || g.agreement_title_en || '—', 36)}</Td>
              <Td right mono>${(g.agreement_value || 0).toLocaleString()}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shorten(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
