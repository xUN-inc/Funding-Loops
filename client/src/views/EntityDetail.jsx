import { useEffect, useState } from 'react';
import {
  SectionCard, StatCard, Badge, LoadingState, ErrorState,
  Th, Td, useTheme,
} from '../../ui-kit';
import { api } from '../lib/api';

export default function EntityDetail({ name }) {
  const { C } = useTheme();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    setData(null); setErr(null);
    api.recipient(name).then(setData).catch(e => setErr(e.message));
  }, [name]);

  if (err)   return <SectionCard title="Recipient"><ErrorState message={err} /></SectionCard>;
  if (!data) return <SectionCard title="Recipient"><LoadingState message="Loading recipient…" /></SectionCard>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title={data.display_name}
        subtitle={[data.city, data.province].filter(Boolean).join(', ') || 'Location unknown'}
        accent={C.cyan}
      >
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Federal"  value={data.totals.federal_fmt} accent={C.primary} />
          <StatCard label="Alberta"  value={data.totals.alberta_fmt} accent={C.warning} />
          <StatCard label="Total"    value={data.totals.grand_total_fmt} accent={C.cyan} />
        </div>
        {data.recipient_type ? (
          <div className="mt-3">
            <Badge color="gray">{data.recipient_type}</Badge>
          </div>
        ) : null}
      </SectionCard>

      {data.federal.grant_count > 0 ? (
        <SectionCard
          title="Federal Grants"
          subtitle={`${data.federal.grant_count} agreements · ${data.federal.dept_count} departments`}
        >
          <div className="overflow-x-auto overflow-y-auto max-h-[320px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Department</Th>
                  <Th>Program</Th>
                  <Th>Title</Th>
                  <Th right>Value</Th>
                </tr>
              </thead>
              <tbody>
                {data.federal.grants.map((g, i) => (
                  <tr key={i}>
                    <Td muted>{shorten(g.owner_org_title || '—', 28)}</Td>
                    <Td muted>{shorten(g.prog_name_en || '—', 28)}</Td>
                    <Td>{shorten(g.agreement_title_en || '—', 36)}</Td>
                    <Td right mono>{g.agreement_value_fmt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {data.alberta.available && (data.alberta.contracts.length || data.alberta.sole_source.length || data.alberta.grants.length) ? (
        <SectionCard
          title="Alberta"
          subtitle={`Contracts ${data.alberta.contract_total_fmt} · Sole-source ${data.alberta.sole_source_total_fmt} · Grants ${data.alberta.grant_total_fmt}`}
          accent={C.warning}
        >
          <div className="flex flex-col gap-3.5">
            {data.alberta.contracts.length ? (
              <SubTable title="Contracts" rows={data.alberta.contracts}
                cols={[
                  { label: 'Year',     get: r => r.fiscal_year },
                  { label: 'Ministry', get: r => r.ministry, muted: true },
                  { label: 'Amount',   get: r => r.amount_fmt, right: true, mono: true },
                ]} />
            ) : null}
            {data.alberta.sole_source.length ? (
              <SubTable title="Sole-source" rows={data.alberta.sole_source}
                cols={[
                  { label: 'Ministry',    get: r => r.ministry, muted: true },
                  { label: 'Description', get: r => shorten(r.contract_description, 50) },
                  { label: 'Value',       get: r => r.contract_value_fmt, right: true, mono: true },
                ]} />
            ) : null}
            {data.alberta.grants.length ? (
              <SubTable title="Grants" rows={data.alberta.grants}
                cols={[
                  { label: 'Year',     get: r => r.fiscal_year },
                  { label: 'Ministry', get: r => r.ministry, muted: true },
                  { label: 'Program',  get: r => r.program },
                  { label: 'Amount',   get: r => r.amount_fmt, right: true, mono: true },
                ]} />
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function SubTable({ title, rows, cols }) {
  return (
    <div>
      <div
        className="text-[10px] font-bold text-text3 uppercase font-mono mb-1.5"
        style={{ letterSpacing: '.1em' }}
      >
        {title}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>{cols.map(c => <Th key={c.label} right={c.right}>{c.label}</Th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(c => (
                <Td key={c.label} right={c.right} mono={c.mono} muted={c.muted}>{c.get(r)}</Td>
              ))}
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
