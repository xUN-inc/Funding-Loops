import { useTheme } from '../../ui-kit';

/**
 * Loop snapshot — controlling directors paired with the three KPIs
 * (total flow / leakage / hop span) so the human signal sits beside the money signal.
 */
export default function VerdictCluster({ loop, leakage, directors = [] }) {
  const { C } = useTheme();

  const sev = loop.worst_classification;
  const accent =
    sev === 'overhead_extraction' || sev === 'receipt_generation' ? C.danger :
    sev === 'revenue_inflation'                                   ? C.warning :
    sev === 'low_risk'                                            ? C.success :
                                                                    C.text2;

  const cols = 'minmax(0, 1.1fr) minmax(0, 1fr)';

  return (
    <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
      <div
        className="grid bg-surface2 border-b border-border"
        style={{ gridTemplateColumns: cols }}
      >
        <div className="px-[18px] py-[11px] flex items-center gap-2.5 border-r border-border">
          <div
            className="w-[3px] h-[14px] rounded-sm shrink-0"
            style={{ background: accent }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-text">Loop Snapshot</div>
            <div className="text-[10px] text-text3 mt-px">
              Bottleneck flow · leakage · hop span
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
        <div className="px-[18px] py-[11px] flex items-center gap-2.5">
          <div
            className="w-[3px] h-[14px] rounded-sm shrink-0"
            style={{ background: C.danger }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-text">Controlling Directors</div>
            <div className="text-[10px] text-text3 mt-px">
              Individuals seated on 2+ boards in this cycle
            </div>
          </div>
          <span
            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: directors.length ? C.danger : C.text3,
              background: directors.length ? `${C.danger}1A` : 'transparent',
              border: `1px solid ${directors.length ? `${C.danger}38` : C.border}`,
            }}
          >
            {directors.length}
          </span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div className="flex flex-col border-r border-border">
          <MetricBand
            label="Total Flow"
            value={loop.total_flow_fmt}
            sub={`bottleneck ${loop.bottleneck_amt_fmt}`}
            accent={C.primary}
          />
          <div className="h-px bg-border" />
          <MetricBand
            label="Leakage"
            value={leakage.leakage_pct != null ? `${leakage.leakage_pct}%` : '—'}
            sub={`coverage ${(leakage.data_coverage * 100).toFixed(0)}% · useful ${leakage.useful_dollars_fmt}`}
            accent={leakage.leakage_pct > 60 ? C.danger : leakage.leakage_pct > 30 ? C.warning : C.success}
          />
          <div className="h-px bg-border" />
          <MetricBand
            label="Span"
            value={`${loop.hops} hops`}
            sub={`${loop.min_year}–${loop.max_year}`}
            accent={C.cyan}
          />
        </div>

        <div className="p-3.5 flex flex-col">
          {directors.length ? (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[340px] pr-1">
              {directors.map(d => <DirectorRow key={d.director_name} director={d} />)}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text3 text-[12px] text-center px-4">
              No directors sit on multiple boards in this loop.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBand({ label, value, sub, accent }) {
  return (
    <div
      className="flex items-center gap-4 px-[18px] py-3.5 flex-1"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="w-[110px] shrink-0">
        <span
          className="text-[9px] font-bold text-text3 uppercase font-mono"
          style={{ letterSpacing: '.12em' }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-[22px] font-bold text-text font-mono leading-tight"
          style={{ letterSpacing: '-.02em' }}
        >
          {value}
        </span>
        {sub ? (
          <span className="text-[10px] text-text3 font-mono truncate">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

function DirectorRow({ director }) {
  const { C } = useTheme();
  const initials = director.director_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-md"
      style={{
        background: `${C.danger}0C`,
        border: `1px solid ${C.danger}28`,
      }}
    >
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold font-mono shrink-0"
        style={{
          background: `${C.danger}1F`,
          color: C.danger,
          border: `1px solid ${C.danger}40`,
        }}
        aria-hidden="true"
      >
        {initials || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-text truncate">
          {director.director_name}
        </div>
        <div className="text-[10px] text-text3 truncate" title={director.charity_names?.join(' · ')}>
          {director.charity_names?.join(' · ')}
        </div>
      </div>
      <span
        className="text-[10px] font-bold font-mono shrink-0 px-1.5 py-0.5 rounded"
        style={{
          color: C.danger,
          background: `${C.danger}1A`,
          border: `1px solid ${C.danger}38`,
        }}
      >
        {director.boards_in_cycle}×
      </span>
    </div>
  );
}


