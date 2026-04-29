import { useEffect, useMemo, useState } from 'react';
import {
  SectionCard, Badge, SearchBar, filterRows,
  LoadingState, ErrorState, EmptyState, useTheme,
} from '../../ui-kit';
import { api } from '../lib/api';
import LoopDetail from './LoopDetail.jsx';
import SlideOver  from '../components/SlideOver.jsx';

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

export default function Loops() {
  const { C } = useTheme();
  const [data, setData]   = useState(null);
  const [verdicts, setV]  = useState({});
  const [err, setErr]     = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [memo, setMemo] = useState(null);
  const [memoErr, setMemoErr] = useState(null);
  const [memoOpen, setMemoOpen] = useState(false);

  useEffect(() => {
    api.loops().then(setData).catch(e => setErr(e.message));
  }, []);

  // Fetch memo whenever a new loop is selected. Pre-load so it's ready instantly.
  useEffect(() => {
    if (!selected) { setMemo(null); setMemoErr(null); setMemoOpen(false); return; }
    setMemo(null); setMemoErr(null);
    let cancelled = false;
    api.investigate(selected)
      .then(m => { if (!cancelled) setMemo(m); })
      .catch(e => { if (!cancelled) setMemoErr(e.message); });
    return () => { cancelled = true; };
  }, [selected]);

  // Poll verdicts every 5s until all filled in.
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
    if (!data) return [];
    return filterRows(data.loops, query, ['short_label', 'names']);
  }, [data, query]);

  if (err)  return <ErrorState message={err} />;
  if (!data) return <LoadingState message="Loading loops…" />;

  const memoBadgeColor = memo ? VERDICT_TONE[memo.verdict] : 'gray';

  return (
    <div>
      <div style={{
        marginBottom: 24, paddingBottom: 18,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: C.primary,
              textTransform: 'uppercase', letterSpacing: '.14em',
              fontFamily: 'var(--font-geist-mono), monospace',
              marginBottom: 7, opacity: .9,
            }}>ANALYSIS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <div style={{
                width: 4, height: 22, borderRadius: 2, background: C.primary, flexShrink: 0,
                boxShadow: `0 0 8px ${C.primary}55`,
              }} />
              <h1 style={{
                fontSize: 21, fontWeight: 700, color: C.text,
                letterSpacing: '-.02em', margin: 0,
              }}>Funding Loops</h1>
              <Badge color="gray">{data.loops.length}</Badge>
            </div>
            <p style={{ fontSize: 13, color: C.text2, marginLeft: 14, marginTop: 0, marginBottom: 0 }}>
              Circular flows of CRA-registered charity money. Click a loop to inspect the network.
            </p>
          </div>
          {selected ? (
            <button
              type="button"
              onClick={() => setMemoOpen(true)}
              style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                background: `${C.purple}18`, color: C.purple,
                border: `1px solid ${C.purple}40`,
                fontSize: 12, fontWeight: 700, letterSpacing: '.02em',
                fontFamily: 'var(--font-geist-mono), monospace',
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
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: C.warning,
                  animation: 'pulse-dot 1s ease-in-out infinite',
                }} />
              )}
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 18, maxHeight: 'calc(100vh - 36px)', display: 'flex' }}>
          <LoopsPanel
            C={C}
            loops={filtered}
            total={data.loops.length}
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
            <div style={{ marginBottom: 14 }}>
              <Badge color={memoBadgeColor}>VERDICT: {memo.verdict}</Badge>
            </div>
            <div style={{
              fontSize: 13, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap',
            }}>
              {memo.memo.replace(/\[VERDICT:[^\]]+\]/, '').trim()}
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function LoopsPanel({ C, loops, total, query, onQuery, verdicts, selected, onSelect }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      alignSelf: 'stretch', minHeight: 0,
    }}>
      <div style={{
        padding: '11px 18px',
        background: C.surface2,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Loops</div>
          <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>
            {loops.length} of {total}
          </div>
        </div>
      </div>
      <div style={{
        padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
        flex: 1, minHeight: 0,
      }}>
        <div style={{ flexShrink: 0 }}>
          <SearchBar
            value={query}
            onChange={onQuery}
            placeholder="Filter by org name…"
            total={total}
            matched={loops.length}
          />
        </div>
        {loops.length === 0 ? (
          <EmptyState title="No loops match" subtitle="Try a different search." />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            flex: 1, minHeight: 0, overflowY: 'auto',
            paddingRight: 4,
          }}>
            {loops.map(loop => (
              <LoopRow
                key={loop.id}
                loop={loop}
                verdict={verdicts[loop.id]}
                active={selected === loop.id}
                onClick={() => onSelect(loop.id)}
              />
            ))}
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
      style={{
        textAlign: 'left',
        background: active ? `${C.primary}15` : C.surface2,
        border: `1px solid ${active ? C.primary : C.border}`,
        borderRadius: 8,
        padding: 10,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'background .1s, border-color .1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: 13, fontWeight: 700, color: C.text,
        }}>
          {loop.total_flow_fmt}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {verdict ? <Badge color={VERDICT_TONE[verdict] ?? 'gray'}>{verdict}</Badge> : <Badge color="gray">…</Badge>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.35 }}>
        {loop.short_label}
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 10, color: C.text3, fontFamily: 'var(--font-geist-mono), monospace' }}>
        <span>{loop.hops} hops</span>
        <span>·</span>
        <span>{loop.min_year}–{loop.max_year}</span>
        <span>·</span>
        <Badge color={CLASS_TONE[cls] ?? 'gray'}>{loop.worst_classification_label}</Badge>
      </div>
    </button>
  );
}
