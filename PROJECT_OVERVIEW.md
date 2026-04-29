# Follow The Money — Project Overview

> **One-page brief** for quickly understanding what this app is, what hackathon challenge it solves, and how far along we are.

---

## The Hackathon

- **Event:** AI For Accountability Hackathon
- **Demo day:** April 29, 2026
- **Project name:** Follow The Money
- **Lives in:** [`app/`](.) (this folder is the demo)

The full repo covers 10 challenges. **`app/` is built around Challenge 3 (Funding Loops) as the primary lens, but it also pulls in supporting evidence from Challenge 6 (Related Parties) and Challenge 8 (Duplicative Funding) — and lightly touches Challenge 2 (Ghost Capacity).**

---

## What `app/` Does

A two-view investigation console with a shared institutional design system.

### View 1 — Funding Loops (`/`) — the C3 demo

A 3-panel console for circular funding patterns between Canadian charities, built on the CRA T3010 dataset.

| Panel | Purpose |
|---|---|
| **Left — Loop List** | Ranked funding cycles (largest dollar flow first), with risk tier + worst-case classification chip per loop. |
| **Center top — Network Graph** | D3 force-directed view of the loop. Node size = revenue, node ring color/thickness = classification severity, arrows show fund flow direction. |
| **Center bottom — Federal Grants** | Public funds detected entering this circular loop (CRA × FED cross-reference). |
| **Right — Investigation Memo** | Claude-generated forensic memo (verdict: BENIGN / SCRUTINY / RED FLAG) plus a "Controlling Individuals" section showing directors who sit on multiple boards inside the cycle. |

### View 2 — Public Recipients (`/entities.html`) — non-charity scope

