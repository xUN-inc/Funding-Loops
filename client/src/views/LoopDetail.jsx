import { useEffect, useState } from 'react';
import {
  SectionCard, Badge, LoadingState, ErrorState, Th, Td, useTheme,
} from '../../ui-kit';
import NetworkCanvas   from '../components/NetworkCanvas.jsx';
import VerdictCluster  from '../components/VerdictCluster.jsx';
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
  const hasDirectors = directors?.length > 0;

  return (
    <div className="flex flex-col gap-[18px]">
      <IdentificationStrip loop={loop} nodes={nodes} />

      <VerdictCluster loop={loop} nodes={nodes} leakage={leakage} />

      <SectionCard
        title="Flow Network"
        subtitle="Drag nodes · radius scales with revenue · color = government dependency"
      >
        <NetworkCanvas nodes={nodes} edges={graphEdges} height={Math.min(520, 240 + nodes.length * 40)} />
      </SectionCard>

      <div
        className="grid gap-[18px] items-start"
        style={{
          gridTemplateColumns: hasDirectors ? 'minmax(0, 1.6fr) minmax(0, 1fr)' : '1fr',
        }}
      >
        <SectionCard
          title="Leakage Waterfall"
          subtitle="One bottleneck dollar moving once around the cycle"
        >
          <WaterfallTable rows={leakage.waterfall} />
        </SectionCard>

        {hasDirectors ? (
          <SectionCard
            title="Controlling Directors"
            subtitle="Individuals seated on 2+ boards inside this cycle"
            accent={C.danger}
          >
            <DirectorList directors={directors} />
          </SectionCard>
        ) : null}
      </div>

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

function WaterfallTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Org</Th>
            <Th right>In</Th>
            <Th right>Programs</Th>
            <Th right>Gifts</Th>
            <Th right>Comp</Th>
            <Th right>Admin</Th>
            <Th right>Fundraise</Th>
            <Th right>Useful</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.bn}>
              <Td>{shorten(w.legal_name, 32)}</Td>
              <Td right mono>{w.in_amt_fmt}</Td>
              <Td right mono>{w.program_amt_fmt}</Td>
              <Td right mono>{w.gifts_amt_fmt}</Td>
              <Td right mono muted>{w.comp_amt_fmt}</Td>
              <Td right mono muted>{w.admin_amt_fmt}</Td>
              <Td right mono muted>{w.fundraising_amt_fmt}</Td>
              <Td right mono>{w.useful_amt_fmt}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectorList({ directors }) {
  return (
    <div className="flex flex-col gap-2">
      {directors.map(d => (
        <div
          key={d.director_name}
          className="flex items-center justify-between p-2.5 bg-surface2 border border-border rounded-md gap-2.5"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-text truncate">
              {d.director_name}
            </div>
            <div
              className="text-[10px] text-text3 mt-0.5 overflow-hidden"
              style={{
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {d.charity_names.join(' · ')}
            </div>
          </div>
          <Badge color="red">{d.boards_in_cycle} boards</Badge>
        </div>
      ))}
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
