require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
const { execSync } = require('child_process');
const { cacheGet, cacheSet, cacheCount, close: closeCache } = require('./lib/cache');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database ---
// Pool max raised from default 10 -> 25 because /api/loop/:id fans out 7
// parallel queries; with pre-warm and memo gen running concurrently the
// default pool was the bottleneck (queries queueing for connections, not
// the DB itself).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'YOUR_CONNECTION_STRING',
  ssl: { rejectUnauthorized: false },
  max: parseInt(process.env.PG_POOL_MAX, 10) || 25,
  idleTimeoutMillis: 30000,
});

// Hosted Postgres (e.g. Render free tier) periodically drops idle connections.
// Without this handler, the 'error' event from an idle client bubbles up as
// an unhandled rejection and crashes the process. The pool will create a
// fresh connection on the next query.
pool.on('error', (err) => {
  console.warn('[pg] idle client error (recovered):', err.message);
});

// --- Gemini (Google) ---
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

// --- Token usage tracking (Gemini) ---
const tokenUsage = { calls: 0, prompt: 0, output: 0, total: 0 };
async function geminiCall(opts, label = 'gemini') {
  const response = await genai.models.generateContent(opts);
  const u = response.usageMetadata || {};
  const p = u.promptTokenCount || 0;
  const c = u.candidatesTokenCount || 0;
  const t = u.totalTokenCount || (p + c);
  tokenUsage.calls += 1;
  tokenUsage.prompt += p;
  tokenUsage.output += c;
  tokenUsage.total += t;
  console.log(
    `[gemini:${label}] +${t} tokens (prompt ${p}, output ${c}) ` +
    `| session: ${tokenUsage.calls} calls, ${tokenUsage.total} tokens ` +
    `(prompt ${tokenUsage.prompt}, output ${tokenUsage.output})`
  );
  return response;
}

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve the methodology doc directly (lives outside public/ on purpose)
app.get('/METHODOLOGY.md', (req, res) => {
  res.sendFile(path.join(__dirname, 'METHODOLOGY.md'));
});

// --- Caches ---
const memoCache = new Map();   // id -> { memo, verdict, loopId, generated_at }
let cachedLoops = [];          // top 20 loops loaded at startup
let pregenProgress = { done: 0, total: 0 };
const startTime = Date.now();

// --- Disk persistence for memoCache ---
// Memos are expensive to regenerate (Gemini token spend) and rarely change,
// since they're keyed on loop ID and the underlying matviews refresh nightly
// at most. Persisting to disk means a deploy/restart doesn't re-pay for the
// top-N memos that pregen already produced.
const CACHE_DIR = path.join(__dirname, 'cache');
const MEMO_CACHE_FILE = path.join(CACHE_DIR, 'memos.json');
let memoWriteQueue = Promise.resolve();

function loadMemoCacheFromDisk() {
  try {
    if (!fs.existsSync(MEMO_CACHE_FILE)) return 0;
    const raw = fs.readFileSync(MEMO_CACHE_FILE, 'utf8');
    if (!raw.trim()) return 0;
    const parsed = JSON.parse(raw);
    let count = 0;
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.memo === 'string' && entry.verdict) {
        memoCache.set(id, entry);
        count++;
      }
    }
    return count;
  } catch (err) {
    console.warn(`[memoCache] disk load failed (${err.message}) — starting empty.`);
    return 0;
  }
}

// Atomic write: serialize all writes through a queue, write to a tmp file,
// then rename. Rename is atomic on POSIX, so a crash mid-write can't leave
// memos.json half-written.
function persistMemoCache() {
  memoWriteQueue = memoWriteQueue.then(async () => {
    try {
      await fsp.mkdir(CACHE_DIR, { recursive: true });
      const snapshot = Object.fromEntries(memoCache);
      const tmp = MEMO_CACHE_FILE + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(snapshot), 'utf8');
      await fsp.rename(tmp, MEMO_CACHE_FILE);
    } catch (err) {
      console.warn('[memoCache] disk write failed:', err.message);
    }
  });
  return memoWriteQueue;
}

// ============================================================
// Helper: resolve BN array to charity profiles (most recent year)
// ============================================================
async function resolveProfiles(bns) {
  if (!bns.length) return [];
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (bn) bn, legal_name, city, province, category_name
    FROM cra.vw_charity_profiles
    WHERE bn = ANY($1)
    ORDER BY bn, fiscal_year DESC
  `, [bns]);
  return rows;
}

// ============================================================
// Helper: get overhead data for BNs
// ============================================================
async function getOverhead(bns) {
  if (!bns.length) return [];
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (o.bn)
           o.bn,
           o.revenue AS total_revenue,
           o.strict_overhead_pct,
           g.federal AS federal_government_revenue,
           g.provincial AS provincial_government_revenue,
           g.govt_share_of_rev
    FROM cra.overhead_by_charity o
    LEFT JOIN cra.govt_funding_by_charity g
      ON o.bn = g.bn AND o.fiscal_year = g.fiscal_year
    WHERE o.bn = ANY($1)
    ORDER BY o.bn, o.fiscal_year DESC
  `, [bns]);
  return rows;
}

// ============================================================
// Helper: per-BN spending breakdown for loop participants.
// Reads cra.loop_charity_financials, which is a pre-aggregated
// view (one row per BN that participates in any loop) with named
// rollups for programs, compensation, admin, fundraising, and
// gifts-given-to-other-qualified-donees. Foundations distribute
// almost entirely via gifts_given_donees rather than running
// their own programs, so this column is critical to model them
// correctly.
// ============================================================
async function getLoopFinancials(bns) {
  if (!bns.length) return {};
  try {
    const { rows } = await pool.query(`
      SELECT bn, designation, category,
             COALESCE(program_spending, 0)::numeric       AS program_spending,
             COALESCE(gifts_given_donees, 0)::numeric     AS gifts_given_donees,
             COALESCE(compensation_spending, 0)::numeric  AS compensation_spending,
             COALESCE(admin_spending, 0)::numeric         AS admin_spending,
             COALESCE(fundraising_spending, 0)::numeric   AS fundraising_spending,
             COALESCE(total_expenditures, 0)::numeric     AS total_expenditures,
             COALESCE(revenue, 0)::numeric                AS revenue
      FROM cra.loop_charity_financials
      WHERE bn = ANY($1)
    `, [bns]);
    return Object.fromEntries(rows.map(r => {
      const programs = Number(r.program_spending) || 0;
      const gifts = Number(r.gifts_given_donees) || 0;
      const comp = Number(r.compensation_spending) || 0;
      const admin = Number(r.admin_spending) || 0;
      const fundraising = Number(r.fundraising_spending) || 0;
      // Useful = dollars that left this charity for a charitable purpose
      // (its own programs OR a grant to another qualified donee).
      // Leakage = absorbed by the charity's own operating costs.
      const useful = programs + gifts;
      const leakage = comp + admin + fundraising;
      const denom = useful + leakage;
      return [r.bn, {
        designation: r.designation,
        category: r.category,
        program_spending: programs,
        gifts_given_donees: gifts,
        compensation_spending: comp,
        admin_spending: admin,
        fundraising_spending: fundraising,
        total_expenditures: Number(r.total_expenditures) || 0,
        revenue: Number(r.revenue) || 0,
        program_share: denom > 0 ? programs / denom : 0,
        gifts_share: denom > 0 ? gifts / denom : 0,
        comp_share: denom > 0 ? comp / denom : 0,
        admin_share: denom > 0 ? admin / denom : 0,
        fundraising_share: denom > 0 ? fundraising / denom : 0,
        useful_share: denom > 0 ? useful / denom : 0,
      }];
    }));
  } catch (err) {
    console.error('getLoopFinancials error:', err.message);
    return {};
  }
}

// ============================================================
// Helper: build loop leakage rate + per-hop waterfall.
// Models the bottleneck dollar moving once around the cycle:
// at each node a fraction reaches programs or is granted onward
// to a qualified donee (both "useful"); the rest leaks to comp,
// admin, and fundraising.
// ============================================================
function computeLeakage(bns, finMap, bottleneckAmt) {
  const start = Number(bottleneckAmt) || 0;
  const waterfall = [];
  let totalPrograms = 0;
  let totalGifts = 0;
  let totalComp = 0;
  let totalAdmin = 0;
  let totalFundraising = 0;
  let surviving = start;

  for (const bn of bns) {
    const s = finMap[bn];
    const inAmt = surviving;
    const programShare = s ? s.program_share : 0;
    const giftsShare = s ? s.gifts_share : 0;
    const compShare = s ? s.comp_share : 0;
    const adminShare = s ? s.admin_share : 0;
    const fundraisingShare = s ? s.fundraising_share : 0;

    const programAmt = inAmt * programShare;
    const giftsAmt = inAmt * giftsShare;
    const compAmt = inAmt * compShare;
    const adminAmt = inAmt * adminShare;
    const fundraisingAmt = inAmt * fundraisingShare;
    const usefulAmt = programAmt + giftsAmt;

    totalPrograms += programAmt;
    totalGifts += giftsAmt;
    totalComp += compAmt;
    totalAdmin += adminAmt;
    totalFundraising += fundraisingAmt;

    waterfall.push({
      bn,
      designation: s ? s.designation : null,
      in_amt: inAmt,
      in_amt_fmt: formatCurrency(inAmt),
      program_amt: programAmt,
      program_amt_fmt: formatCurrency(programAmt),
      gifts_amt: giftsAmt,
      gifts_amt_fmt: formatCurrency(giftsAmt),
      comp_amt: compAmt,
      comp_amt_fmt: formatCurrency(compAmt),
      admin_amt: adminAmt,
      admin_amt_fmt: formatCurrency(adminAmt),
      fundraising_amt: fundraisingAmt,
      fundraising_amt_fmt: formatCurrency(fundraisingAmt),
      useful_amt: usefulAmt,
      useful_amt_fmt: formatCurrency(usefulAmt),
      program_share: programShare,
      gifts_share: giftsShare,
      comp_share: compShare,
      admin_share: adminShare,
      fundraising_share: fundraisingShare,
      has_data: !!s,
    });

    // Whatever wasn't absorbed continues to the next hop.
    surviving = inAmt - programAmt - giftsAmt - compAmt - adminAmt - fundraisingAmt;
    if (surviving < 0) surviving = 0;
  }

  // Headline rate: across all hops, what fraction of the dollar
  // was absorbed by operating costs vs. reached a charitable purpose
  // (own programs or a grant to another qualified donee).
  const totalUseful = totalPrograms + totalGifts;
  const totalLeaked = totalComp + totalAdmin + totalFundraising;
  const denom = totalUseful + totalLeaked;
  const leakageRate = denom > 0 ? 1 - (totalUseful / denom) : null;
  const dataCoverage = bns.length
    ? waterfall.filter(w => w.has_data).length / bns.length
    : 0;

  return {
    bottleneck_input: start,
    bottleneck_input_fmt: formatCurrency(start),
    program_dollars: totalPrograms,
    program_dollars_fmt: formatCurrency(totalPrograms),
    gifts_dollars: totalGifts,
    gifts_dollars_fmt: formatCurrency(totalGifts),
    useful_dollars: totalUseful,
    useful_dollars_fmt: formatCurrency(totalUseful),
    leaked_dollars: totalLeaked,
    leaked_dollars_fmt: formatCurrency(totalLeaked),
    comp_dollars: totalComp,
    comp_dollars_fmt: formatCurrency(totalComp),
    admin_dollars: totalAdmin,
    admin_dollars_fmt: formatCurrency(totalAdmin),
    fundraising_dollars: totalFundraising,
    fundraising_dollars_fmt: formatCurrency(totalFundraising),
    leakage_rate: leakageRate,
    leakage_pct: leakageRate != null ? Math.round(leakageRate * 1000) / 10 : null,
    data_coverage: dataCoverage,
    waterfall,
  };
}

