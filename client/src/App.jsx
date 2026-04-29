import { useEffect, useState } from 'react';
import { Sidebar, Icons, useTheme } from '../ui-kit';
import { api } from './lib/api';
import Loops    from './views/Loops.jsx';
import Entities from './views/Entities.jsx';
import Summary  from './views/Summary.jsx';

const NAV = [
  { type: 'section', id: 'analysis', label: 'Analysis' },
  { id: 'loops',    label: 'Funding Loops', icon: Icons.arrow },
  { id: 'summary',  label: 'Findings',      icon: Icons.overview, accent: '#A855F7' },
  { type: 'section', id: 'entities-sec', label: 'Public Funds' },
  { id: 'entities', label: 'Top Recipients', icon: Icons.building, accent: '#06B6D4' },
];

export default function App() {
  const { C } = useTheme();
  const [active, setActive] = useState('loops');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function tick() {
      try {
        const h = await api.health();
        if (!cancelled) setHealth(h);
        if (!cancelled && !h.memo_complete) timer = setTimeout(tick, 4000);
      } catch { /* ignore */ }
    }
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const memoLoading = health && !health.memo_complete;

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: C.bg, color: C.text,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <Sidebar
        brand={{ title: 'Follow The Money', subtitle: 'CRA · FED · AB' }}
        items={NAV}
        active={active}
        onSelect={setActive}
        loadingTabs={{ loops: memoLoading }}
        footer={<HealthFooter health={health} />}
      />
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        {active === 'loops'    ? <Loops />    : null}
        {active === 'entities' ? <Entities /> : null}
        {active === 'summary'  ? <Summary />  : null}
      </main>
    </div>
  );
}

function HealthFooter({ health }) {
  const { C } = useTheme();
  if (!health) return null;
  const ok = health.status === 'ok';
  return (
    <div style={{
      fontSize: 10, fontFamily: 'var(--font-geist-mono), monospace',
      color: C.text3, lineHeight: 1.6,
    }}>
      <div>db <span style={{ color: health.database === 'connected' ? C.success : C.danger }}>{health.database}</span></div>
      <div>memos <span style={{ color: health.memo_complete ? C.success : C.warning }}>{health.memo_progress}</span></div>
      <div>status <span style={{ color: ok ? C.success : C.warning }}>{health.status}</span></div>
    </div>
  );
}
