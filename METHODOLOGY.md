# Methodology — How "Follow The Money" Classifies Funding Loops

> A short, auditable explanation of how this app decides what counts as suspicious. Every threshold below comes directly from [`CRA/sql/10-loop-classification.sql`](../CRA/sql/10-loop-classification.sql) and the analytical framework in [`CRA/CLAUDE.md`](../CRA/CLAUDE.md).

---

## The Core Question

A "funding loop" is a chain of charities where money flows **A → B → C → A** (or a longer cycle). Loops are **not** automatically suspicious — many are structurally expected (denominational tithes, federated United Way redistribution, foundation endowments). The hard part is **distinguishing structurally normal loops from suspicious ones**.

This app classifies every charity in every detected loop into one of **five buckets**, then ranks each loop by its worst-classified participant.

---

## Why CRA Designation Matters First

The single most important context is the charity's CRA **designation type** — applying the same expectations to a public foundation (A) and a charitable organization (C) produces misleading results.

| Designation | What it is | Are circular flows expected? |
|---|---|---|
| **A — Public Foundation** | Funds other charities; >50% arm's-length directors and donors | **Yes** — endowment grant cycles are normal |
| **B — Private Foundation** | Like A but with non-arm's-length directors/donors (often family or corporate) | **Yes** — strongest structural expectation for circular flows |
| **C — Charitable Organization** | Spends >50% on charitable activities it carries out itself (~80% of all charities) | **No** — circular flows have no structural explanation |

**The suspicion bar is fundamentally different.** A high-scoring Designation A foundation may still be operating normally. A high-scoring Designation C charity has no structural cover.

---

## The Five Classification Buckets

Buckets are evaluated in priority order — the **first** rule that matches wins. This means structural exemptions are checked *before* suspicion rules, so legitimate hierarchies are not flagged.

### 1. `structural` — Loops are structurally expected

These charities are **excluded from suspicion** because their organizational form makes circular flows normal.

A charity is `structural` when **any** of:
- **Designation A** (public foundation) AND overhead ratio ≤ 40%
- **Designation B** (private foundation) AND overhead ratio ≤ 40%
- **Category 0210** (community foundation) AND overhead ratio ≤ 50%
- **Category 0030–0090** (denominational/religious) AND ≥ 3 affiliated siblings (sharing the same 9-digit BN prefix) also appearing in loops

### 2. `overhead_extraction` — Each hop skims compensation/admin

Pattern: every step in the loop loses money to overhead, suggesting the loop's *purpose* is to extract operating fees.

A charity is `overhead_extraction` when **either**:
- Overhead ratio > **40%** AND total risk score ≥ **10/30**
- Compensation > program spending (with program spending > 0) AND total risk score ≥ **10/30**

### 3. `receipt_generation` — Receipts without programs

Pattern: a Designation C charity with circular flows but minimal programmatic output — consistent with generating donation tax receipts without delivering charitable activity.

A charity is `receipt_generation` when **all** of:
- Designation = **C** (charitable organization, not a foundation)
- Program ratio < **30%** of revenue
- Total risk score ≥ **10/30**
- Revenue > **$100,000** (excludes trivial cases)

### 4. `revenue_inflation` — Same dollar passed around to inflate top-line

Pattern: pass-through entity counting the same dollar as both incoming and outgoing gift, inflating reported revenue.

A charity is `revenue_inflation` when **either**:
- Designation C AND charity-funded ratio > **50%** AND gifts in > **$50K** AND gifts out > **$50K**
- Designation C AND temporal score ≥ **8** (high same-year roundtrip activity)

### 5. `low_risk` — Default

Charities that participate in cycles but match no concerning pattern.

---

## Scoring Components (the "Total Score" referenced above)

Each charity in `cra.loop_universe` has a deterministic 0–30 score from `CRA/scripts/advanced/02-score-universe.js`, broken into:

- **Circular score** — depth and number of cycles the charity participates in
- **Financial score** — proportion of revenue moving in cycles, overhead ratios
- **Temporal score** — concentration of same-year (vs cross-year) reciprocal flows

Same-year symmetric flows are the sharpest signal. Two charities sending each other similar amounts in the *same* fiscal year — both counting it as a qualifying disbursement — is the strongest indicator of quota gaming when there's no joint program to justify it.

---

## How Loop-Level Classification Works

Loops have multiple participants. The app picks the **worst-classified charity** in the loop using this rank order:

| Rank | Classification | Color |
|:-:|---|---|
| 4 | `overhead_extraction`, `receipt_generation` | Red |
| 3 | `revenue_inflation` | Amber |
| 1 | `low_risk` | Green |
| 0 | `structural` | Neutral |

A loop is shown with the most severe classification of any of its members. This is intentional: one bad actor in a chain is enough to make the chain worth investigating.

---

## Loop Leakage Rate (Per-Loop Financial Depth)

For each loop, the app computes a **leakage rate** that answers the briefing's headline question: *"If $1 enters this loop, how much actually reaches a charitable purpose, and how much is absorbed at each hop?"*

The model treats one bottleneck dollar travelling once around the cycle. At each charity, the dollar is split according to the charity's most recent rolled-up T3010 spending mix, taken from `cra.loop_charity_financials` (one row per loop participant, pre-aggregated):

| Bucket | Treated as |
|---|---|
| `program_spending` (own charitable activities) | **Useful** |
| `gifts_given_donees` (grants to other qualified donees) | **Useful** |
| `compensation_spending` | Leakage |
| `admin_spending` | Leakage |
| `fundraising_spending` | Leakage |

**Why count gifts-to-donees as useful?** Foundations (designation A and B) are explicitly structured to *not* run their own programs — they distribute via grants. A purist "programs only" model would mark every grant-making network as 100% leakage, which is wrong by design. The model rewards the dollar reaching either an operating program or another qualified donee that can run one.

The headline rate is `1 - sum(useful) / sum(useful + leakage)` across every unique BN in the loop. The per-hop waterfall under the network graph shows the same five-segment split per participant, with a designation chip (`PubF` / `PF` / `OpC`) so it's obvious why a foundation has high gifts-given vs. low programs.

**Severity bands** (banner color):
- **≥ 70% leakage** → critical (red)
- **40–70%** → warning (amber)
- **< 40%** → ok (green)

**What this does *not* do:** the model does not track whether `gifts_given_donees` flow inside or outside the loop. A grant from A to B that's also in the loop is still counted as "useful at A's hop" — the loop-level rate then aggregates honestly across all hops, but a more advanced flow-conserving model would distinguish trapped-in-loop dollars from escaped-to-real-programs dollars. That's a future refinement.

---

## Director Overlap (Independent Signal)

Independent of the buckets above, the app surfaces directors who sit on **2 or more** boards inside the same loop (using `cra.cra_directors`, fpe ≥ 2022-01-01). A single individual on multiple boards inside a single cycle is the strongest possible signal that the cycle is operated by one decision-maker — regardless of classification bucket.

This appears in the right panel as "Controlling Individuals" when present.

---

## Cross-Dataset Enrichment (Golden Records)

Each charity BN is joined against `general.entity_golden_records` (entity-resolved across CRA, FED, AB datasets). Where a match exists, the tooltip surfaces:
- Whether the charity also appears in **federal grant** records
- Whether the charity also appears in **Alberta** records
- Up to 2 known aliases / former names

This catches the "renamed shell" pattern and shows when public funds enter the loop from outside the CRA dataset.

---

## What This Methodology Does *Not* Do

- It does not allege wrongdoing. Every classification is a statistical pattern, not a verdict.
- It does not adjudicate intent. A `receipt_generation` charity may have a legitimate explanation a forensic accountant should investigate.
- It does not rank by dollar size — pattern matters more than magnitude. A $10K round-trip at 100% same-year symmetry is a clearer signal than a $5M asymmetric flow.
- It does not use the CRA "associated donee" self-reported flag as evidence — its absence does not mean entities are independent.

---

## Reproducibility

Anyone can audit the exact loop set this app classifies:

```
GET /api/loops.csv         # full ranked list with classifications + BN paths
GET /api/summary           # aggregate counts + dollars per bucket
GET /api/health            # DB + matview + golden-records availability
```

The classification matview itself can be rebuilt at any time:

```
psql "$DATABASE_URL" -f CRA/sql/10-loop-classification.sql
```

---

## References

- [`CRA/CLAUDE.md`](../CRA/CLAUDE.md) — full analytical framework, designation context, what makes the most insightful analysis
- [`CRA/sql/10-loop-classification.sql`](../CRA/sql/10-loop-classification.sql) — the matview definition (every threshold above lives here)
- [`situation.md`](../situation.md) — repo-wide challenge tracker
- [`app/PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) — what this app is and what it covers
