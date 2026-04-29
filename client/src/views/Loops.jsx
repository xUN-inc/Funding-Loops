import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SectionCard, Badge, SearchBar, filterRows,
  LoadingState, ErrorState, EmptyState, useTheme, Icons,
} from '../../ui-kit';
import { api } from '../lib/api';
import LoopDetail from './LoopDetail.jsx';
import SlideOver  from '../components/SlideOver.jsx';
import FetchSettings, { DEFAULT_FETCH_SETTINGS } from '../components/FetchSettings.jsx';

const SETTINGS_KEY = 'loops:fetch-settings:v1';

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_FETCH_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_FETCH_SETTINGS;
    return { ...DEFAULT_FETCH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FETCH_SETTINGS;
  }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

const VERDICT_TONE = {
  'RED FLAG':  'red',
  'SCRUTINY':  'yellow',
  'BENIGN':    'green',
};

const CLASS_TONE = {
  overhead_extraction: 'red',
  receipt_generation:  'red',
  revenue_inflation:   'yellow',
  structural:          'gray',
  low_risk:            'green',
};

function buildLoopParams(settings, { offset = 0, isInitial = true } = {}) {
  return {
    limit:           isInitial ? settings.initialFetchSize : settings.pageSize,
    offset,
    sort:            settings.sort,
    dir:             settings.dir,
    classifications: settings.classifications,
    minDirectors:    settings.minDirectors,
  };
}