A search + profile console for everyone *else* receiving public money — companies, NGOs, universities, individuals — explicitly **excluding** charities (which are already covered in View 1, so we don't double-count). Aggregates federal grants & contributions, Alberta sole-source contracts, Alberta procurement, and Alberta grants by recipient.

| Panel | Purpose |
|---|---|
| **Left — Search & Top 50** | Free-text recipient search (debounced) + ranked list of largest non-charity recipients of public funds across FED + AB datasets. |
| **Right — Recipient Profile** | Combined funding total + per-source breakdown (Federal vs Alberta) + line-item tables for each program: Federal Grants, AB Sole-Source, AB Contracts, AB Grants. |

This addresses the "feels charity-only" gap and broadens the audience: the same accountability lens now applies to corporate vendors, sole-source winners, and university grant recipients — not just registered charities.

**Stack:** Express + node-postgres → PostgreSQL (`cra`, `fed`, `ab`, `general` schemas) → D3.js v7 frontend → Anthropic Claude (`claude-sonnet-4-20250514`) for memo generation.

---

## Challenges Covered by This App

The repo-wide [situation report](../situation.md) tracks 10 challenges. This app primarily targets **C3** but its supporting features close real gaps in **C6**, **C8**, and **C2**.

| # | Challenge | Before app | After app | What this app contributes |
|:-:|---|:-:|:-:|---|
| **3** | **Funding Loops** *(primary)* | 90% | **100%** | Classification matview, per-loop forensic memo, aggregate findings overview, CSV export, methodology doc, golden-records cross-dataset enrichment. Closes both gaps from situation.md (classification + narrative report + golden records). |
| **6** | **Related Parties / Governance Networks** *(supporting)* | 30% | **~45%** | Director-overlap query surfacing individuals who sit on ≥2 boards inside a cycle — the strongest single-decision-maker signal. Closes part of the "director network graph" gap. |
| **8** | **Duplicative Funding** *(supporting)* | 45% | **~55%** | Federal Grants panel cross-references each loop's BNs against `fed.grants_contributions` to surface public funds entering the cycle. Demonstrates same-entity / multi-source funding. |
| **2** | **Ghost Capacity** *(light touch)* | 40% | **~45%** | Classification uses overhead_pct / program_pct from CRA financials — the `overhead_extraction` bucket is effectively a ghost-capacity flag for loop participants. |

### How we count the C3 95%

> *"Distinguish structurally normal loops from suspicious ones... build classification layer: normal vs inflating revenue vs generating receipts vs absorbing into overhead... narrative report summarizing findings."*

That was the explicit remaining 10% from situation.md. We deliver:
- Classification layer → `cra.loop_classification` matview, 5 buckets
- Narrative reports → Claude-generated forensic memo per loop, naming classifications and controlling directors

### What we've built on top of the existing analysis

| Layer | What it adds | Where |
|---|---|---|
| **Loop detection** (pre-existing) | 5,808 cycles via brute-force; 4,759 via Johnson's | `CRA/scripts/advanced/01,06` |
| **Risk scoring** (pre-existing) | 0–30 score across 1,501 BNs | `CRA/scripts/advanced/02` |
| **Classification matview** | Buckets every loop participant into `overhead_extraction`, `receipt_generation`, `revenue_inflation`, `low_risk`, `structural` | `CRA/sql/10-loop-classification.sql` |
| **Director-overlap query** | Live SQL finding individuals on ≥2 boards inside the cycle (the strongest "single decision-maker" signal) | [`server.js`](server.js) `getDirectorOverlap()` |
| **Forensic memo** | Claude-generated 3-paragraph investigation memo per loop, naming classifications + controlling directors | [`server.js`](server.js) `generateMemo()` |
| **Production UI** | Government-grade 3-panel console, mobile + desktop responsive | [`public/index.html`](public/index.html) |

### What we explicitly do NOT do

- We do not re-detect loops (that's already done in `CRA/scripts/advanced/`).
- We do not write back to the database — read-only investigation surface.
- We do not pull external data (no media, no policy docs).

---

## Status of `app/` Itself

| Component | Status |
|---|---|
| Backend endpoints (`/api/loops`, `/api/loop/:id`, `/api/investigate/:id`, `/api/verdicts`) | Done |
| Public Recipients endpoints (`/api/recipients/top`, `/api/recipients/search`, `/api/recipient/:name`) | Done |
| Public Recipients page (`/entities.html`) — non-charity FED + AB rollup | Done |
| Topbar nav linking the two views | Done |
| Classification matview integration (graceful fallback if missing) | Done |
| Director-overlap query | Done |
| Claude memo pre-generation at startup | Done |
| D3 force-directed graph with classification rings | Done |
| Production-grade UI redesign (institutional palette, no gimmicks) | Done |
| Mobile + 1440 + 1920px responsive breakpoints | Done |
| Skeleton loading + tooltip + verdict chips | Done |

### Pre-flight checklist for demo day

1. `psql "$DATABASE_URL" -f CRA/sql/10-loop-classification.sql` — build the classification matview.
2. `cd app && npm install && npm start` — boots Express on the configured port.
3. Watch the console: memos pre-generate at startup so the first click is instant.

---

## How `app/` Fits Into the Bigger Repo

```
agency-26-hackathon-main/
├── CRA/          ← all the T3010 ETL + loop-detection scripts (data layer)
├── FED/          ← federal grants/contracts (used for the grants panel)
├── AB/           ← Alberta data (not used by this app)
├── general/      ← entity resolution / golden records (not used by this app)
├── global-fit/   ← config-driven multi-challenge platform (parallel track, not this app)
└── app/          ← THIS — single-purpose Challenge 3 demo
```

`global-fit/` and `app/` are two different UIs. **`app/` is the focused C3 demo we're presenting.**

---

## At a Glance

- **Primary challenge:** C3 Funding Loops — **100%**
- **Supporting challenges in same UI:**
  - C6 Related Parties — **~45%** (director-overlap)
  - C8 Duplicative Funding — **~55%** (federal grants panel)
  - C2 Ghost Capacity — **~45%** (overhead-extraction classification)
- **Why one app covers four challenges:** the funding loop is the *vehicle*, but the same circular flow doubles as evidence of shared directors (C6), public money entering the loop (C8), and overhead-extraction shells (C2). One investigation surface, four angles of accountability.
- **Beyond charities:** the Public Recipients view extends the same accountability lens to companies, NGOs, universities, and individuals — anyone receiving federal grants/contributions or Alberta procurement/sole-source/grants — without overlapping the charity scope already covered.
- **Remaining work:** demo polish, narrative talking points, pre-flight db check.