// ============================================================
// Helper: classify charities (4-bucket classifier)
// Reads cra.loop_classification matview if present; otherwise falls
// back to a degraded result so the UI still renders.
// ============================================================
let classificationViewAvailable = null; // tri-state: null=untested, true/false

async function probeClassificationView() {
  if (classificationViewAvailable !== null) return classificationViewAvailable;
  try {
    await pool.query('SELECT 1 FROM cra.loop_classification LIMIT 1');
    classificationViewAvailable = true;
  } catch {
    console.warn('cra.loop_classification not found — classification chips will be blank.');
    console.warn('Run: psql "$DATABASE_URL" -f CRA/sql/10-loop-classification.sql');
    classificationViewAvailable = false;
  }
  return classificationViewAvailable;
}

const CLASSIFICATION_RANK = {
  overhead_extraction: 4,
  receipt_generation: 4,
  revenue_inflation: 3,
  low_risk: 1,
  structural: 0,
};

const CLASSIFICATION_LABEL = {
  overhead_extraction: 'Overhead Extraction',
  receipt_generation: 'Receipt Generation',
  revenue_inflation: 'Revenue Inflation',
  low_risk: 'Low Risk',
  structural: 'Structural',
};

async function getClassifications(bns) {
  if (!bns.length) return {};
  if (!(await probeClassificationView())) return {};
  try {
    const { rows } = await pool.query(`
      SELECT bn, classification, severity, total_score,
             designation, category_code,
             ROUND((overhead_ratio * 100)::numeric, 1) AS overhead_pct,
             ROUND((program_ratio * 100)::numeric, 1) AS program_pct
      FROM cra.loop_classification
      WHERE bn = ANY($1)
    `, [bns]);
    return Object.fromEntries(rows.map(r => [r.bn, r]));
  } catch (err) {
    console.error('getClassifications error:', err.message);
    return {};
  }
}

function worstClassification(classMap, bns) {
  let worst = null;
  let worstRank = -1;
  for (const bn of bns) {
    const c = classMap[bn];
    if (!c) continue;
    const rank = CLASSIFICATION_RANK[c.classification] ?? 0;
    if (rank > worstRank) {
      worstRank = rank;
      worst = c.classification;
    }
  }
  return worst || 'low_risk';
}

// ============================================================
// Helper: batched director map for the leaderboard.
// Returns: directorName -> Set(bn). One query for the whole cohort.
// ============================================================
async function getDirectorBNsMap(bns) {
  if (bns.length < 2) return new Map();
  try {
    const { rows } = await pool.query(`
      SELECT
        UPPER(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) AS director_name,
        bn
      FROM cra.cra_directors
      WHERE bn = ANY($1)
        AND fpe >= '2022-01-01'
        AND first_name IS NOT NULL
        AND last_name IS NOT NULL
        AND TRIM(COALESCE(first_name, '') || COALESCE(last_name, '')) <> ''
    `, [bns]);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.director_name)) map.set(r.director_name, new Set());
      map.get(r.director_name).add(r.bn);
    }
    return map;
  } catch (err) {
    console.error('getDirectorBNsMap error:', err.message);
    return new Map();
  }
}

function countSharedDirectors(directorMap, loopBNs) {
  if (!directorMap || directorMap.size === 0 || loopBNs.length < 2) return 0;
  const loopSet = new Set(loopBNs);
  let count = 0;
  for (const bnSet of directorMap.values()) {
    let hits = 0;
    for (const bn of bnSet) {
      if (loopSet.has(bn)) {
        hits++;
        if (hits >= 2) { count++; break; }
      }
    }
  }
  return count;
}

// ============================================================
// Helper: directors who sit on 2+ boards inside this cycle
// (the "boss-level finale" — controlling individuals)
// ============================================================
async function getDirectorOverlap(bns) {
  if (bns.length < 2) return [];
  try {
    const { rows } = await pool.query(`
      WITH recent AS (
        SELECT
          bn,
          UPPER(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) AS director_name
        FROM cra.cra_directors
        WHERE bn = ANY($1)
          AND fpe >= '2022-01-01'
          AND first_name IS NOT NULL
          AND last_name IS NOT NULL
          AND TRIM(COALESCE(first_name, '') || COALESCE(last_name, '')) <> ''
      ),
      grouped AS (
        SELECT director_name,
               COUNT(DISTINCT bn) AS boards_in_cycle,
               ARRAY_AGG(DISTINCT bn) AS bns
        FROM recent
        GROUP BY director_name
      )
      SELECT director_name, boards_in_cycle, bns
      FROM grouped
      WHERE boards_in_cycle >= 2
      ORDER BY boards_in_cycle DESC, director_name
      LIMIT 20
    `, [bns]);
    return rows;
  } catch (err) {
    console.error('getDirectorOverlap error:', err.message);
    return [];
  }
}

// ============================================================
// Helper: golden-records enrichment — cross-dataset context
// Returns map: bn -> { dataset_sources, aliases, related_count }
// Tri-state probe so the app degrades gracefully without general schema.
// ============================================================
let goldenViewAvailable = null;

async function probeGoldenView() {
  if (goldenViewAvailable !== null) return goldenViewAvailable;
  try {
    await pool.query('SELECT 1 FROM general.entity_golden_records LIMIT 1');
    goldenViewAvailable = true;
  } catch {
    console.warn('general.entity_golden_records not found — cross-dataset enrichment disabled.');
    goldenViewAvailable = false;
  }
  return goldenViewAvailable;
}