export default function Loops() {
  const { C } = useTheme();
  const [settings, setSettings]       = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loops, setLoops]             = useState(null);
  const [pagination, setPagination]   = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [verdicts, setV]              = useState({});
  const [err, setErr]                 = useState(null);
  const [query, setQuery]             = useState('');
  const [selected, setSelected]       = useState(null);
  const [memo, setMemo]               = useState(null);
  const [memoErr, setMemoErr]         = useState(null);
  const [memoOpen, setMemoOpen]       = useState(false);

  const reload = useCallback((nextSettings) => {
    setLoops(null);
    setPagination(null);
    setErr(null);
    api.loops(buildLoopParams(nextSettings, { offset: 0, isInitial: true }))
      .then((res) => {
        setLoops(res.loops);
        setPagination(res.pagination);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => { reload(settings); }, [reload, settings]);

  const handleApplySettings = (next) => {
    setSettings(next);
    saveSettings(next);
    setSettingsOpen(false);
    setSelected(null);
  };

  const handleLoadMore = async () => {
    if (!pagination?.has_more || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.loops(
        buildLoopParams(settings, { offset: pagination.offset + pagination.limit, isInitial: false }),
      );
      setLoops((prev) => [...(prev ?? []), ...res.loops]);
      setPagination(res.pagination);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!selected) { setMemo(null); setMemoErr(null); setMemoOpen(false); return; }
    setMemo(null); setMemoErr(null);
    let cancelled = false;
    api.investigate(selected)
      .then(m => { if (!cancelled) setMemo(m); })
      .catch(e => { if (!cancelled) setMemoErr(e.message); });
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function tick() {
      try {
        const v = await api.verdicts();
        if (cancelled) return;
        const map = Object.fromEntries(v.verdicts.map(x => [x.id, x.verdict]));
        setV(map);
        const allDone = v.progress.total > 0 && v.progress.done >= v.progress.total;
        if (!allDone) timer = setTimeout(tick, 5000);
      } catch { /* ignore */ }
    }
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const filtered = useMemo(() => {
    if (!loops) return [];
    let rows = filterRows(loops, query, ['short_label', 'names']);
    if (settings.verdicts.length) {
      const allowed = new Set(settings.verdicts);
      rows = rows.filter((l) => {
        const v = verdicts[l.id];
        return v && allowed.has(v);
      });
    }
    return rows;
  }, [loops, query, settings.verdicts, verdicts]);

  if (err)  return <ErrorState message={err} />;
  if (!loops) return <LoadingState message="Loading loops…" />;

  const memoBadgeColor = memo ? VERDICT_TONE[memo.verdict] : 'gray';

  return (
    <div>
      <div className="mb-6 pb-[18px] border-b border-border">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div
              className="text-[9px] font-bold text-primary uppercase font-mono mb-[7px]"
              style={{ letterSpacing: '.14em', opacity: 0.9 }}
            >
              ANALYSIS
            </div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-1 h-[22px] rounded-sm shrink-0 bg-primary"
                style={{ boxShadow: `0 0 8px ${C.primary}55` }}
              />
              <h1
                className="text-[21px] font-bold text-text m-0"
                style={{ letterSpacing: '-.02em' }}
              >
                Funding Loops
              </h1>
              <Badge color="gray">{loops.length}</Badge>
            </div>
            <p className="text-[13px] text-text2 ml-3.5 mt-0 mb-0">
              Circular flows of CRA-registered charity money. Click a loop to inspect the network.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Fetch settings"
              title="Fetch settings"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg cursor-pointer text-[12px] font-bold font-mono uppercase tracking-wider bg-surface2 border border-border text-text2 hover:text-text hover:bg-hover-bg"
            >
              <span aria-hidden="true">{Icons.settings}</span>
              <span>Settings</span>
            </button>
            {selected ? (
              <button
                type="button"
                onClick={() => setMemoOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg cursor-pointer text-[12px] font-bold font-mono"
                style={{
                  background: `${C.purple}18`,
                  color: C.purple,
                  border: `1px solid ${C.purple}40`,
                  letterSpacing: '.02em',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${C.purple}28`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${C.purple}18`; }}
              >
                <span>AI MEMO</span>
                {memo ? (
                  <Badge color={memoBadgeColor}>{memo.verdict}</Badge>
                ) : memoErr ? (
                  <Badge color="red">ERR</Badge>
                ) : (
                  <span
                    className="w-2 h-2 rounded-full bg-warning"
                    style={{ animation: 'pulse-dot 1s ease-in-out infinite' }}
                  />
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="grid gap-[18px] items-start"
        style={{ gridTemplateColumns: '380px 1fr' }}
      >
        <div className="sticky top-[18px] flex max-h-[calc(100vh-36px)]">
          <LoopsPanel
            loops={filtered}
            total={loops.length}
            poolTotal={pagination?.total ?? loops.length}
            hasMore={!!pagination?.has_more}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            query={query}
            onQuery={setQuery}
            verdicts={verdicts}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div>
          {selected ? (
            <LoopDetail loopId={selected} />
          ) : (
            <SectionCard title="Loop Detail">
              <EmptyState title="Select a loop" subtitle="Pick one on the left to see network, leakage, memo." />
            </SectionCard>
          )}
        </div>
      </div>

      <SlideOver
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        title="Investigation Memo"
        subtitle={selected ? `Loop #${selected} · Gemini forensic review` : ''}
        accent={C.purple}
      >
        {memoErr ? (
          <ErrorState message={memoErr} />
        ) : !memo ? (
          <LoadingState message="Generating memo…" />
        ) : (
          <div>
            <div className="mb-3.5">
              <Badge color={memoBadgeColor}>VERDICT: {memo.verdict}</Badge>
            </div>
            <div
              className="text-[13px] text-text whitespace-pre-wrap"
              style={{ lineHeight: 1.65 }}
            >
              {memo.memo.replace(/\[VERDICT:[^\]]+\]/, '').trim()}
            </div>
          </div>
        )}
      </SlideOver>

      <FetchSettings
        open={settingsOpen}
        settings={settings}
        onApply={handleApplySettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function LoopsPanel({
  loops, total, poolTotal, hasMore, loadingMore, onLoadMore,
  query, onQuery, verdicts, selected, onSelect,
}) {
  return (
    <div className="bg-surface border border-border rounded-[10px] overflow-hidden flex flex-col self-stretch min-h-0">
      <div className="px-[18px] py-[11px] bg-surface2 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-text">Loops</div>
          <div className="text-[10px] text-text3 mt-px">
            {loops.length} of {total}
            {poolTotal > total ? <span className="text-text3"> · {poolTotal} available</span> : null}
          </div>
        </div>
      </div>
      <div className="p-3.5 flex flex-col gap-3 flex-1 min-h-0">
        <div className="shrink-0">
          <SearchBar
            value={query}
            onChange={onQuery}
            placeholder="Filter by org name…"
            total={total}
            matched={loops.length}
          />
        </div>
        {loops.length === 0 ? (
          <EmptyState title="No loops match" subtitle="Try a different search or adjust filters." />
        ) : (
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
            {loops.map(loop => (
              <LoopRow
                key={loop.id}
                loop={loop}
                verdict={verdicts[loop.id]}
                active={selected === loop.id}
                onClick={() => onSelect(loop.id)}
              />
            ))}
            {hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="mt-1.5 px-3 py-2 rounded-md text-[11px] font-bold font-mono uppercase tracking-wider bg-surface2 border border-border text-text2 hover:text-text hover:bg-hover-bg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function LoopRow({ loop, verdict, active, onClick }) {
  const { C } = useTheme();
  const cls = loop.worst_classification || 'low_risk';
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg p-2.5 cursor-pointer flex flex-col gap-1.5 transition-colors"
      style={{
        background: active ? `${C.primary}15` : C.surface2,
        border: `1px solid ${active ? C.primary : C.border}`,
      }}
    >
      <div className="flex justify-between gap-2 items-center">
        <span className="font-mono text-[13px] font-bold text-text">
          {loop.total_flow_fmt}
        </span>
        <div className="flex gap-1">
          {verdict ? <Badge color={VERDICT_TONE[verdict] ?? 'gray'}>{verdict}</Badge> : <Badge color="gray">…</Badge>}
        </div>
      </div>
      <div className="text-[12px] text-text2 leading-snug">
        {loop.short_label}
      </div>
      <div className="flex gap-1.5 text-[10px] text-text3 font-mono items-center">
        <span>{loop.hops} hops</span>
        <span>·</span>
        <span>{loop.min_year}–{loop.max_year}</span>
        <span>·</span>
        <Badge color={CLASS_TONE[cls] ?? 'gray'}>{loop.worst_classification_label}</Badge>
      </div>
    </button>
  );
}
