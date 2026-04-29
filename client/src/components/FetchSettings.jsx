import { useEffect, useState } from 'react';
import SlideOver from './SlideOver.jsx';

export const DEFAULT_FETCH_SETTINGS = Object.freeze({
  initialFetchSize: 20,
  pageSize: 20,
  sort: 'flow',
  dir: 'desc',
  classifications: [],
  minDirectors: 0,
  verdicts: [],
});

const SORT_OPTIONS = [
  { value: 'flow',      label: 'Total Flow (revenue)' },
  { value: 'directors', label: 'Shared Directors' },
  { value: 'hops',      label: 'Hop Count' },
  { value: 'recent',    label: 'Most Recent Year' },
];

const DIR_OPTIONS = [
  { value: 'desc', label: 'Descending (largest first)' },
  { value: 'asc',  label: 'Ascending (smallest first)' },
];

const CLASSIFICATION_OPTIONS = [
  { value: 'overhead_extraction', label: 'Overhead Extraction' },
  { value: 'receipt_generation',  label: 'Receipt Generation' },
  { value: 'revenue_inflation',   label: 'Revenue Inflation' },
  { value: 'low_risk',            label: 'Low Risk' },
  { value: 'structural',          label: 'Structural' },
];

const VERDICT_OPTIONS = [
  { value: 'RED FLAG', label: 'Red Flag' },
  { value: 'SCRUTINY', label: 'Scrutiny' },
  { value: 'BENIGN',   label: 'Benign' },
];

function clampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function FetchSettings({ open, settings, onApply, onClose }) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const toggleInList = (key, value) => {
    setDraft((d) => {
      const set = new Set(d[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...d, [key]: [...set] };
    });
  };

  const handleApply = () => {
    onApply({
      ...draft,
      initialFetchSize: clampInt(draft.initialFetchSize, 1, 200),
      pageSize:         clampInt(draft.pageSize, 1, 200),
      minDirectors:     clampInt(draft.minDirectors, 0, 50),
    });
  };

  const handleReset = () => setDraft(DEFAULT_FETCH_SETTINGS);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="FETCH SETTINGS"
      width={420}
    >
      <div className="flex flex-col gap-6">
        <NumberField
          label="Initial Fetch Size"
          help="How many loops to load on first paint (1–200)."
          value={draft.initialFetchSize}
          min={1} max={200}
          onChange={(v) => update({ initialFetchSize: v })}
        />

        <NumberField
          label="Page Size (Load More)"
          help="How many additional loops each Load More click fetches."
          value={draft.pageSize}
          min={1} max={200}
          onChange={(v) => update({ pageSize: v })}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Sort By"
            value={draft.sort}
            options={SORT_OPTIONS}
            onChange={(v) => update({ sort: v })}
          />
          <SelectField
            label="Direction"
            value={draft.dir}
            options={DIR_OPTIONS}
            onChange={(v) => update({ dir: v })}
          />
        </div>

        <ToggleGroup
          label="Classification Filter"
          help="Click to toggle. Empty = all classifications."
          options={CLASSIFICATION_OPTIONS}
          selected={draft.classifications}
          onToggle={(v) => toggleInList('classifications', v)}
        />

        <NumberField
          label="Minimum Shared Directors"
          help="Only show loops where ≥N individuals sit on multiple boards inside the cycle. 0 = no filter."
          value={draft.minDirectors}
          min={0} max={50}
          onChange={(v) => update({ minDirectors: v })}
        />

        <ToggleGroup
          label="Verdict Filter (client-side)"
          help="Filters whatever has been loaded. Verdicts arrive lazily as memos generate."
          options={VERDICT_OPTIONS}
          selected={draft.verdicts}
          onToggle={(v) => toggleInList('verdicts', v)}
        />
      </div>

      <div className="sticky -bottom-[18px] -mx-[18px] mt-6 px-[18px] py-3 border-t border-border bg-surface flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-[11px] font-bold font-mono uppercase tracking-wider rounded-md border border-border bg-surface text-text2 hover:text-text hover:bg-hover-bg cursor-pointer"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-4 py-2 text-[11px] font-bold font-mono uppercase tracking-wider rounded-md border border-primary bg-primary text-white hover:opacity-90 cursor-pointer"
        >
          Apply &amp; Reload
        </button>
      </div>
    </SlideOver>
  );
}

function FieldLabel({ children }) {
  return (
    <div className="text-[10px] font-bold font-mono uppercase tracking-[0.12em] text-text2 mb-1.5">
      {children}
    </div>
  );
}

function FieldHelp({ children }) {
  return <div className="text-[11px] text-text3 mt-1.5 leading-snug">{children}</div>;
}

function NumberField({ label, help, value, min, max, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full bg-input-bg border border-border rounded-md px-3 py-2 text-[13px] font-mono text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input-bg border border-border rounded-md px-3 py-2 text-[13px] font-mono text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleGroup({ label, help, options, selected, onToggle }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                active
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-surface2 border-border text-text2 hover:text-text hover:bg-hover-bg'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  );
}