async function getGoldenEnrichment(bns) {
  if (!bns.length) return {};
  if (!(await probeGoldenView())) return {};
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(bn_root, bn_v) AS bn,
        canonical_name,
        dataset_sources,
        aliases,
        jsonb_array_length(COALESCE(related_entities, '[]'::jsonb)) AS related_count,
        CASE WHEN fed_profile IS NOT NULL AND fed_profile <> '{}'::jsonb THEN true ELSE false END AS in_fed,
        CASE WHEN ab_profile  IS NOT NULL AND ab_profile  <> '{}'::jsonb THEN true ELSE false END AS in_ab
      FROM general.entity_golden_records,
           LATERAL UNNEST(COALESCE(bn_variants, ARRAY[]::text[]) || ARRAY[bn_root]) AS bn_v
      WHERE bn_root = ANY($1) OR bn_v = ANY($1)
    `, [bns]);
    const map = {};
    for (const r of rows) {
      if (!r.bn) continue;
      // Prefer the row that actually matched a requested BN
      const matchBn = bns.includes(r.bn) ? r.bn : bns.find(b => b === r.bn);
      if (!matchBn) continue;
      const aliasArr = Array.isArray(r.aliases) ? r.aliases.slice(0, 3).map(a => typeof a === 'string' ? a : (a?.name || '')).filter(Boolean) : [];
      map[matchBn] = {
        canonical_name: r.canonical_name,
        dataset_sources: r.dataset_sources || [],
        aliases: aliasArr,
        related_count: Number(r.related_count) || 0,
        in_fed: r.in_fed,
        in_ab: r.in_ab,
      };
    }
    return map;
  } catch (err) {
    console.error('getGoldenEnrichment error:', err.message);
    return {};
  }
}

// ============================================================
// Helper: get federal grants for BNs (basic — used by memo)
// ============================================================
async function getFederalGrants(bns) {
  if (!bns.length) return [];
  const { rows } = await pool.query(`
    SELECT recipient_business_number AS bn,
           agreement_value,
           owner_org,
           agreement_title_en
    FROM fed.grants_contributions
    WHERE recipient_business_number = ANY($1)
    LIMIT 50
  `, [bns]);
  return rows;
}

// ============================================================
// Helper: get detailed federal grants for BNs (for panel)
// ============================================================
async function getDetailedFederalGrants(bns) {
  if (!bns.length) return { grants: [], total: 0, dept_count: 0, has_grants: false };
  try {
    const { rows } = await pool.query(`
      SELECT
        g.recipient_legal_name,
        g.recipient_business_number,
        g.owner_org_title,
        g.prog_name_en,
        g.agreement_title_en,
        g.agreement_value,
        g.agreement_start_date,
        g.agreement_end_date
      FROM fed.grants_contributions g
      WHERE g.recipient_business_number = ANY($1)
        AND g.agreement_value > 0
      ORDER BY g.agreement_value DESC
      LIMIT 50
    `, [bns]);

    const total = rows.reduce((s, r) => s + (Number(r.agreement_value) || 0), 0);
    const depts = new Set(rows.map(r => r.owner_org_title).filter(Boolean));

    return {
      grants: rows.map(r => ({
        recipient_legal_name: r.recipient_legal_name,
        recipient_business_number: r.recipient_business_number,
        owner_org_title: r.owner_org_title,
        prog_name_en: r.prog_name_en,
        agreement_title_en: r.agreement_title_en,
        agreement_value: r.agreement_value != null ? Number(r.agreement_value) : null,
        agreement_start_date: r.agreement_start_date,
        agreement_end_date: r.agreement_end_date,
      })),
      total,
      total_fmt: formatCurrency(total),
      dept_count: depts.size,
      has_grants: rows.length > 0,
    };
  } catch (err) {
    console.error('Federal grants query error:', err.message);
    return { grants: [], total: 0, total_fmt: '$0', dept_count: 0, has_grants: false };
  }
}

// ============================================================
// Helper: parse BNs from path_display
// ============================================================
function parseBNs(pathDisplay) {
  return pathDisplay.split('→').map(s => s.trim()).filter(Boolean);
}

// ============================================================
// Helper: check if all BNs share the same 9-digit root
// ============================================================
function isFederatedTransfer(bns) {
  if (bns.length === 0) return false;
  const root = bns[0].substring(0, 9);
  return bns.every(bn => bn.substring(0, 9) === root);
}

// ============================================================
// Helper: format currency
// ============================================================
function formatCurrency(val) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

// ============================================================
// Helper: parse verdict string to canonical form
// ============================================================
// Strip letter-style artifacts (salutation, sender block, signature) in case
// the model ignores the "no letter" instruction and slips them in.
function stripLetterFormat(text) {
  if (!text) return text;
  let t = text.trim();
  const lines = t.split('\n');
  let i = 0;
  const headerPattern = /^\s*(date|to|from|subject|re|cc|bcc|attn|attention|memo to|memorandum)\s*[:\-]/i;
  const salutation = /^\s*(dear|to whom it may concern|hello|hi|greetings)\b/i;
  while (i < lines.length && (headerPattern.test(lines[i]) || salutation.test(lines[i]) || lines[i].trim() === '')) {
    i++;
  }
  t = lines.slice(i).join('\n').trim();
  // Trailing signature/closing block.
  t = t.replace(
    /\n\s*(sincerely|regards|best regards|yours( truly| sincerely)?|respectfully|signed)[^\n]*(\n[^\n]*){0,4}\s*$/i,
    ''
  ).trim();
  return t;
}

function parseVerdict(memoText) {
  const verdictMatch = memoText.match(/\[VERDICT:\s*(.*?)\]/);
  if (verdictMatch) {
    const raw = verdictMatch[1].trim().toUpperCase();
    if (raw.includes('BENIGN')) return 'BENIGN';
    if (raw.includes('RED FLAG')) return 'RED FLAG';
  }
  // Also try without brackets
  if (memoText.includes('RED FLAG')) return 'RED FLAG';
  if (memoText.includes('LIKELY BENIGN')) return 'BENIGN';
  return 'SCRUTINY';
}

// ============================================================
// Shared investigation logic (used by endpoint and pre-gen)
// ============================================================
async function generateMemo(loopId) {
  const key = String(loopId);
  if (memoCache.has(key)) return memoCache.get(key);

  const { rows } = await pool.query(`
    SELECT pc.id, pc.hops, pc.total_flow, pc.bottleneck_amt,
           pc.path_display, pc.min_year, pc.max_year
    FROM cra.partitioned_cycles pc WHERE pc.id = $1
  `, [loopId]);

  if (!rows.length) throw new Error('Loop not found');

  const loop = rows[0];
  const bns = parseBNs(loop.path_display);

  const uniqBns = [...new Set(bns)];

  const [profiles, overhead, grants, classMap, directors, golden, finMap] = await Promise.all([
    resolveProfiles(bns),
    getOverhead(bns),
    getFederalGrants(bns),
    getClassifications(bns),
    getDirectorOverlap(bns),
    getGoldenEnrichment(bns),
    getLoopFinancials(uniqBns),
  ]);

  const leakage = computeLeakage(uniqBns, finMap, loop.bottleneck_amt);

  const profileMap = Object.fromEntries(profiles.map(p => [p.bn, p]));
  const overheadMap = Object.fromEntries(overhead.map(o => [o.bn, o]));

  const orgData = bns.map(bn => {
    const c = classMap[bn] || {};
    const g = golden[bn] || {};
    return {
      bn,
      legal_name: profileMap[bn]?.legal_name || bn,
      city: profileMap[bn]?.city,
      province: profileMap[bn]?.province,
      category_name: profileMap[bn]?.category_name,
      designation: c.designation || null,
      classification: c.classification || null,
      classification_label: c.classification ? CLASSIFICATION_LABEL[c.classification] : null,
      risk_score: c.total_score != null ? Number(c.total_score) : null,
      overhead_pct: c.overhead_pct != null ? Number(c.overhead_pct) : null,
      program_pct: c.program_pct != null ? Number(c.program_pct) : null,
      total_revenue: overheadMap[bn]?.total_revenue || null,
      federal_government_revenue: overheadMap[bn]?.federal_government_revenue || null,
      provincial_government_revenue: overheadMap[bn]?.provincial_government_revenue || null,
      strict_overhead_pct: overheadMap[bn]?.strict_overhead_pct || null,
      has_federal_grants: grants.some(grant => grant.bn === bn),
      // Cross-dataset golden-record enrichment
      aliases: g.aliases || [],
      dataset_sources: g.dataset_sources || [],
      cross_dataset_count: (g.in_fed ? 1 : 0) + (g.in_ab ? 1 : 0),
    };
  });

  // Compute federal grants total for AI context
  const fedGrantsTotal = grants.reduce((s, g) => s + (Number(g.agreement_value) || 0), 0);

  // Resolve director overlap to readable form (with charity names attached)
  const directorContext = directors.map(d => ({
    director_name: d.director_name,
    boards_in_cycle: d.boards_in_cycle,
    charities: d.bns.map(bn => profileMap[bn]?.legal_name || bn),
  }));

  const loopData = {
    total_flow: loop.total_flow,
    bottleneck_amt: loop.bottleneck_amt,
    year_range: `${loop.min_year}-${loop.max_year}`,
    hops: loop.hops,
    worst_classification: CLASSIFICATION_LABEL[worstClassification(classMap, bns)] || 'Low Risk',
    organizations: orgData,
    leakage: {
      bottleneck_input_fmt: leakage.bottleneck_input_fmt,
      program_dollars_fmt: leakage.program_dollars_fmt,
      gifts_dollars_fmt: leakage.gifts_dollars_fmt,
      useful_dollars_fmt: leakage.useful_dollars_fmt,
      leaked_dollars_fmt: leakage.leaked_dollars_fmt,
      comp_dollars_fmt: leakage.comp_dollars_fmt,
      admin_dollars_fmt: leakage.admin_dollars_fmt,
      fundraising_dollars_fmt: leakage.fundraising_dollars_fmt,
      leakage_pct: leakage.leakage_pct,
      data_coverage: leakage.data_coverage,
      note: 'useful_dollars = own programs + gifts to other qualified donees. Foundations distribute almost entirely via gifts_given_donees, so do NOT treat low program_dollars as leakage on its own.',
    },
    federal_grants_total: fedGrantsTotal,
    federal_grants: grants.map(g => ({
      bn: g.bn,
      org: profileMap[g.bn]?.legal_name || g.bn,
      agreement_value: g.agreement_value,
      owner_org: g.owner_org,
      agreement_title: g.agreement_title_en,
    })),
    controlling_directors: directorContext,
  };

  const prompt = `You are a forensic accountant reviewing a circular charity funding pattern for a Canadian government accountability investigation. Produce a tight bulleted signal list — NOT prose.
 
OUTPUT FORMAT (strict):
- Each line is one bullet starting with "- ".
- Every bullet has TWO parts separated by " | Source: ":
  - The SIGNAL: a 12-25 word clause naming the red flag, structural exemption, or absence of concern. Lead with the strongest evidence first.
  - The SOURCE: which database table/column or computed metric produced this evidence. Use the canonical names from the DATA SOURCES list below.
- 4 to 8 bullets total. Stop when you run out of meaningful signals — do not pad.
- No salutation, no headers, no paragraphs, no closing remarks, no "Sincerely". No markdown bold/italic, no nested bullets.
- After the bullets, leave one blank line, then the verdict tag on its own line.
 
DATA SOURCES you may cite (use these exact names):
- cra.loop_classification — bucket labels (overhead_extraction, receipt_generation, revenue_inflation, structural, low_risk), risk_score 0-30, overhead_pct, program_pct
- cra.loop_charity_financials — program_spending, gifts_given_donees, compensation_spending, admin_spending, fundraising_spending, revenue, designation
- cra.overhead_by_charity / cra.govt_funding_by_charity — total_revenue, federal_government_revenue, provincial_government_revenue, strict_overhead_pct
- cra.cra_directors — last_name + first_name match across loop BNs (controlling-director signal)
- fed.grants_contributions — agreement_value, owner_org, agreement_title (federal grant entering the loop)
- general.entity_golden_records — aliases, dataset_sources (cross-dataset / renamed-shell signal)
- cra.partitioned_cycles — hops, total_flow, bottleneck_amt, year_range
- computed: leakage_pct (loop-level), data_coverage (fraction of BNs with financial data)
 
INTERPRETATION RULES:
- Treat leakage_pct >= 60% as a primary red flag. Below 40% is fine.
- If most members are designation A or B (foundations) and leakage is low, that is structurally expected — call it out as a benign signal, not a concern.
- A single named individual sitting on 2+ boards inside the cycle is the strongest single signal. Always include such a bullet by name when controlling_directors is non-empty.
- Federal grant dollars entering a high-leakage loop is materially worse than private donations cycling. Call this out explicitly.
- When a charity is classified as \'structural\', mark it as a benign-by-design signal, not a red flag.
 
VERDICT TAG (last line, exactly one of):
[VERDICT: LIKELY BENIGN]
[VERDICT: REQUIRES SCRUTINY]
[VERDICT: RED FLAG]
 
EXAMPLES of well-formed bullets (do not copy verbatim — generate from the data):
- Loop leakage 87% — most of one bottleneck dollar is absorbed by compensation and admin, not programs | Source: cra.loop_charity_financials (compensation_spending + admin_spending vs program_spending)
- Walter Berlin sits on 3 of 4 boards in the cycle, including the highest-flow node | Source: cra.cra_directors (shared last_name + first_name across loop BNs)
- $4.2M federal grant from Employment and Social Development Canada flows into the highest-leakage participant | Source: fed.grants_contributions (agreement_value, owner_org)
- All 4 charities are designation B private foundations with overhead under 15% — endowment grant cycle, structurally expected | Source: cra.loop_classification (designation, classification=structural)
 

Data: ${JSON.stringify(loopData, null, 2)}`;

  try {
    const response = await geminiCall({
      model: GEMINI_MODEL,
      contents: prompt,
    }, `memo#${loopId}`);

    const rawMemo = response.text;
    if (!rawMemo) throw new Error('Gemini returned no text');
    const memoText = stripLetterFormat(rawMemo);
    const verdict = parseVerdict(memoText);

    const result = { memo: memoText, verdict, loopId: key, generated_at: new Date().toISOString() };
    memoCache.set(key, result);
    persistMemoCache();
    return result;
  } catch (err) {
    console.error(`Gemini memo failed for loop #${loopId}:`, err.message);
    const fallback = {
      memo: 'Analysis unavailable — please retry.',
      verdict: 'SCRUTINY',
      loopId: key,
      generated_at: new Date().toISOString(),
    };
    // Don't persist fallbacks — they're transient errors we want to retry next time.
    memoCache.set(key, fallback);
    return fallback;
  }
}

