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
    <div className="flex min-h-screen bg-bg text-text font-sans">
      <Sidebar
        brand={{ title: 'Follow The Money', subtitle: 'CRA · FED · AB' }}
        items={NAV}
        active={active}
        onSelect={setActive}
        loadingTabs={{ loops: memoLoading }}
        footer={<HealthFooter health={health} />}
      />
      <main className="flex-1 px-8 py-7 overflow-y-auto">
        {active === 'loops'    ? <Loops />    : null}
        {active === 'entities' ? <Entities /> : null}
        {active === 'summary'  ? <Summary />  : null}
      </main>
    </div>
  );
}

function HealthFooter({ health }) {
  if (!health) return null;
  const ok = health.status === 'ok';
  return (
    <div className="text-[10px] font-mono text-text3 leading-relaxed">
      <div>
        db <span className={health.database === 'connected' ? 'text-success' : 'text-danger'}>{health.database}</span>
      </div>
      <div>
        memos <span className={health.memo_complete ? 'text-success' : 'text-warning'}>{health.memo_progress}</span>
      </div>
      <div>
        status <span className={ok ? 'text-success' : 'text-warning'}>{health.status}</span>
      </div>
    </div>
  );
}
