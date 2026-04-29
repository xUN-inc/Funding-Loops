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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: C.inputBg,
      border: `1px solid ${focused ? C.primary : C.border}`,
      borderRadius: 8,
      padding: '6px 10px',
      transition: 'border-color .12s, box-shadow .12s',
      boxShadow: focused ? `0 0 0 3px ${C.primary}22` : 'none',
    }}>
      <span style={{ color: focused ? C.primary : C.text3, flexShrink: 0, lineHeight: 0 }}>
        {Icons.search}
      </span>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: C.text, fontSize: 12,
          fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
          letterSpacing: '.01em', minWidth: 0,
        }}
      />
      {showCount ? (
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace',
          color: C.text3, flexShrink: 0,
          background: C.surface2, border: `1px solid ${C.border}`,
          borderRadius: 4, padding: '1px 6px', fontWeight: 700,
        }}>
          {matched}/{total}
        </span>
      ) : null}
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.text3, fontSize: 14, lineHeight: 1, padding: 0,
            flexShrink: 0,
          }}
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
