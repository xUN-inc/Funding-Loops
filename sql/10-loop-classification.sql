-- cra.loop_classification — per-BN bucket classifier for loop participants.
-- Read by server.js getClassifications() (~line 295). Builds the 5-bucket
-- model documented in METHODOLOGY.md from upstream tables that already exist
-- in this DB: cra.loop_charity_financials and cra.loop_universe.
--
-- Run once:
--   psql "$DATABASE_URL" -f sql/10-loop-classification.sql
--
-- Refresh after upstream changes:
--   REFRESH MATERIALIZED VIEW cra.loop_classification;

DROP MATERIALIZED VIEW IF EXISTS cra.loop_classification;

CREATE MATERIALIZED VIEW cra.loop_classification AS
WITH base AS (
  SELECT
    f.bn,
    f.designation,
    f.category                                          AS category_code,
    COALESCE(u.score, 0)::numeric                       AS total_score,
    COALESCE(f.revenue, 0)::numeric                     AS revenue,
    COALESCE(f.program_spending, 0)::numeric            AS program_spending,
    COALESCE(f.compensation_spending, 0)::numeric       AS compensation_spending,
    COALESCE(f.admin_spending, 0)::numeric              AS admin_spending,
    COALESCE(f.fundraising_spending, 0)::numeric        AS fundraising_spending,
    COALESCE(f.gifts_received_charities, 0)::numeric    AS gifts_in,
    COALESCE(f.gifts_given_donees, 0)::numeric          AS gifts_out
  FROM cra.loop_charity_financials f
  LEFT JOIN cra.loop_universe u ON u.bn = f.bn
),
ratios AS (
  SELECT
    b.*,
    CASE WHEN b.revenue > 0
      THEN (b.compensation_spending + b.admin_spending + b.fundraising_spending) / b.revenue
      ELSE 0
    END AS overhead_ratio,
    CASE WHEN b.revenue > 0
      THEN b.program_spending / b.revenue
      ELSE 0
    END AS program_ratio,
    CASE WHEN b.revenue > 0
      THEN b.gifts_in / b.revenue
      ELSE 0
    END AS charity_funded_ratio
  FROM base b
),
-- Count BNs sharing the same 9-digit company-number prefix that also
-- appear in any loop. Used by the structural rule for denominational
-- networks (≥3 affiliated siblings = structurally expected).
sibling_counts AS (
  SELECT
    SUBSTRING(bn FROM 1 FOR 9) AS bn_prefix,
    COUNT(DISTINCT bn)         AS sibling_count
  FROM cra.loop_universe
  GROUP BY SUBSTRING(bn FROM 1 FOR 9)
),
classified AS (
  SELECT
    r.bn,
    r.designation,
    r.category_code,
    r.total_score,
    ROUND(r.overhead_ratio::numeric, 4) AS overhead_ratio,
    ROUND(r.program_ratio::numeric, 4)  AS program_ratio,
    CASE
      -- 1. STRUCTURAL — checked first so legitimate hierarchies are exempt.
      WHEN r.designation IN ('A','B') AND r.overhead_ratio <= 0.40 THEN 'structural'
      WHEN r.category_code = '0210'   AND r.overhead_ratio <= 0.50 THEN 'structural'
      WHEN r.category_code BETWEEN '0030' AND '0090'
           AND COALESCE(s.sibling_count, 0) >= 3                    THEN 'structural'

      -- 2. OVERHEAD_EXTRACTION
      WHEN r.overhead_ratio > 0.40 AND r.total_score >= 10 THEN 'overhead_extraction'
      WHEN r.compensation_spending > r.program_spending
           AND r.program_spending > 0
           AND r.total_score >= 10 THEN 'overhead_extraction'

      -- 3. RECEIPT_GENERATION
      WHEN r.designation = 'C'
           AND r.program_ratio < 0.30
           AND r.total_score >= 10
           AND r.revenue > 100000 THEN 'receipt_generation'

      -- 4. REVENUE_INFLATION (gifts-based branch only — temporal subscore
      -- is not exposed as a separate column in cra.loop_universe; only the
      -- combined 0-30 score is available).
      WHEN r.designation = 'C'
           AND r.charity_funded_ratio > 0.50
           AND r.gifts_in  > 50000
           AND r.gifts_out > 50000 THEN 'revenue_inflation'

      -- 5. LOW_RISK (default)
      ELSE 'low_risk'
    END AS classification
  FROM ratios r
  LEFT JOIN sibling_counts s
    ON s.bn_prefix = SUBSTRING(r.bn FROM 1 FOR 9)
)
SELECT
  bn,
  classification,
  CASE classification
    WHEN 'overhead_extraction' THEN 4
    WHEN 'receipt_generation'  THEN 4
    WHEN 'revenue_inflation'   THEN 3
    WHEN 'low_risk'            THEN 1
    WHEN 'structural'          THEN 0
  END AS severity,
  total_score,
  designation,
  category_code,
  overhead_ratio,
  program_ratio
FROM classified;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_classification_bn
  ON cra.loop_classification (bn);

ANALYZE cra.loop_classification;
