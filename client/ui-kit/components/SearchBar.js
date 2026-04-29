import { useCallback, useState } from 'react';
import { useTheme } from '../theme';
import Icons from '../icons';

const NOOP = () => {};

export default function SearchBar({
  value, onChange = NOOP, placeholder = 'Filter…', total, matched,
}) {
  const { C } = useTheme();
  const [focused, setFocused] = useState(false);
  const showCount = value && total != null;

  const handleFocus = useCallback(() => setFocused(true),  []);
  const handleBlur  = useCallback(() => setFocused(false), []);
  const handleClear = useCallback(() => onChange(''),      [onChange]);
  const handleInput = useCallback((e) => onChange(e.target.value), [onChange]);

  return (
    <div
      className="flex items-center gap-2 bg-input-bg rounded-lg px-2.5 py-1.5 transition-[border-color,box-shadow] duration-100"
      style={{
        border: `1px solid ${focused ? C.primary : C.border}`,
        boxShadow: focused ? `0 0 0 3px ${C.primary}22` : 'none',
      }}
    >
      <span
        className="shrink-0 leading-none"
        style={{ color: focused ? C.primary : C.text3 }}
      >
        {Icons.search}
      </span>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-0 outline-none text-text text-[12px] tracking-tight min-w-0 font-sans"
      />
      {showCount ? (
        <span className="text-[10px] font-mono text-text3 shrink-0 bg-surface2 border border-border rounded px-1.5 py-px font-bold">
          {matched}/{total}
        </span>
      ) : null}
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="bg-transparent border-0 cursor-pointer text-text3 text-[14px] leading-none p-0 shrink-0"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

// Case-insensitive multi-field substring filter helper.
export function filterRows(rows, query, fields) {
  if (!query?.trim()) return rows;
  const q = query.toLowerCase();
  const len = fields.length;

  return rows.filter(r => {
    for (let i = 0; i < len; i++) {
      const v = r[fields[i]];
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j++) {
          if (String(v[j]).toLowerCase().includes(q)) return true;
        }
      } else if (String(v).toLowerCase().includes(q)) {
        return true;
      }
    }
    return false;
  });
}
