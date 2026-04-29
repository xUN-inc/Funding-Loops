export function Th({ children, right }) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-bold text-text3 uppercase border-b border-border whitespace-nowrap bg-surface2 ${
        right ? 'text-right' : 'text-left'
      }`}
      style={{ letterSpacing: '.07em' }}
    >
      {children}
    </th>
  );
}

export function Td({ children, right, mono, muted }) {
  return (
    <td
      className={[
        'px-3 py-2.5 border-b border-border',
        right ? 'text-right' : 'text-left',
        muted ? 'text-text2' : 'text-text',
        mono ? 'font-mono text-[12px]' : 'text-[13px]',
      ].join(' ')}
    >
      {children}
    </td>
  );
}
