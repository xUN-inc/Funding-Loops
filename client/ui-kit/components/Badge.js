import { useTheme } from '../theme';

const TONES = {
  red:    (C) => ({ accent: C.danger,  text: C.isDark ? '#FCA5A5' : C.danger }),
  yellow: (C) => ({ accent: C.warning, text: C.isDark ? '#FCD34D' : C.warning }),
  green:  (C) => ({ accent: C.success, text: C.isDark ? '#6EE7B7' : C.success }),
  blue:   (C) => ({ accent: C.primary, text: C.isDark ? '#C7D2FE' : C.primary }),
  gray:   (C) => ({ accent: C.text3,   text: C.text2 }),
};

export default function Badge({ color = 'gray', children }) {
  const { C } = useTheme();
  const tone = (TONES[color] ?? TONES.gray)(C);
  return (
    <span
      className="inline-block rounded px-1.5 py-px text-[11px] font-bold font-mono"
      style={{
        background: `${tone.accent}18`,
        color: tone.text,
        border: `1px solid ${tone.accent}38`,
      }}
    >
      {children}
    </span>
  );
}
