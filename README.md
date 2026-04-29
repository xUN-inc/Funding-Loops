# Follow The Money

> Visualize circular funding loops between Canadian charities using CRA T3010 data, with AI-generated forensic memos and director-overlap analysis.

Built for the **AI For Accountability Hackathon** (demo April 29, 2026). Read the [one-pager](ONE_PAGER.md) for the judge-facing brief, [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for hackathon-challenge coverage, and [METHODOLOGY.md](METHODOLOGY.md) for the analytical method.

---

## Quick start

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env       # then fill in real values (see Environment below)

# 3a. run BOTH the new React UI and the API
npm start                  # → React: http://localhost:5173
                           #   API:   http://localhost:3000

# 3b. OR run just the API + the legacy vanilla UI (single port, no Vite)
npm run old                # → http://localhost:3000/old.html
                           # → http://localhost:3000/entities.html
```

Default port is `3000`. Override with `PORT=4000 node server.js`.

---

## Environment

Copy `.env.example` (or just create `.env`) with:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string. SSL is forced (`rejectUnauthorized: false`). |
| `GEMINI_API_KEY` | yes for memos | — | Google AI Studio key. Falls back to `GOOGLE_API_KEY`. |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Override to e.g. `gemini-2.5-pro`. |
| `PORT` | no | `3000` | Server port. |
| `ANTHROPIC_API_KEY` | no | — | If set, the `/api/summary/narrative` endpoint uses Claude first, then falls back to Gemini. |
| `ANTHROPIC_MODEL` | no | `claude-opus-4-20250514` | Only used when `ANTHROPIC_API_KEY` is present. |

The DB must contain the `cra`, `fed`, `ab`, and `general` schemas from the parent repo's ETL pipelines. Loop detection (`cra.partitioned_cycles`, `cra.loop_universe`) and director tables (`cra.cra_directors`) must already be populated.

For richer classification chips, build the matview once:

```bash
psql "$DATABASE_URL" -f ../CRA/sql/10-loop-classification.sql
```

If the matview is missing, the app still runs — every loop just falls back to the `low_risk` bucket and the chips render blank.

---

## NPM scripts

| Script | What it does |
|---|---|
| `npm start` | Kills stale processes on `3000`/`5173`, then runs `node server.js` and `vite` (React client) concurrently. |
| `npm run server` | API only (port 3000). |
| `npm run client` | Vite dev server only (port 5173, proxies `/api` → 3000). |
| `npm run old` | API only, with a console reminder pointing at the legacy `/old.html` and `/entities.html`. |
| `npm run kill` | Frees ports 3000 and 5173. |

---

## Project structure

```
app/
├── server.js               ← Express + node-postgres + Gemini wrapper
├── public/                 ← static assets served at /
│   ├── index.html          ← Vite-built React SPA (output of `npm run build`)
│   ├── old.html            ← original vanilla-JS UI (still maintained)
│   ├── entities.html       ← Public Recipients view (vanilla)
│   └── assets/             ← Vite-emitted JS/CSS bundles
├── client/                 ← React source (Vite)
│   ├── src/                ← components, pages, hooks
│   ├── ui-kit/             ← shared design-system primitives
│   └── vite.config.js      ← proxy /api → :3000, output to ../public
├── .env                    ← never committed; secrets only
├── PROJECT_OVERVIEW.md     ← hackathon coverage / status
├── METHODOLOGY.md          ← classification model + leakage formula
├── ONE_PAGER.md            ← judge-facing summary
└── README.md               ← this file
```

`old.html` and `entities.html` are the source of truth for vanilla-UI changes. `index.html` (under `public/`) is **generated** by `npm run client && cd client && vite build` — never hand-edit it.

---

## API reference

All endpoints return JSON unless noted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | DB connectivity probe + cache stats. |
| `GET` | `/api/loops` | Paginated loop list. Query: `limit`, `offset`, `sort` (`flow`/`directors`/`hops`/`recent`), `dir` (`asc`/`desc`), `classifications` (csv), `min_directors`. |
| `GET` | `/api/loop/:id` | Full graph data for one loop (nodes, edges, directors, federal grants, leakage). |
| `POST` | `/api/investigate/:id` | Generate (or return cached) Gemini forensic memo for a loop. |
| `GET` | `/api/verdicts` | Map of `loopId → verdict` for every memo currently cached. |
| `GET` | `/api/summary` | Aggregate stats across the loop universe (totals, classification breakdown). |
| `GET` | `/api/summary/narrative` | Three-paragraph executive summary of the loop universe. |
| `GET` | `/api/loops.csv` | All loops as CSV for journalists / spreadsheet workflows. |
| `GET` | `/api/recipients/top` | Top-50 non-charity public-money recipients (FED + AB). |
| `GET` | `/api/recipients/search?q=` | Debounced free-text recipient search. |
| `GET` | `/api/recipient/:name` | Per-recipient profile across federal + Alberta sources. |

All Gemini calls log token usage to stdout (`[gemini:label] +N tokens | session: ...`).

---

## Architecture

```
┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Browser      │    │   Express API   │    │   PostgreSQL     │
│ (React + D3)   │◄──►│   server.js     │◄──►│  cra/fed/ab/gen  │
│ or old.html    │    │                 │    │                  │
└────────────────┘    └────────┬────────┘    └──────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Gemini 2.5     │
                      │ (forensic memo) │
                      └─────────────────┘
```

- **Read-only.** Server never writes to the DB.
- **In-process caches** (5-min TTL) for the loop pool, memos, and the narrative summary — first request enriches, all subsequent sort/filter/paginate is pure JS.
- **Memo pre-generation** at startup: the top loop's memo is generated immediately so the first click in the demo is instant.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cra.loop_classification not found` | matview not built | Run the SQL file in Quick Start. App still works without it. |
| `EADDRINUSE: address already in use :::3000` | leftover process | `npm run kill` |
| Memos all say "Analysis unavailable — please retry." | bad/missing `GEMINI_API_KEY` or rate-limit | Check key, watch the `[gemini:...]` log line for the actual error. |
| Verdict chips never appear | `/api/verdicts` polling stopped or memos never generated | Open devtools, check Network tab — confirm `POST /api/investigate/:id` returns 200. |
| `EADDRNOTAVAIL` from postgres | transient TLS / network blip on hosted DB | Restart the server. |

---

## Deployment

See `DEPLOYMENT.md` (TBD — pending platform choice). For a quick demo, the easiest options are:

1. **Render web service** — push to git, autodeploy, automatic HTTPS, same network as the existing Postgres. Free tier sleeps after 15 min idle.
2. **Cloudflare Tunnel** from your laptop — `cloudflared tunnel --url http://localhost:3000` gives an instant public HTTPS URL with no infra.
3. **DigitalOcean droplet** — `$6/mo`, full control, real IP, takes ~30 min to set up with PM2 + nginx.

---

## License

See [`../LICENSE`](../LICENSE).
