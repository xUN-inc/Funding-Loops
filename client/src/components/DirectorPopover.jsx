import { useEffect, useRef, useState } from 'react';
import { useTheme, LoadingState, ErrorState, Badge } from '../../ui-kit';
import { api } from '../lib/api';

const CLASS_TONE = {
  overhead_extraction: 'red',
  receipt_generation: 'red',
  revenue_inflation: 'yellow',
  structural: 'gray',
  low_risk: 'green',
};

const POPOVER_WIDTH = 420;
// Cap height at width so popover stays square; body scrolls past that.
const POPOVER_MAX_HEIGHT = POPOVER_WIDTH;
const VIEWPORT_PAD = 12;

function clampPosition(anchor) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let left = anchor.x + 8;
  let top = anchor.y + 8;
  if (left + POPOVER_WIDTH + VIEWPORT_PAD > vw) {
    left = Math.max(VIEWPORT_PAD, vw - POPOVER_WIDTH - VIEWPORT_PAD);
  }
  if (top + POPOVER_MAX_HEIGHT + VIEWPORT_PAD > vh) {
    top = Math.max(VIEWPORT_PAD, vh - POPOVER_MAX_HEIGHT - VIEWPORT_PAD);
  }
  return { left, top };
}

export default function DirectorPopover({ name, anchor, onClose }) {
  const { C } = useTheme();
  const ref = useRef(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setErr(null);
    api.director(name)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const { left, top } = clampPosition(anchor);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Director profile: ${name}`}
      className="fixed z-50 rounded-[10px] shadow-2xl flex flex-col overflow-hidden"
      style={{
        left,
        top,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="flex items-start justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: C.border, background: C.surface2 }}
      >
        <div className="min-w-0">
          <div
            className="text-[9px] font-bold font-mono uppercase text-text3"
            style={{ letterSpacing: '.14em' }}
          >
            Director
          </div>
          <div className="text-[14px] font-bold text-text truncate" title={name}>
            {toTitle(name)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-text3 hover:text-text cursor-pointer text-[16px] leading-none px-1"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-2 text-center">
        <div
          className="text-[10px] font-bold font-mono uppercase"
          style={{ letterSpacing: '.14em', color: C.warning ?? C.danger }}
        >
          API Limit Reached
        </div>
        <div className="text-[12px] text-text2 max-w-[300px]">
          Director profile lookups are temporarily unavailable. Please try again later.
        </div>
      </div>

      <div
        className="px-4 py-2 border-t text-[10px] font-mono text-text3"
        style={{ borderColor: C.border, background: C.surface2 }}
      >
        Source: cra.cra_directors · last 6 yrs · click outside to close
      </div>
    </div>
  );
}

function Body({ data }) {
  const { C } = useTheme();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Boards" value={String(data.board_count)} />
        <Stat label="Revenue" value={data.total_revenue_fmt} accent={C.primary} />
        <Stat label="Flagged" value={String(data.flagged_boards)} accent={data.flagged_boards ? C.danger : C.text3} />
      </div>

      <div className="flex flex-col gap-1.5">
        {data.boards.map(b => (
          <BoardRow key={b.bn} board={b} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  const { C } = useTheme();
  return (
    <div
      className="rounded-md p-2.5"
      style={{
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.border}`,
      }}
    >
      <div
        className="text-[9px] font-bold uppercase font-mono text-text3"
        style={{ letterSpacing: '.12em' }}
      >
        {label}
      </div>
      <div
        className="text-[14px] font-bold text-text font-mono"
        style={{ color: accent || C.text }}
      >
        {value}
      </div>
    </div>
  );
}

function BoardRow({ board }) {
  const { C } = useTheme();
  const cls = board.classification;
  return (
    <div
      className="rounded-md p-2.5 flex flex-col gap-1"
      style={{
        background: C.surface2,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-text truncate" title={board.legal_name}>
          {board.legal_name}
        </span>
        <span className="text-[11px] font-mono text-text font-bold shrink-0">
          {board.total_revenue_fmt}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-text3">
        <span>{board.bn}</span>
        {board.city ? <span>· {board.city}{board.province ? `, ${board.province}` : ''}</span> : null}
        {cls ? <Badge color={CLASS_TONE[cls] ?? 'gray'}>{board.classification_label}</Badge> : null}
      </div>
    </div>
  );
}

function toTitle(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ');
}