// ============================================================
// GET /api/loops — Top 20 loops with resolved names
// ============================================================
// ============================================================
// Loop pool — built once per process (5 min TTL), then sorted/
// filtered/paginated in memory. Keeps the leaderboard responsive
// regardless of how the user reshapes the query in Settings.
// ============================================================
const LOOP_POOL_CAP = 500;             // hard ceiling on candidates fetched from DB
const LOOP_POOL_TTL = 5 * 60_000;      // 5 minutes
let loopPool = null;
let loopPoolBuiltAt = 0;
let loopPoolBuilding = null;           // dedupe concurrent first-callers

async function getLoopPool() {
  if (loopPool && Date.now() - loopPoolBuiltAt < LOOP_POOL_TTL) return loopPool;
  if (loopPoolBuilding) return loopPoolBuilding;

  loopPoolBuilding = (async () => {
    const { rows: raw } = await pool.query(`
      SELECT id, hops, total_flow, bottleneck_amt, path_display,
             min_year, max_year, tier
      FROM cra.partitioned_cycles
      WHERE total_flow > 100000
        AND NOT (path_display LIKE '%107951618%')
      ORDER BY total_flow DESC
      LIMIT ${LOOP_POOL_CAP}
    `);

    const filtered = raw.filter(l => !isFederatedTransfer(parseBNs(l.path_display)));
    const allBNs = [...new Set(filtered.flatMap(l => parseBNs(l.path_display)))];
    const [profiles, classMap, directorMap] = await Promise.all([
      resolveProfiles(allBNs),
      getClassifications(allBNs),
      getDirectorBNsMap(allBNs),
    ]);
    const nameMap = Object.fromEntries(profiles.map(p => [p.bn, p]));

    const enriched = filtered.map(loop => {
      const bns = parseBNs(loop.path_display);
      const names = bns.map(bn => nameMap[bn]?.legal_name || bn);
      const shortLabel = names.length <= 2
        ? names.join(' → ')
        : `${names[0]} → ... → ${names[names.length - 1]}`;
      const worst = worstClassification(classMap, bns);
      const sharedDirectors = countSharedDirectors(directorMap, bns);
      return {
        id: loop.id,
        hops: loop.hops,
        total_flow: Number(loop.total_flow),
        total_flow_fmt: formatCurrency(Number(loop.total_flow)),
        bottleneck_amt: loop.bottleneck_amt,
        path_display: loop.path_display,
        min_year: loop.min_year,
        max_year: loop.max_year,
        tier: loop.tier,
        bns,
        names,
        short_label: shortLabel,
        worst_classification: worst,
        worst_classification_label: CLASSIFICATION_LABEL[worst] || 'Low Risk',
        shared_directors: sharedDirectors,
        has_director_overlap: sharedDirectors > 0,
      };
    });

    loopPool = enriched;
    loopPoolBuiltAt = Date.now();
    loopPoolBuilding = null;
    return enriched;
  })();

  return loopPoolBuilding;
}

const VALID_SORTS = new Set(['flow', 'directors', 'hops', 'recent']);
const VALID_CLASSES = new Set(['overhead_extraction', 'receipt_generation', 'revenue_inflation', 'low_risk', 'structural']);

