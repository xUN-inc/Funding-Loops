# ui-kit

Drop-in React design kit. Copy folder into any React project (Vite, CRA, Next, Remix). Pure JS + inline styles. No framework lock-in.

> **Term:** this pattern — copy the source into your repo instead of installing from npm — is called a **drop-in module**, **vendored** library, or **shadcn-style** copy-paste components. You own the code; modify freely.

## What's inside

```
ui-kit/
├── package.json          declares peer deps (react, react-dom, recharts optional)
├── theme.js              ThemeProvider, useTheme, ThemeFlickerGuard, PALETTES
├── icons.js              inline SVG icon set
├── dataviz.js            chart tokens (VIZ, GRID, AXIS, helpers)
├── Sidebar.js            generic sidebar (props-driven)
├── globals.css           CSS vars, scrollbar, keyframes
├── index.js              barrel exports
├── components/
│   ├── Badge.js
│   ├── SectionCard.js
│   ├── StatCard.js
│   ├── PageHeader.js
│   ├── SearchBar.js      (+ filterRows helper)
│   ├── DarkTooltip.js    Recharts-compatible
│   ├── States.js         LoadingState, ErrorState, EmptyState
│   └── TablePrimitives.js  Th, Td
└── charts/               (require `recharts`)
    ├── Sparkline.js
    ├── KPIDelta.js
    ├── CategoryBar.js
    ├── AmendmentCreepLine.js
    ├── FlagDonut.js
    ├── ScatterAnomaly.js
    ├── RadarSignal.js
    └── NetworkGraph.js   (pure SVG, no recharts)
```

## Install

```bash
npm install react react-dom recharts
```

`recharts` only required if you use `charts/*` exports. Sidebar + UI primitives have zero deps beyond React.

## Setup

1. Copy `ui-kit/` into your `src/` (or wherever).
2. Import `ui-kit/globals.css` once at the app entry (or merge contents into your own globals).
3. Wrap app root in `<ThemeProvider>`.

```jsx
// src/main.jsx (Vite) or src/index.jsx (CRA)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './ui-kit';
import './ui-kit/globals.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

## Sidebar usage

Sidebar is generic — pass items, handle selection in parent.

```jsx
import { useState } from 'react';
import { Sidebar, Icons } from './ui-kit';

const items = [
  { type: 'section', id: 'main', label: 'Main' },
  { id: 'home',   label: 'Home',   icon: Icons.overview },
  { id: 'ask',    label: 'Ask',    icon: Icons.spark, tag: 'AI' },
  { type: 'section', id: 'work', label: 'Workspace' },
  { id: 'people', label: 'People', icon: Icons.users },
  { id: 'orgs',   label: 'Orgs',   icon: Icons.building },
];

