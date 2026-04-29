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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Identification strip — terse, mono, low-volume */}
      <IdentificationStrip loop={loop} nodes={nodes} />

      {/* Verdict cluster — radar + KPIs in one frame */}
      <VerdictCluster loop={loop} nodes={nodes} leakage={leakage} />

      {/* Network — full width, prime real estate. This is where investigation happens. */}
      <SectionCard
        title="Flow Network"
        subtitle="Drag nodes · radius scales with revenue · color = government dependency"
      >
        <NetworkCanvas nodes={nodes} edges={graphEdges} height={Math.min(520, 240 + nodes.length * 40)} />
      </SectionCard>

      {/* Evidence row: leakage waterfall + directors side-by-side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasDirectors ? 'minmax(0, 1.6fr) minmax(0, 1fr)' : '1fr',
        gap: 18, alignItems: 'start',
      }}>
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

      {/* Federal grants — only when present, low-priority placement */}
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
  const { C } = useTheme();
  const cells = [
    { label: 'LOOP',  value: `#${loop.id}` },
    { label: 'HOPS',  value: String(loop.hops) },
    { label: 'YEARS', value: `${loop.min_year}–${loop.max_year}` },
    { label: 'TIER',  value: String(loop.tier ?? '—').toUpperCase() },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {cells.map((c, i) => (
        <div key={c.label} style={{
          padding: '10px 16px',
          borderRight: i < cells.length - 1 ? `1px solid ${C.border}` : 'none',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: C.text3,
            letterSpacing: '.14em',
            fontFamily: 'var(--font-geist-mono), monospace',
          }}>{c.label}</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.text,
            fontFamily: 'var(--font-geist-mono), monospace',
            letterSpacing: '-.01em',
          }}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

function WaterfallTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
  const { C } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {directors.map(d => (
        <div key={d.director_name} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: C.surface2, borderRadius: 6,
          border: `1px solid ${C.border}`, gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: C.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{d.director_name}</div>
            <div style={{
              fontSize: 10, color: C.text3, marginTop: 2, lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
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
    <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
