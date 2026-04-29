import { useEffect, useMemo, useState } from 'react';
import {
  PageHeader, SectionCard, StatCard, Badge, SearchBar, filterRows,
  LoadingState, ErrorState, EmptyState, useTheme,
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

      <div className="grid grid-cols-3 gap-3.5 mb-[22px]">
        <StatCard label="Total Funding" value={data.stats.total_funding_fmt} accent={C.cyan} />
        <StatCard label="Recipients"    value={String(data.stats.recipient_count)} />
        <StatCard label="Alberta Data"  value={data.stats.ab_available ? 'ON' : 'OFF'} accent={data.stats.ab_available ? C.success : C.text3} />
      </div>

      <div
        className="grid gap-[18px] items-start"
        style={{ gridTemplateColumns: '420px 1fr' }}
      >
        <SectionCard title="Recipients" subtitle={`${filtered.length} of ${data.recipients.length}`}>
          <div className="mb-3">
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
            <div className="flex flex-col gap-1.5 max-h-[620px] overflow-y-auto">
              {filtered.map(r => {
                const isSelected = selected === r.norm_name;
                return (
                  <button
                    key={r.norm_name}
                    type="button"
                    onClick={() => setSelected(r.norm_name)}
                    className="text-left rounded-lg p-2.5 cursor-pointer flex flex-col gap-1.5"
                    style={{
                      background: isSelected ? `${C.cyan}15` : C.surface2,
                      border: `1px solid ${isSelected ? C.cyan : C.border}`,
                    }}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-text">
                        {r.total_fmt}
                      </span>
                      <div className="flex gap-1">
                        {r.sources.map(s => <Badge key={s} color={s === 'Federal' ? 'blue' : 'yellow'}>{s}</Badge>)}
                      </div>
                    </div>
                    <div className="text-[12px] text-text2 leading-snug">
                      {r.display_name}
                    </div>
                    <div className="text-[10px] text-text3 font-mono">
                      {r.fed_grant_count} fed grants · {r.fed_dept_count} depts
                    </div>
                  </button>
                );
              })}
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