export default function Layout({ children }) {
  const [active, setActive] = useState('home');
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        brand={{ title: 'My App', subtitle: 'v1.0' }}
        items={items}
        active={active}
        onSelect={setActive}
        dataCounts={{ people: 42, orgs: 7 }}     // optional
        loadingTabs={{ ask: true }}              // optional
      />
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
```

### Sidebar item shape

| field    | type   | notes                                            |
|----------|--------|--------------------------------------------------|
| `id`     | string | required, unique                                 |
| `label`  | string | required                                         |
| `icon`   | node   | optional, use `Icons.*` or any SVG               |
| `accent` | string | optional, override hex color for active state    |
| `tag`    | string | optional, small pill (e.g. `'AI'`, `'NEW'`)      |
| `type`   | string | `'section'` renders divider + uppercase header   |

## UI primitives

```jsx
import {
  PageHeader, SectionCard, StatCard, Badge,
  SearchBar, filterRows, LoadingState, ErrorState, EmptyState,
  Th, Td,
} from './ui-kit';

<PageHeader title="Users" subtitle="All accounts" section="ADMIN" count={42} />

<StatCard label="Revenue" value="$12.4k" sub="+8% MoM" />

<SectionCard title="Recent" accent="#6366F1">
  <table>
    <thead><tr><Th>Name</Th><Th right>Amount</Th></tr></thead>
    <tbody><tr><Td>Acme</Td><Td right mono>$1,200</Td></tr></tbody>
  </table>
</SectionCard>

<Badge color="green">ACTIVE</Badge>
```

## Charts (recharts)

```jsx
import {
  Sparkline, KPIDelta, CategoryBar, AmendmentCreepLine,
  FlagDonut, ScatterAnomaly, RadarSignal, NetworkGraph,
  VIZ, seriesColor, riskColor,
} from './ui-kit';

<Sparkline data={[1,3,2,5,4]} color={VIZ.ok} area />

<KPIDelta value={12.4} goodDirection="up" />

<CategoryBar
  data={[{ label: 'Foo', value: 22 }, { label: 'Bar', value: 8 }]}
  thresholds={{ high: 20, medium: 10 }}
  orientation="horizontal"
/>

<FlagDonut
  data={[{ name: 'Active', value: 80 }, { name: 'Pending', value: 20 }]}
  innerLabel={(t) => t}
/>

<NetworkGraph
  nodes={[
    { id: 'a', label: 'Org A', kind: 'org' },
    { id: 'b', label: 'Org B', kind: 'flagged' },
    { id: 'c', label: 'Person', kind: 'person' },
  ]}
  edges={[
    { from: 'a', to: 'b', kind: 'flow', label: '$1.2M' },
    { from: 'b', to: 'c', kind: 'base' },
  ]}
/>
```

Full prop docs in each chart file's JSDoc.

## Recoloring

Open `ui-kit/theme.js` → edit `PALETTES.dark` / `PALETTES.light`. All UI components consume `useTheme()`. Chart tokens in `dataviz.js` derive from `PALETTES.dark` at module load — change there for chart palette changes.

## Backend integration note

Components are pure presentation. Wire data however you want:

```jsx
// example: fetch from your Express/FastAPI backend
import { useEffect, useState } from 'react';
import { LoadingState, ErrorState, SectionCard, StatCard } from './ui-kit';

function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(e.message));
  }, []);

  if (err)   return <ErrorState message={err} />;
  if (!data) return <LoadingState />;
  return <StatCard label="Users" value={data.users} />;
}
```

## SSR / Next.js (no flicker)

For Next.js or any SSR setup, render `<ThemeFlickerGuard />` in `<head>` to apply the saved theme synchronously before hydration:

```jsx
import { ThemeFlickerGuard, ThemeProvider } from './ui-kit';

export default function RootLayout({ children }) {
  return (
    <html>
      <head><ThemeFlickerGuard /></head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
```

Vite/CRA SPAs don't need this — `useState` lazy init reads localStorage on mount.

## Performance applied (Vercel React rules)

- `rerender-lazy-state-init` — `useState(() => readStoredTheme(...))`
- `rerender-functional-setstate` — toggle uses `setState(curr => ...)`
- `rerender-memo` — provider value memoized; consumers don't re-render unless theme flips
- `rerender-no-inline-components` — `SidebarItem` extracted (not defined inside `Sidebar`)
- `rendering-hoist-jsx` — static style objects hoisted to module scope
- `rendering-conditional-render` — `{x ? … : null}` everywhere; no `&&`-with-numeric-falsy bugs
- `rendering-hydration-no-flicker` — `ThemeFlickerGuard` inline script
- `client-localstorage-schema` — versioned key (`ui-kit:theme:v1`) + try/catch on read AND write + value validation
- `js-early-exit` / `js-cache-property-access` — `filterRows` uses cached length + early `return true`

## Notes

- No `'use client'` — pure React.
- Inline styles only — no Tailwind / CSS modules required.
- Font fallback chain: Geist CSS vars → `Inter, system-ui, sans-serif`. If Geist absent, browser falls back automatically.
- Theme persists to `localStorage['ui-kit:theme:v1']`.
- `package.json` declares `recharts` as optional peer — only required if you import from `charts/*`.
