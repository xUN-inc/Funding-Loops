import { useEffect, useMemo, useState } from 'react';
import {
  PageHeader, SectionCard, StatCard, Badge, SearchBar, filterRows,
  LoadingState, ErrorState, EmptyState, Th, Td, useTheme,
} from '../../ui-kit';
import { api } from '../lib/api';
import EntityDetail from './EntityDetail.jsx';

export default function Entities() {
  const { C } = useTheme();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.topRecipients().then(setData).catch(e => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterRows(data.recipients, query, ['display_name', 'recipient_type']);
  }, [data, query]);

  if (err)   return <ErrorState message={err} />;
  if (!data) return <LoadingState message="Loading recipients…" />;

  return (
    <div>
      <PageHeader
        section="PUBLIC FUNDS"
        title="Top Recipients"
        subtitle="Non-charity entities receiving federal + Alberta public funds."
        count={data.recipients.length}
        accent={C.cyan}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Total Funding" value={data.stats.total_funding_fmt} accent={C.cyan} />
        <StatCard label="Recipients"    value={String(data.stats.recipient_count)} />
        <StatCard label="Alberta Data"  value={data.stats.ab_available ? 'ON' : 'OFF'} accent={data.stats.ab_available ? C.success : C.text3} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, alignItems: 'start' }}>
        <SectionCard title="Recipients" subtitle={`${filtered.length} of ${data.recipients.length}`}>
          <div style={{ marginBottom: 12 }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Filter recipients…"
              total={data.recipients.length}
              matched={filtered.length}
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No recipients match" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 620, overflowY: 'auto' }}>
              {filtered.map(r => (
                <button
                  key={r.norm_name}
                  type="button"
                  onClick={() => setSelected(r.norm_name)}
                  style={{
                    textAlign: 'left',
                    background: selected === r.norm_name ? `${C.cyan}15` : C.surface2,
                    border: `1px solid ${selected === r.norm_name ? C.cyan : C.border}`,
                    borderRadius: 8, padding: 10, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono), monospace',
                      fontSize: 13, fontWeight: 700, color: C.text,
                    }}>
                      {r.total_fmt}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.sources.map(s => <Badge key={s} color={s === 'Federal' ? 'blue' : 'yellow'}>{s}</Badge>)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.35 }}>
                    {r.display_name}
                  </div>
                  <div style={{ fontSize: 10, color: C.text3, fontFamily: 'var(--font-geist-mono), monospace' }}>
                    {r.fed_grant_count} fed grants · {r.fed_dept_count} depts
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <div>
          {selected ? (
            <EntityDetail name={selected} />
          ) : (
            <SectionCard title="Recipient Detail">
              <EmptyState title="Select a recipient" subtitle="Pick one on the left." />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