app.get('/api/loops', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const sort = VALID_SORTS.has(req.query.sort) ? req.query.sort : 'flow';
    const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
    const classes = (req.query.classifications || '')
      .split(',').map(s => s.trim()).filter(s => VALID_CLASSES.has(s));
    const minDirectors = Math.max(parseInt(req.query.min_directors, 10) || 0, 0);

    const all = await getLoopPool();

    // Filter
    let filtered = all;
    if (classes.length) filtered = filtered.filter(l => classes.includes(l.worst_classification));
    if (minDirectors > 0) filtered = filtered.filter(l => l.shared_directors >= minDirectors);

    // Sort
    const sortKey = {
      flow: l => l.total_flow,
      directors: l => l.shared_directors,
      hops: l => l.hops,
      recent: l => l.max_year,
    }[sort];
    const mult = dir === 'desc' ? -1 : 1;
    filtered = [...filtered].sort((a, b) => (sortKey(a) - sortKey(b)) * mult);

    // Paginate
    const page = filtered.slice(offset, offset + limit);
    const totalFlow = filtered.reduce((s, l) => s + l.total_flow, 0);
    const largest = filtered.reduce((max, l) => (!max || l.total_flow > max.total_flow ? l : max), null);

    res.json({
      loops: page,
      stats: {
        total_flow: totalFlow,
        total_flow_fmt: formatCurrency(totalFlow),
        loop_count: filtered.length,
        largest: largest ? {
          total_flow_fmt: largest.total_flow_fmt,
          label: largest.short_label,
        } : null,
      },
      pagination: {
        offset,
        limit,
        total: filtered.length,
        has_more: offset + limit < filtered.length,
      },
      query: { sort, dir, classifications: classes, min_directors: minDirectors },
    });
  } catch (err) {
    console.error('GET /api/loops error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/loop/:id — Full loop detail with financials + federal grants
// ============================================================
// Loop-detail cache. /api/loop/:id runs 7 parallel queries against the remote
// Postgres on every click — cold latency ~1-2s. Cache for 30 min so demo
// clicks are instant after the first load (and pre-warmed at startup for the
// top 20). NULL_SENTINEL distinguishes "not in cache" from "known 404".
const loopDetailCache = new Map();   // id -> { payload, at }
const loopDetailInflight = new Map(); // id -> Promise (dedupe concurrent loaders)
const LOOP_DETAIL_TTL_MS = 30 * 60 * 1000;
const LOOP_DETAIL_NOT_FOUND = Symbol('not_found');

async function buildLoopDetail(id) {
  const { rows } = await pool.query(`
    SELECT
      pc.id, pc.hops, pc.total_flow, pc.bottleneck_amt,
      pc.path_display, pc.min_year, pc.max_year, pc.tier
    FROM cra.partitioned_cycles pc
    WHERE pc.id = $1
  `, [id]);

  if (!rows.length) return LOOP_DETAIL_NOT_FOUND;

  const loop = rows[0];
  const bns = parseBNs(loop.path_display);

  // path_display closes the cycle (e.g. A→B→C→A), so bns has the
  // first BN repeated at the end. Dedupe for the leakage waterfall
  // so each charity is listed once; keep `bns` as-is for nodes/edges
  // so the network graph still draws the closing edge.
  const uniqBns = [...new Set(bns)];

  const [profiles, overhead, fedDetail, classMap, directors, golden, finMap] = await Promise.all([
    resolveProfiles(bns),
    getOverhead(bns),
    getDetailedFederalGrants(bns),
    getClassifications(bns),
    getDirectorOverlap(bns),
    getGoldenEnrichment(bns),
    getLoopFinancials(uniqBns),
  ]);

  const profileMap = Object.fromEntries(profiles.map(p => [p.bn, p]));
  const overheadMap = Object.fromEntries(overhead.map(o => [o.bn, o]));

  // Loop Leakage Rate — how much of one bottleneck dollar entering the
  // cycle reaches a charitable purpose (own programs or grants to other
  // qualified donees) vs. is absorbed by comp / admin / fundraising.
  const leakage = computeLeakage(uniqBns, finMap, loop.bottleneck_amt);

  // Decorate waterfall entries with display names for the UI.
  leakage.waterfall = leakage.waterfall.map(w => ({
    ...w,
    legal_name: profileMap[w.bn]?.legal_name || w.bn,
  }));

  // Build nodes
  const nodes = bns.map(bn => {
    const prof = profileMap[bn] || {};
    const oh = overheadMap[bn] || {};
    const c = classMap[bn] || {};
    const g = golden[bn] || {};
    const totalRev = Number(oh.total_revenue) || 0;
    const fedRev = Number(oh.federal_government_revenue) || 0;
    const provRev = Number(oh.provincial_government_revenue) || 0;
    const govPct = oh.govt_share_of_rev != null
      ? Number(oh.govt_share_of_rev)
      : (totalRev > 0 ? (fedRev + provRev) / totalRev : 0);

    return {
      bn,
      legal_name: prof.legal_name || bn,
      city: prof.city || 'Unknown',
      province: prof.province || 'Unknown',
      category_name: prof.category_name || 'Unknown',
      designation: c.designation || null,
      classification: c.classification || null,
      classification_label: c.classification ? CLASSIFICATION_LABEL[c.classification] : null,
      risk_score: c.total_score != null ? Number(c.total_score) : null,
      overhead_pct: c.overhead_pct != null ? Number(c.overhead_pct) : null,
      program_pct: c.program_pct != null ? Number(c.program_pct) : null,
      total_revenue: totalRev,
      total_revenue_fmt: formatCurrency(totalRev),
      federal_government_revenue: fedRev,
      provincial_government_revenue: provRev,
      strict_overhead_pct: oh.strict_overhead_pct != null ? Number(oh.strict_overhead_pct) : null,
      gov_funding_pct: govPct,
      color: govPct > 0.7 ? 'red' : govPct > 0.4 ? 'orange' : 'green',
      // Cross-dataset golden-record enrichment
      aliases: g.aliases || [],
      dataset_sources: g.dataset_sources || [],
      in_fed: !!g.in_fed,
      in_ab: !!g.in_ab,
      related_count: g.related_count || 0,
    };
  });

  const worstCls = worstClassification(classMap, bns);
  const directorContext = directors.map(d => ({
    director_name: d.director_name,
    boards_in_cycle: d.boards_in_cycle,
    bns: d.bns,
    charity_names: d.bns.map(bn => profileMap[bn]?.legal_name || bn),
  }));

  // Build edges (sequential pairs in the path, plus last → first to close loop)
  const edges = [];
  for (let i = 0; i < bns.length - 1; i++) {
    edges.push({ source: bns[i], target: bns[i + 1] });
  }
  // Close the loop
  if (bns.length > 1) {
    edges.push({ source: bns[bns.length - 1], target: bns[0] });
  }

  return {
    loop: {
      id: loop.id,
      hops: loop.hops,
      total_flow: loop.total_flow,
      total_flow_fmt: formatCurrency(Number(loop.total_flow)),
      bottleneck_amt: loop.bottleneck_amt,
      bottleneck_amt_fmt: formatCurrency(Number(loop.bottleneck_amt)),
      min_year: loop.min_year,
      max_year: loop.max_year,
      tier: loop.tier,
      worst_classification: worstCls,
      worst_classification_label: CLASSIFICATION_LABEL[worstCls] || 'Low Risk',
    },
    nodes,
    edges,
    federal_grants: fedDetail,
    directors: directorContext,
    leakage,
  };
}

// Layered lookup: L1 in-process Map -> L2 SQLite (lib/cache) -> L3 Postgres.
// Both layers share the same TTL so a restart doesn't change freshness
// semantics. L2 only stores positive results — 404s aren't worth persisting,
// they're cheap to recompute and rare enough not to matter.
const LOOP_DETAIL_NS = 'loop_detail';

async function getLoopDetail(id) {
  const key = String(id);
  const now = Date.now();

  const hit = loopDetailCache.get(key);
  if (hit && now - hit.at < LOOP_DETAIL_TTL_MS) return hit.payload;

  // L2 check before inflight dedup. SQLite read is sub-ms and synchronous,
  // so doing it here saves us from kicking off a duplicate build when the
  // detail is already on disk from a previous process.
  const l2 = cacheGet(LOOP_DETAIL_NS, key, LOOP_DETAIL_TTL_MS);
  if (l2) {
    loopDetailCache.set(key, { payload: l2, at: now });
    return l2;
  }

  // Dedupe: if another caller is already building the same id, await its promise.
  if (loopDetailInflight.has(key)) return loopDetailInflight.get(key);

  const promise = (async () => {
    try {
      const payload = await buildLoopDetail(id);
      loopDetailCache.set(key, { payload, at: Date.now() });
      // Only persist real payloads. The 404 sentinel is a Symbol and not
      // serializable, so guard against it explicitly.
      if (payload !== LOOP_DETAIL_NOT_FOUND) {
        try {
          cacheSet(LOOP_DETAIL_NS, key, payload);
        } catch (err) {
          console.warn(`[cache] L2 write failed for loop ${key}:`, err.message);
        }
      }
      return payload;
    } finally {
      loopDetailInflight.delete(key);
    }
  })();
  loopDetailInflight.set(key, promise);
  return promise;
}

app.get('/api/loop/:id', async (req, res) => {
  try {
    const payload = await getLoopDetail(req.params.id);
    if (payload === LOOP_DETAIL_NOT_FOUND) {
      return res.status(404).json({ error: 'Loop not found' });
    }
    res.json(payload);
  } catch (err) {
    console.error('GET /api/loop/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/investigate/:id — AI memo generation
// ============================================================
app.post('/api/investigate/:id', async (req, res) => {
  try {
    const result = await generateMemo(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('POST /api/investigate/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/verdicts — Pre-generated verdicts for all loops
// ============================================================
app.get('/api/verdicts', (req, res) => {
  const verdicts = cachedLoops.map(l => {
    const cached = memoCache.get(String(l.id));
    return {
      id: l.id,
      verdict: cached ? cached.verdict : null,
    };
  });
  res.json({ verdicts, progress: pregenProgress });
});

// ============================================================
// GET /api/summary — Aggregate findings across ALL qualifying loops
// Closes the "narrative report" gap from situation.md.
// ============================================================
let summaryCache = null;
let summaryCacheAt = 0;

app.get('/api/summary', async (req, res) => {
  try {
    // 5-minute cache — this query is heavy
    if (summaryCache && Date.now() - summaryCacheAt < 5 * 60_000) {
      return res.json(summaryCache);
    }

    const { rows: allLoops } = await pool.query(`
      SELECT id, hops, total_flow, bottleneck_amt, path_display, min_year, max_year, tier
      FROM cra.partitioned_cycles
      WHERE total_flow > 100000
        AND NOT (path_display LIKE '%107951618%')
      ORDER BY total_flow DESC
      LIMIT 200
    `);

    const filtered = allLoops.filter(l => !isFederatedTransfer(parseBNs(l.path_display)));
    const allBNs = [...new Set(filtered.flatMap(l => parseBNs(l.path_display)))];
    const [profiles, classMap] = await Promise.all([
      resolveProfiles(allBNs),
      getClassifications(allBNs),
    ]);
    const nameMap = Object.fromEntries(profiles.map(p => [p.bn, p]));

    // Group loops by worst classification
    const buckets = {
      overhead_extraction: [],
      receipt_generation: [],
      revenue_inflation: [],
      structural: [],
      low_risk: [],
    };

    // Distributions
    const tierDist = new Map();   // tier -> { count, flow }
    const hopDist = new Map();   // hops -> { count, flow }
    const yearDist = new Map();   // year -> { active_loops, flow_share }

    const enrichedLoops = [];
    let bnTouchCount = 0;
    let multiBnLoops = 0;

    for (const l of filtered) {
      const bns = parseBNs(l.path_display);
      const uniqBns = [...new Set(bns)];
      bnTouchCount += uniqBns.length;
      if (uniqBns.length >= 4) multiBnLoops++;

      const worst = worstClassification(classMap, bns);
      const names = bns.map(bn => nameMap[bn]?.legal_name || bn);
      const shortLabel = names.length <= 2
        ? names.join(' → ')
        : `${names[0]} → ... → ${names[names.length - 1]}`;
      const flow = Number(l.total_flow);
      const enriched = {
        id: l.id,
        total_flow: flow,
        total_flow_fmt: formatCurrency(flow),
        bottleneck_amt: l.bottleneck_amt != null ? Number(l.bottleneck_amt) : null,
        hops: l.hops,
        unique_orgs: uniqBns.length,
        short_label: shortLabel,
        year_range: `${l.min_year}–${l.max_year}`,
        min_year: l.min_year,
        max_year: l.max_year,
        tier: l.tier,
        worst,
        worst_label: CLASSIFICATION_LABEL[worst] || 'Low Risk',
      };
      enrichedLoops.push(enriched);
      buckets[worst].push(enriched);

      const tierKey = l.tier || 'untiered';
      const t = tierDist.get(tierKey) || { count: 0, flow: 0 };
      t.count += 1; t.flow += flow;
      tierDist.set(tierKey, t);

      const hopKey = String(l.hops);
      const h = hopDist.get(hopKey) || { count: 0, flow: 0 };
      h.count += 1; h.flow += flow;
      hopDist.set(hopKey, h);

      const yMin = Number(l.min_year);
      const yMax = Number(l.max_year);
      if (Number.isFinite(yMin) && Number.isFinite(yMax) && yMin <= yMax && yMin > 1990) {
        const span = yMax - yMin + 1;
        const flowPerYear = flow / span;
        for (let y = yMin; y <= yMax; y++) {
          const cur = yearDist.get(y) || { active: 0, flow: 0 };
          cur.active += 1;
          cur.flow += flowPerYear;
          yearDist.set(y, cur);
        }
      }
    }

    const totalFlow = enrichedLoops.reduce((s, l) => s + l.total_flow, 0);

    // Concentration: share of flow held by top-N loops
    const sortedFlows = enrichedLoops.map(l => l.total_flow).sort((a, b) => b - a);
    const concentration = (n) => {
      const head = sortedFlows.slice(0, n).reduce((s, v) => s + v, 0);
      return totalFlow > 0 ? head / totalFlow : 0;
    };

    // Top 10 loops by flow (cross-bucket)
    const topLoops = [...enrichedLoops]
      .sort((a, b) => b.total_flow - a.total_flow)
      .slice(0, 10);

    // Distributions in array form
    const tierArr = [...tierDist.entries()].map(([tier, v]) => ({
      tier,
      count: v.count,
      flow: v.flow,
      flow_fmt: formatCurrency(v.flow),
    })).sort((a, b) => b.flow - a.flow);

    const hopArr = [...hopDist.entries()].map(([hops, v]) => ({
      hops: Number(hops),
      label: `${hops}-hop`,
      count: v.count,
      flow: v.flow,
      flow_fmt: formatCurrency(v.flow),
    })).sort((a, b) => a.hops - b.hops);

    const yearArr = [...yearDist.entries()].map(([year, v]) => ({
      year: Number(year),
      active_loops: v.active,
      flow: v.flow,
      flow_fmt: formatCurrency(v.flow),
    })).sort((a, b) => a.year - b.year);

    // Risk-vs-size scatter: x = unique orgs, y = total flow, size = hops
    const scatter = enrichedLoops.map(l => ({
      x: l.unique_orgs,
      y: l.total_flow,
      z: l.hops * 40,
      name: l.short_label,
      worst: l.worst,
      flow_fmt: l.total_flow_fmt,
    }));

    const summary = {
      generated_at: new Date().toISOString(),
      total_loops_analyzed: enrichedLoops.length,
      total_flow: totalFlow,
      total_flow_fmt: formatCurrency(totalFlow),
      avg_flow_per_loop: enrichedLoops.length ? totalFlow / enrichedLoops.length : 0,
      avg_flow_per_loop_fmt: formatCurrency(enrichedLoops.length ? totalFlow / enrichedLoops.length : 0),
      median_flow_fmt: formatCurrency(sortedFlows[Math.floor(sortedFlows.length / 2)] || 0),
      unique_orgs_touched: new Set(enrichedLoops.flatMap(l => l.short_label ? [] : [])).size || allBNs.length,
      total_orgs_in_loops: allBNs.length,
      avg_orgs_per_loop: enrichedLoops.length ? bnTouchCount / enrichedLoops.length : 0,
      multi_org_loops: multiBnLoops,
      concentration_top5: concentration(5),
      concentration_top10: concentration(10),
      buckets: Object.fromEntries(
        Object.entries(buckets).map(([k, loops]) => {
          const flow = loops.reduce((s, l) => s + l.total_flow, 0);
          return [k, {
            label: CLASSIFICATION_LABEL[k],
            count: loops.length,
            total_flow: flow,
            total_flow_fmt: formatCurrency(flow),
            avg_flow: loops.length ? flow / loops.length : 0,
            avg_flow_fmt: formatCurrency(loops.length ? flow / loops.length : 0),
            share_of_total: totalFlow > 0 ? flow / totalFlow : 0,
            top_loops: loops.slice(0, 5),
          }];
        })
      ),
      tier_distribution: tierArr,
      hop_distribution: hopArr,
      year_distribution: yearArr,
      top_loops: topLoops,
      scatter,
    };

    summaryCache = summary;
    summaryCacheAt = Date.now();
    res.json(summary);
  } catch (err) {
    console.error('GET /api/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/summary/narrative — Claude Opus narrative synthesis
// Uses Anthropic SDK if ANTHROPIC_API_KEY set, otherwise falls
// back to Gemini for the same prompt.
// ============================================================
let narrativeCache = null;
let narrativeCacheAt = 0;

app.get('/api/summary/narrative', async (req, res) => {
  try {
    if (narrativeCache && Date.now() - narrativeCacheAt < 30 * 60_000) {
      return res.json(narrativeCache);
    }

    // Reuse summary cache (or build it)
    let summary = summaryCache;
    if (!summary || Date.now() - summaryCacheAt > 5 * 60_000) {
      const r = await fetch(`http://localhost:${PORT}/api/summary`).then(r => r.json()).catch(() => null);
      summary = r || summaryCache;
    }
    if (!summary) return res.status(503).json({ error: 'summary not ready' });

    const compact = {
      total_loops_analyzed: summary.total_loops_analyzed,
      total_flow_fmt: summary.total_flow_fmt,
      median_flow_fmt: summary.median_flow_fmt,
      avg_flow_per_loop_fmt: summary.avg_flow_per_loop_fmt,
      concentration_top5: summary.concentration_top5,
      concentration_top10: summary.concentration_top10,
      buckets: Object.fromEntries(
        Object.entries(summary.buckets).map(([k, b]) => [k, {
          count: b.count,
          flow_fmt: b.total_flow_fmt,
          share: b.share_of_total,
          avg_fmt: b.avg_flow_fmt,
        }])
      ),
      tier_distribution: summary.tier_distribution,
      hop_distribution: summary.hop_distribution,
      top5_loops: summary.top_loops.slice(0, 5).map(l => ({
        flow_fmt: l.total_flow_fmt,
        hops: l.hops,
        worst: l.worst_label,
        label: l.short_label,
      })),
    };

    const prompt = `You are a forensic analyst writing the executive summary for an accountability investigation into circular charity funding loops in Canada (CRA T3010 dataset).

Write three short paragraphs in plain English a journalist could quote:

Paragraph 1 — SCALE: how many loops, total dollars, concentration (do a few loops dominate, or is it spread out). Use the concrete numbers.

Paragraph 2 — RISK MIX: of the five classification buckets (overhead_extraction, receipt_generation, revenue_inflation, structural, low_risk), which buckets carry the most dollars and what does that imply. Treat overhead_extraction and receipt_generation as the most concerning, revenue_inflation as moderate, structural and low_risk as expected federated patterns.

Paragraph 3 — VERDICT: one sharp, falsifiable takeaway about what this distribution suggests is happening at the system level. End with the literal tag [VERDICT: SYSTEM-LEVEL CONCERN] or [VERDICT: MOSTLY STRUCTURAL].

No bullet points. No headers. Just three tight paragraphs.

Data:
${JSON.stringify(compact, null, 2)}`;

    let memoText = null;
    let model = null;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: anthropicKey });
        const resp = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-20250514',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });
        memoText = resp.content?.[0]?.text || null;
        model = resp.model;
      } catch (err) {
        console.warn('Claude Opus call failed, falling back to Gemini:', err.message);
      }
    }

    if (!memoText) {
      const response = await geminiCall({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { maxOutputTokens: 2048 },
      }, 'narrative');
      memoText = stripLetterFormat(response.text);
      model = GEMINI_MODEL;
    }

    const result = {
      narrative: memoText,
      model,
      generated_at: new Date().toISOString(),
    };
    narrativeCache = result;
    narrativeCacheAt = Date.now();
    res.json(result);
  } catch (err) {
    console.error('GET /api/summary/narrative error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/loops.csv — Reproducibility export (judges can audit)
// ============================================================
app.get('/api/loops.csv', async (req, res) => {
  try {
    const { rows: allLoops } = await pool.query(`
      SELECT id, hops, total_flow, bottleneck_amt, path_display, min_year, max_year, tier
      FROM cra.partitioned_cycles
      WHERE total_flow > 100000
        AND NOT (path_display LIKE '%107951618%')
      ORDER BY total_flow DESC
      LIMIT 200
    `);

    const filtered = allLoops.filter(l => !isFederatedTransfer(parseBNs(l.path_display)));
    const allBNs = [...new Set(filtered.flatMap(l => parseBNs(l.path_display)))];
    const [profiles, classMap] = await Promise.all([
      resolveProfiles(allBNs),
      getClassifications(allBNs),
    ]);
    const nameMap = Object.fromEntries(profiles.map(p => [p.bn, p]));

    const escape = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };

    const header = [
      'loop_id', 'hops', 'total_flow_cad', 'bottleneck_cad',
      'min_year', 'max_year', 'tier',
      'worst_classification', 'worst_classification_label',
      'bn_path', 'name_path',
    ];
    const lines = [header.join(',')];

    for (const l of filtered) {
      const bns = parseBNs(l.path_display);
      const names = bns.map(bn => nameMap[bn]?.legal_name || bn);
      const worst = worstClassification(classMap, bns);
      lines.push([
        l.id, l.hops, l.total_flow, l.bottleneck_amt,
        l.min_year, l.max_year, l.tier,
        worst, CLASSIFICATION_LABEL[worst] || '',
        bns.join(' -> '), names.join(' -> '),
      ].map(escape).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="follow-the-money-loops.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('GET /api/loops.csv error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUBLIC RECIPIENTS — non-charity entities receiving public funds
// (federal grants + Alberta contracts/sole-source/grants)
// ============================================================
let abAvailable = null;

async function probeAB() {
  if (abAvailable !== null) return abAvailable;
  try {
    await pool.query('SELECT 1 FROM ab.ab_contracts LIMIT 1');
    abAvailable = true;
  } catch {
    console.warn('ab schema not found — Alberta enrichment disabled.');
    abAvailable = false;
  }
  return abAvailable;
}

let topRecipientsCache = null;
let topRecipientsCacheAt = 0;

// ------------------------------------------------------------
// GET /api/recipients/top — top non-charity recipients of public funds
// ------------------------------------------------------------
app.get('/api/recipients/top', async (req, res) => {
  try {
    if (topRecipientsCache && Date.now() - topRecipientsCacheAt < 5 * 60_000) {
      return res.json(topRecipientsCache);
    }

    // Federal: aggregate by recipient_legal_name, exclude charity BNs
    const { rows: fed } = await pool.query(`
      SELECT
        UPPER(TRIM(g.recipient_legal_name)) AS norm_name,
        MIN(g.recipient_legal_name)         AS display_name,
        COUNT(*)                            AS fed_grant_count,
        SUM(g.agreement_value)              AS fed_total,
        COUNT(DISTINCT g.owner_org_title)   AS fed_dept_count,
        MAX(g.recipient_type)               AS recipient_type
      FROM fed.grants_contributions g
      WHERE g.recipient_legal_name IS NOT NULL
        AND g.agreement_value > 0
        AND (
          g.recipient_business_number IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM cra.cra_identification ci
            WHERE ci.bn = g.recipient_business_number
          )
        )
      GROUP BY UPPER(TRIM(g.recipient_legal_name))
      ORDER BY SUM(g.agreement_value) DESC
      LIMIT 100
    `);

    // Alberta: aggregate from contracts + sole_source + grants
    let abMap = {};
    if (await probeAB()) {
      try {
        const { rows: ab } = await pool.query(`
          WITH combined AS (
            SELECT UPPER(TRIM(recipient)) AS norm_name, amount, 'contract' AS src
              FROM ab.ab_contracts WHERE recipient IS NOT NULL AND amount > 0
            UNION ALL
            SELECT UPPER(TRIM(vendor)) AS norm_name, contract_value AS amount, 'sole_source' AS src
              FROM ab.ab_sole_source WHERE vendor IS NOT NULL AND contract_value > 0
            UNION ALL
            SELECT UPPER(TRIM(recipient)) AS norm_name, amount, 'grant' AS src
              FROM ab.ab_grants WHERE recipient IS NOT NULL AND amount > 0
          )
          SELECT norm_name,
                 SUM(amount)                AS ab_total,
                 COUNT(*)                   AS ab_record_count,
                 COUNT(DISTINCT src)        AS ab_source_count
          FROM combined
          GROUP BY norm_name
        `);
        abMap = Object.fromEntries(ab.map(r => [r.norm_name, r]));
      } catch (err) {
        console.warn('AB rollup failed:', err.message);
      }
    }

    // Merge FED + AB, recompute total
    const merged = fed.map(r => {
      const ab = abMap[r.norm_name] || {};
      const fedTotal = Number(r.fed_total) || 0;
      const abTotal = Number(ab.ab_total) || 0;
      return {
        norm_name: r.norm_name,
        display_name: r.display_name,
        recipient_type: r.recipient_type,
        fed_total: fedTotal,
        fed_total_fmt: formatCurrency(fedTotal),
        fed_grant_count: Number(r.fed_grant_count) || 0,
        fed_dept_count: Number(r.fed_dept_count) || 0,
        ab_total: abTotal,
        ab_total_fmt: formatCurrency(abTotal),
        ab_record_count: Number(ab.ab_record_count) || 0,
        total: fedTotal + abTotal,
        total_fmt: formatCurrency(fedTotal + abTotal),
        sources: [
          fedTotal > 0 ? 'Federal' : null,
          abTotal > 0 ? 'Alberta' : null,
        ].filter(Boolean),
      };
    }).sort((a, b) => b.total - a.total).slice(0, 50);

    const totalFunding = merged.reduce((s, r) => s + r.total, 0);

    const result = {
      generated_at: new Date().toISOString(),
      recipients: merged,
      stats: {
        recipient_count: merged.length,
        total_funding: totalFunding,
        total_funding_fmt: formatCurrency(totalFunding),
        ab_available: !!abAvailable,
      },
    };

    topRecipientsCache = result;
    topRecipientsCacheAt = Date.now();
    res.json(result);
  } catch (err) {
    console.error('GET /api/recipients/top error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/recipients/search?q=... — search non-charity recipients
// ------------------------------------------------------------
app.get('/api/recipients/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const { rows } = await pool.query(`
      SELECT
        UPPER(TRIM(g.recipient_legal_name)) AS norm_name,
        MIN(g.recipient_legal_name)         AS display_name,
        SUM(g.agreement_value)              AS fed_total,
        COUNT(*)                            AS fed_grant_count
      FROM fed.grants_contributions g
      WHERE g.recipient_legal_name IS NOT NULL
        AND g.agreement_value > 0
        AND g.recipient_legal_name ILIKE $1
        AND (
          g.recipient_business_number IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM cra.cra_identification ci
            WHERE ci.bn = g.recipient_business_number
          )
        )
      GROUP BY UPPER(TRIM(g.recipient_legal_name))
      ORDER BY SUM(g.agreement_value) DESC
      LIMIT 25
    `, [`%${q}%`]);

    res.json({
      results: rows.map(r => ({
        norm_name: r.norm_name,
        display_name: r.display_name,
        fed_total: Number(r.fed_total) || 0,
        fed_total_fmt: formatCurrency(Number(r.fed_total) || 0),
        fed_grant_count: Number(r.fed_grant_count) || 0,
      })),
    });
  } catch (err) {
    console.error('GET /api/recipients/search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/recipient/:name — full profile for one recipient
// ------------------------------------------------------------
app.get('/api/recipient/:name', async (req, res) => {
  try {
    const norm = req.params.name.toUpperCase().trim();

    // Federal grants
    const { rows: fedGrants } = await pool.query(`
      SELECT
        recipient_legal_name,
        recipient_business_number,
        recipient_city,
        recipient_province,
        recipient_type,
        owner_org_title,
        prog_name_en,
        agreement_title_en,
        agreement_value,
        agreement_start_date,
        agreement_end_date,
        is_amendment
      FROM fed.grants_contributions
      WHERE UPPER(TRIM(recipient_legal_name)) = $1
        AND agreement_value > 0
      ORDER BY agreement_value DESC
      LIMIT 50
    `, [norm]);

    let abContracts = [];
    let abSoleSource = [];
    let abGrants = [];
    if (await probeAB()) {
      try {
        const [c, s, g] = await Promise.all([
          pool.query(`SELECT display_fiscal_year, recipient, amount, ministry FROM ab.ab_contracts WHERE UPPER(TRIM(recipient)) = $1 ORDER BY amount DESC LIMIT 20`, [norm]),
          pool.query(`SELECT ministry, vendor, contract_value, contract_description, contract_date FROM ab.ab_sole_source WHERE UPPER(TRIM(vendor)) = $1 ORDER BY contract_value DESC LIMIT 20`, [norm]),
          pool.query(`SELECT ministry, recipient, amount, program, fiscal_year FROM ab.ab_grants WHERE UPPER(TRIM(recipient)) = $1 ORDER BY amount DESC LIMIT 20`, [norm]),
        ]);
        abContracts = c.rows;
        abSoleSource = s.rows;
        abGrants = g.rows;
      } catch (err) {
        console.warn('AB profile lookup failed:', err.message);
      }
    }

    if (fedGrants.length === 0 && abContracts.length === 0 && abSoleSource.length === 0 && abGrants.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const fedTotal = fedGrants.reduce((s, g) => s + (Number(g.agreement_value) || 0), 0);
    const abContractTotal = abContracts.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const abSoleTotal = abSoleSource.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);
    const abGrantTotal = abGrants.reduce((s, g) => s + (Number(g.amount) || 0), 0);
    const abTotal = abContractTotal + abSoleTotal + abGrantTotal;
    const grandTotal = fedTotal + abTotal;

    const display = fedGrants[0]?.recipient_legal_name
      || abContracts[0]?.recipient
      || abSoleSource[0]?.vendor
      || abGrants[0]?.recipient
      || norm;

    const fedDepts = [...new Set(fedGrants.map(g => g.owner_org_title).filter(Boolean))];
    const abMinistries = [...new Set([
      ...abContracts.map(c => c.ministry),
      ...abSoleSource.map(c => c.ministry),
      ...abGrants.map(g => g.ministry),
    ].filter(Boolean))];

    res.json({
      display_name: display,
      norm_name: norm,
      city: fedGrants[0]?.recipient_city || null,
      province: fedGrants[0]?.recipient_province || null,
      recipient_type: fedGrants[0]?.recipient_type || null,
      totals: {
        federal: fedTotal,
        federal_fmt: formatCurrency(fedTotal),
        alberta: abTotal,
        alberta_fmt: formatCurrency(abTotal),
        grand_total: grandTotal,
        grand_total_fmt: formatCurrency(grandTotal),
      },
      federal: {
        grants: fedGrants.map(g => ({
          owner_org_title: g.owner_org_title,
          prog_name_en: g.prog_name_en,
          agreement_title_en: g.agreement_title_en,
          agreement_value: Number(g.agreement_value) || 0,
          agreement_value_fmt: formatCurrency(Number(g.agreement_value) || 0),
          agreement_start_date: g.agreement_start_date,
          agreement_end_date: g.agreement_end_date,
          is_amendment: g.is_amendment,
        })),
        grant_count: fedGrants.length,
        dept_count: fedDepts.length,
        depts: fedDepts,
      },
      alberta: {
        available: !!abAvailable,
        contracts: abContracts.map(c => ({
          fiscal_year: c.display_fiscal_year,
          amount: Number(c.amount) || 0,
          amount_fmt: formatCurrency(Number(c.amount) || 0),
          ministry: c.ministry,
        })),
        sole_source: abSoleSource.map(c => ({
          ministry: c.ministry,
          contract_value: Number(c.contract_value) || 0,
          contract_value_fmt: formatCurrency(Number(c.contract_value) || 0),
          contract_description: c.contract_description,
          contract_date: c.contract_date,
        })),
        grants: abGrants.map(g => ({
          ministry: g.ministry,
          amount: Number(g.amount) || 0,
          amount_fmt: formatCurrency(Number(g.amount) || 0),
          program: g.program,
          fiscal_year: g.fiscal_year,
        })),
        contract_total_fmt: formatCurrency(abContractTotal),
        sole_source_total_fmt: formatCurrency(abSoleTotal),
        grant_total_fmt: formatCurrency(abGrantTotal),
        ministries: abMinistries,
      },
    });
  } catch (err) {
    console.error('GET /api/recipient/:name error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/nl-search — Natural-language → SQL → AI summary
// ============================================================
const NL_SCHEMA = `
You have access to a PostgreSQL database with the following read-only tables and views.
All monetary values are in CAD. Business numbers (bn) are 9-digit strings identifying Canadian charities.

SCHEMA:

cra.vw_charity_profiles
  bn TEXT, legal_name TEXT, city TEXT, province TEXT, category_name TEXT, fiscal_year INT

cra.overhead_by_charity
  bn TEXT, fiscal_year INT, revenue NUMERIC, strict_overhead_pct NUMERIC

cra.govt_funding_by_charity
  bn TEXT, fiscal_year INT, federal NUMERIC, provincial NUMERIC, govt_share_of_rev NUMERIC

cra.loop_charity_financials
  bn TEXT, designation TEXT (A=Public Foundation, B=Private Foundation, C=Charitable Organization),
  category TEXT, program_spending NUMERIC, gifts_given_donees NUMERIC,
  compensation_spending NUMERIC, admin_spending NUMERIC, fundraising_spending NUMERIC,
  total_expenditures NUMERIC, revenue NUMERIC

cra.loop_classification
  bn TEXT, classification TEXT (one of: structural, overhead_extraction, receipt_generation, revenue_inflation, low_risk),
  total_score NUMERIC (0-30 risk score), overhead_pct NUMERIC, program_pct NUMERIC, designation TEXT

cra.partitioned_cycles  (detected circular funding loops)
  id INT, hops INT, total_flow NUMERIC, bottleneck_amt NUMERIC,
  path_display TEXT, min_year INT, max_year INT, tier TEXT

cra.cra_directors
  bn TEXT, director_name TEXT

fed.grants_contributions  (federal grants & contributions)
  bn TEXT, owner_org TEXT, owner_org_title TEXT,
  recipient_name TEXT, recipient_city TEXT, recipient_province TEXT, recipient_type TEXT,
  agreement_value NUMERIC, agreement_title_en TEXT, prog_name_en TEXT,
  agreement_start_date DATE, agreement_end_date DATE, is_amendment BOOLEAN

ab.ab_grants  (Alberta grants)
  ministry TEXT, program TEXT, amount NUMERIC, fiscal_year TEXT, recipient_name TEXT

ab.ab_contracts  (Alberta contracts)
  ministry TEXT, amount NUMERIC, fiscal_year TEXT, recipient_name TEXT

ab.ab_sole_source  (Alberta sole-source awards)
  ministry TEXT, contract_value NUMERIC, contract_description TEXT, contract_date DATE, recipient_name TEXT

general.entity_golden_records  (canonical cross-dataset entities)
  canonical_name TEXT, bn TEXT, in_fed BOOLEAN, in_ab BOOLEAN,
  aliases TEXT[], dataset_sources TEXT[]

JOINS: Use bn to join cra tables together and to fed.grants_contributions.
Use legal_name / recipient_name for cross-schema name matching.
For most recent data per charity, use DISTINCT ON (bn) ORDER BY bn, fiscal_year DESC.
`.trim();

const BLOCKED_PATTERNS = /\b(insert|update|delete|drop|create|alter|truncate|copy|pg_read_file|pg_ls_dir|pg_exec|dblink)\b/i;

function safeguardSQL(sql) {
  const trimmed = sql.trim().replace(/^```sql\s*/i, '').replace(/```\s*$/, '').trim();
  if (!/^select\b/i.test(trimmed)) {
    throw new Error('Only SELECT queries are allowed.');
  }
  if (BLOCKED_PATTERNS.test(trimmed)) {
    throw new Error('Query contains disallowed operations.');
  }
  // Prevent stacked queries
  if (/;\s*\S/.test(trimmed)) {
    throw new Error('Multiple statements are not allowed.');
  }
  // Enforce result cap
  if (!/\blimit\b/i.test(trimmed)) {
    return trimmed.replace(/;?\s*$/, '') + '\nLIMIT 100';
  }
  return trimmed;
}

app.post('/api/nl-search', async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (query.length > 500) {
    return res.status(400).json({ error: 'query too long (max 500 chars)' });
  }

  // Step 1: NL → SQL
  let rawSql;
  try {
    const sqlPrompt = `${NL_SCHEMA}

USER QUESTION: "${query.trim()}"

Return ONLY a valid PostgreSQL SELECT statement that answers the question.
- No markdown, no explanation, no code fences.
- Always include LIMIT 100 or fewer.
- Use aliases for readability (e.g. AS "Charity Name").
- Format currency columns with TO_CHAR(col, 'FM$999,999,999') where helpful.
- If the question is ambiguous, use the most recent fiscal_year available.
- Prefer joining cra.vw_charity_profiles to get legal_name for charity BNs.`;

    const sqlResp = await geminiCall({
      model: GEMINI_MODEL,
      contents: sqlPrompt,
    }, 'nl-search:sql');

    rawSql = sqlResp.text?.trim() || '';
  } catch (err) {
    console.error('[nl-search] SQL generation failed:', err.message);
    return res.status(500).json({ error: 'AI could not generate a query. Please try rephrasing.' });
  }

  // Step 2: Validate + sanitize SQL
  let safeSQL;
  try {
    safeSQL = safeguardSQL(rawSql);
  } catch (err) {
    console.warn('[nl-search] SQL rejected:', err.message, '| raw:', rawSql.slice(0, 200));
    return res.status(422).json({ error: `Generated query was invalid: ${err.message}` });
  }

  // Step 3: Execute
  let rows, columns;
  try {
    const result = await pool.query(safeSQL);
    rows = result.rows;
    columns = result.fields.map(f => f.name);
  } catch (err) {
    console.error('[nl-search] Query execution failed:', err.message);
    return res.status(422).json({
      error: 'The generated query had a database error. Try rephrasing your question.',
      sql: safeSQL,
      db_error: err.message,
    });
  }

  // Step 4: AI summary of results
  let summary = '';
  try {
    const rowSample = rows.slice(0, 30);
    const summaryPrompt = `A user asked: "${query.trim()}"

The database returned ${rows.length} result(s). Here is a sample (up to 30 rows):
${JSON.stringify(rowSample, null, 2)}

Write 2-3 sentences in plain English summarizing what the data shows.
Be specific: mention numbers, names, totals, trends. No bullet points. No markdown.
Write for a non-technical audience investigating Canadian government accountability.`;

    const sumResp = await geminiCall({
      model: GEMINI_MODEL,
      contents: summaryPrompt,
    }, 'nl-search:summary');

    summary = sumResp.text?.trim() || '';
  } catch (err) {
    console.warn('[nl-search] Summary generation failed:', err.message);
    summary = `Found ${rows.length} result(s) matching your query.`;
  }

  res.json({ sql: safeSQL, columns, rows, rowCount: rows.length, summary });
});

// ============================================================
// GET /api/health — System health (db + matview + memo + golden)
// ============================================================
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch { }

  const classOk = await probeClassificationView();
  const goldenOk = await probeGoldenView();

  const allHealthy = dbOk && classOk;
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    classification_matview: classOk ? 'available' : 'missing',
    golden_records: goldenOk ? 'available' : 'missing',
    memo_progress: `${pregenProgress.done}/${pregenProgress.total}`,
    memo_complete: pregenProgress.total > 0 && pregenProgress.done === pregenProgress.total,
    l2_cache: {
      loop_detail_entries: cacheCount(LOOP_DETAIL_NS),
    },
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

// ============================================================
// Startup sequence
// ============================================================
async function startup() {
  // Step 0: Rehydrate memoCache from disk so a restart doesn't re-pay
  // Gemini for memos we've already generated. Runs before app.listen()
  // so /api/verdicts can serve cached entries immediately.
  const restored = loadMemoCacheFromDisk();
  if (restored > 0) {
    console.log(`[memoCache] rehydrated ${restored} memo(s) from disk.`);
  }
  const l2DetailCount = cacheCount(LOOP_DETAIL_NS);
  if (l2DetailCount > 0) {
    console.log(`[cache] ${l2DetailCount} loop_detail entr${l2DetailCount === 1 ? 'y' : 'ies'} available in L2 (SQLite).`);
  }

  // Step 1: Test database connection
  console.log('Testing database connection...');
  try {
    await pool.query('SELECT 1');
    console.log('Database connected.');
  } catch (err) {
    console.error('DATABASE CONNECTION FAILED:', err.message);
    process.exit(1);
  }

  // Step 2: Load top 20 loops into memory
  console.log('Loading top 20 loops...');
  const { rows: loops } = await pool.query(`
    SELECT pc.id, pc.hops, pc.total_flow, pc.bottleneck_amt,
           pc.path_display, pc.min_year, pc.max_year, pc.tier
    FROM cra.partitioned_cycles pc
    WHERE pc.total_flow > 100000
      AND NOT (pc.path_display LIKE '%107951618%')
    ORDER BY pc.total_flow DESC
    LIMIT 40
  `);

  cachedLoops = loops.filter(l => !isFederatedTransfer(parseBNs(l.path_display))).slice(0, 20);
  pregenProgress.total = cachedLoops.length;
  // Reflect any memos already restored from disk so /api/health reports
  // accurate progress and the UI doesn't show 0/20 while pregen no-ops.
  pregenProgress.done = cachedLoops.filter(l => memoCache.has(String(l.id))).length;
  console.log(`${cachedLoops.length} loops loaded. ${pregenProgress.done} memos already cached.`);

  // Step 3: Start Express server FIRST so frontend can connect immediately.
  // Memo pregen runs in background; UI shows progress via /api/health.
  try { execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: 'ignore' }); } catch { }

  app.listen(PORT, () => {
    console.log(`Follow The Money running at http://localhost:${PORT}`);
  });

  // Step 4: Pre-warm loop-detail cache. Runs in background with concurrency=3
  // so it doesn't exhaust the pg connection pool (default 10) — each loop
  // fires 7 parallel sub-queries, so 3 in flight = ~21 simultaneous queries,
  // leaving headroom for memo queries and live user clicks.
  prewarmLoopDetails(cachedLoops).catch(err => console.warn('pre-warm failed:', err.message));

  // Step 5: Pre-generate memo #1 (top loop) before kicking off rest
  if (cachedLoops.length > 0) {
    const topId = String(cachedLoops[0].id);
    const wasCached = memoCache.has(topId);
    console.log('Pre-generating memo 1/' + cachedLoops.length + ' (top loop)...');
    await generateMemo(cachedLoops[0].id);
    // Only bump the counter if this run actually produced the memo.
    // If it was rehydrated from disk, we already counted it above.
    if (!wasCached) pregenProgress.done++;
    console.log(`Memo 1 ready — verdict: ${memoCache.get(topId)?.verdict}`);
  }

  // Step 6: Pre-generate memos 2-20 asynchronously (max 10 concurrent — Gemini
  // Flash handles this comfortably and ~halves total wall-clock pregen time).
  if (cachedLoops.length > 1) {
    preGenerateRemaining(cachedLoops.slice(1));
  }
}

async function prewarmLoopDetails(loops) {
  const concurrency = 3;
  const start = Date.now();
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < loops.length) {
      const loop = loops[idx++];
      try {
        await getLoopDetail(loop.id);
      } catch (err) {
        console.warn(`pre-warm loop ${loop.id} failed:`, err.message);
      }
      done++;
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, loops.length); w++) workers.push(worker());
  await Promise.all(workers);
  console.log(`Loop-detail cache pre-warmed for ${done} loops in ${Date.now() - start}ms`);
}

async function preGenerateRemaining(loops) {
  const concurrency = 10;
  let idx = 0;

  async function worker() {
    while (idx < loops.length) {
      const i = idx++;
      const loop = loops[i];
      const num = i + 2; // +2 because #1 is already done
      const key = String(loop.id);
      const wasCached = memoCache.has(key);
      console.log(`Pre-generating memo ${num}/${cachedLoops.length}...`);
      await generateMemo(loop.id);
      if (!wasCached) pregenProgress.done++;
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, loops.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Startup summary
  let redFlags = 0, scrutiny = 0, benign = 0;
  for (const [, v] of memoCache) {
    if (v.verdict === 'RED FLAG') redFlags++;
    else if (v.verdict === 'SCRUTINY') scrutiny++;
    else benign++;
  }

  // Get top loop federal grants total
  let topFedGrants = '$0';
  if (cachedLoops.length > 0) {
    const bns = parseBNs(cachedLoops[0].path_display);
    const detail = await getDetailedFederalGrants(bns);
    topFedGrants = detail.total_fmt;
  }

  console.log('');
  console.log('=== DEMO READY ===');
  console.log(`${pregenProgress.done}/${pregenProgress.total} memos pre-generated`);
  console.log(`Red flags: ${redFlags} | Scrutiny: ${scrutiny} | Benign: ${benign}`);
  console.log(`Top loop federal grants: ${topFedGrants}`);
  console.log('');
}

startup().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});

// On graceful shutdown, drain any pending memoCache writes so we don't lose
// the most recent memo to a half-written file. Per-write persistence already
// keeps the on-disk file fresh; this just waits for the queue to flush.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] flushing memoCache to disk...`);
  try {
    await persistMemoCache();
    await memoWriteQueue;
  } catch (err) {
    console.warn('shutdown flush failed:', err.message);
  }
  // Closing the SQLite handle checkpoints the WAL into the main db file
  // so there's no recovery work on next start.
  try {
    closeCache();
  } catch (err) {
    console.warn('cache close failed:', err.message);
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
