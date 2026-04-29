import { useEffect, useRef, useState } from 'react';
import { useTheme, LoadingState, ErrorState, Badge } from '../../ui-kit';
import { api } from '../lib/api';

const CLASS_TONE = {
  overhead_extraction: 'red',
  receipt_generation:  'red',
  revenue_inflation:   'yellow',
  structural:          'gray',
  low_risk:            'green',
};

const POPOVER_WIDTH = 460;
// Body scrolls — taller cap to fit the structured boards plus the AI profile.
const POPOVER_MAX_HEIGHT = 600;
const VIEWPORT_PAD = 12;

const PROFILE_TONE = {
  COMPLETE: 'green',
  PARTIAL: 'yellow',
  AMBIGUOUS: 'red',
};

// Parse the AI profile string returned by /api/director-profile into
// structured bullets the UI can render. Each input line looks like:
//   "- [CATEGORY] claim text | Source: https://..."
// Trailing tag "[PROFILE: COMPLETE]" becomes the status badge.
function parseProfile(text) {
  if (!text) return { bullets: [], status: null };
  const statusMatch = text.match(/\[PROFILE:\s*([^\]]+)\]/);
  const status = statusMatch ? statusMatch[1].trim() : null;
  const bullets = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-'))
    .map(line => {
      const stripped = line.replace(/^-\s*/, '');
      const sourceIdx = stripped.search(/\s*\|\s*Source:\s*/i);
      const body = sourceIdx >= 0 ? stripped.slice(0, sourceIdx) : stripped;
      const source = sourceIdx >= 0 ? stripped.slice(sourceIdx).replace(/^\s*\|\s*Source:\s*/i, '').trim() : '';
      const m = body.match(/^\[([^\]]+)\]\s*(.*)$/);
      return m
        ? { category: m[1].trim(), text: m[2].trim(), source }
        : { category: '', text: body.trim(), source };
    });
  return { bullets, status };
}

function clampPosition(anchor) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let left = anchor.x + 8;
  let top  = anchor.y + 8;
  if (left + POPOVER_WIDTH + VIEWPORT_PAD > vw) {
    left = Math.max(VIEWPORT_PAD, vw - POPOVER_WIDTH - VIEWPORT_PAD);
  }
  if (top + POPOVER_MAX_HEIGHT + VIEWPORT_PAD > vh) {
    top = Math.max(VIEWPORT_PAD, vh - POPOVER_MAX_HEIGHT - VIEWPORT_PAD);
  }
  return { left, top };
}

export default function DirectorPopover({ name, charityName, anchor, onClose }) {
  const { C } = useTheme();
  const ref = useRef(null);
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [profile, setProfile]       = useState(null);
  const [profileErr, setProfileErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setErr(null);
    setProfile(null); setProfileErr(null);

    api.director(name)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e.message); });

    api.directorProfile(name, charityName)
      .then(p => { if (!cancelled) setProfile(p); })
      .catch(e => { if (!cancelled) setProfileErr(e.message); });

    return () => { cancelled = true; };
  }, [name, charityName]);

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

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {err ? (
          <ErrorState message={err} />
        ) : !data ? (
          <LoadingState message="Looking up boards…" />
        ) : (
          <Body data={data} />
        )}

        <ProfileSection
          profile={profile}
          err={profileErr}
        />
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
        <Stat label="Boards"  value={String(data.board_count)} />
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

function ProfileSection({ profile, err }) {
  const { C } = useTheme();

  // Loading and error states are inline (smaller than the boards block above).
  if (err) {
    return (
      <div
        className="rounded-md p-3 text-[11px]"
        style={{
          background: `${C.danger}10`,
          border: `1px solid ${C.danger}30`,
          color: C.danger,
        }}
      >
        AI profile unavailable: {err}
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className="rounded-md p-3 text-[11px] font-mono text-text3 flex items-center gap-2"
        style={{
          background: C.surface2,
          border: `1px solid ${C.border}`,
        }}
      >
        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: C.primary }} />
        Researching public records…
      </div>
    );
  }

  const { bullets, status } = parseProfile(profile.profile);
  const sources = profile.sources || [];
  const statusKey = status ? status.split(/\s|—/)[0].toUpperCase() : null;
  const tone = statusKey ? PROFILE_TONE[statusKey] || 'gray' : 'gray';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div
          className="text-[9px] font-bold font-mono uppercase text-text3"
          style={{ letterSpacing: '.14em' }}
        >
          Public-Record Profile
        </div>
        {status ? <Badge color={tone}>{status}</Badge> : null}
      </div>

      {bullets.length ? (
        <div className="flex flex-col gap-1.5">
          {bullets.map((b, i) => (
            <ProfileBullet key={i} bullet={b} />
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-text3 italic">
          No public-record signals found.
        </div>
      )}

      {sources.length ? (
        <div className="flex flex-col gap-1 mt-1">
          <div
            className="text-[9px] font-bold font-mono uppercase text-text3"
            style={{ letterSpacing: '.12em' }}
          >
            Sources
          </div>
          <ul className="flex flex-col gap-0.5">
            {sources.map((s, i) => (
              <li key={i} className="text-[10px] truncate">
                <a
                  href={s.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: C.primary }}
                  title={s.uri}
                >
                  {s.title || s.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProfileBullet({ bullet }) {
  const { C } = useTheme();
  const isUrl = bullet.source && /^https?:\/\//i.test(bullet.source);
  return (
    <div
      className="rounded-md p-2.5 flex flex-col gap-1"
      style={{
        background: C.surface2,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-start gap-2">
        {bullet.category ? (
          <span
            className="text-[8px] font-bold font-mono uppercase shrink-0 px-1.5 py-0.5 rounded mt-px"
            style={{
              color: C.primary,
              background: `${C.primary}1A`,
              border: `1px solid ${C.primary}40`,
              letterSpacing: '.1em',
            }}
          >
            {bullet.category}
          </span>
        ) : null}
        <span className="text-[12px] text-text leading-snug">
          {bullet.text}
        </span>
      </div>
      {bullet.source ? (
        <div className="text-[10px] font-mono text-text3 truncate" title={bullet.source}>
          {isUrl ? (
            <a
              href={bullet.source}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: C.primary }}
            >
              {bullet.source}
            </a>
          ) : (
            <span>Source: {bullet.source}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
