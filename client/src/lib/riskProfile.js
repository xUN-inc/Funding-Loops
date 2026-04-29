// Compute a 6-axis risk fingerprint for a loop. All values normalized to 0–100.
// Used by the LoopVerdictCluster radar so each loop has a glanceable shape.

const SEVERITY_RANK = {
  overhead_extraction: 95,
  receipt_generation:  95,
  revenue_inflation:   60,
  structural:          25,
  low_risk:            10,
};

export function computeRiskProfile({ loop, nodes, leakage, directors }) {
  const leakagePct = leakage?.leakage_pct ?? 0;

  const maxGov = nodes.reduce((m, n) => {
    const v = Number(n.gov_funding_pct) || 0;
    return v > m ? v : m;
  }, 0);
  const govPct = Math.round(maxGov * 100);

  const maxOverhead = nodes.reduce((m, n) => {
    const v = Number(n.strict_overhead_pct) || 0;
    return v > m ? v : m;
  }, 0);
  // strict_overhead_pct is already a percent in this dataset
  const overheadPct = Math.min(100, Math.round(maxOverhead));

  const hopComplexity = Math.min(100, Math.round((loop.hops / 8) * 100));
  const directorOverlap = Math.min(100, Math.round(((directors?.length ?? 0) / 5) * 100));
  const severity = SEVERITY_RANK[loop.worst_classification] ?? 10;

  return [
    { axis: 'Leakage',     subject: clamp(leakagePct) },
    { axis: 'Gov Funding', subject: clamp(govPct) },
    { axis: 'Overhead',    subject: clamp(overheadPct) },
    { axis: 'Complexity',  subject: clamp(hopComplexity) },
    { axis: 'Directors',   subject: clamp(directorOverlap) },
    { axis: 'Severity',    subject: clamp(severity) },
  ];
}

function clamp(n) {
  if (n == null || isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// ============================================================
// Per-org spending fingerprint. One Radar series per charity in
// the loop, all sharing six dollar-flow axes. Lets you compare
// where each org's money goes side-by-side.
// ============================================================
const ORG_AXES = [
  { axis: 'Programs',    nodeKey: null,                  flowKey: 'program_share' },
  { axis: 'Gifts',       nodeKey: null,                  flowKey: 'gifts_share' },
  { axis: 'Comp',        nodeKey: null,                  flowKey: 'comp_share' },
  { axis: 'Admin',       nodeKey: null,                  flowKey: 'admin_share' },
  { axis: 'Fundraising', nodeKey: null,                  flowKey: 'fundraising_share' },
  { axis: 'Gov $',       nodeKey: 'gov_funding_pct',     flowKey: null },
];

const ORG_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#A855F7', '#06B6D4', '#F472B6', '#A3E635',
];

export function computeOrgProfiles({ nodes, leakage }) {
  if (!nodes?.length) return { data: [], series: [] };

  const flowByBn = new Map();
  for (const w of leakage?.waterfall ?? []) {
    flowByBn.set(w.bn, w);
  }

  // Dedupe nodes by bn (path closes the cycle so first==last)
  const seen = new Set();
  const orgs = [];
  for (const n of nodes) {
    if (seen.has(n.bn)) continue;
    seen.add(n.bn);
    orgs.push(n);
  }

  const series = orgs.map((n, i) => ({
    key: n.bn,
    label: n.legal_name || n.bn,
    color: ORG_PALETTE[i % ORG_PALETTE.length],
  }));

  const data = ORG_AXES.map(({ axis, nodeKey, flowKey }) => {
    const row = { axis };
    for (const n of orgs) {
      let v = 0;
      if (nodeKey) {
        v = (Number(n[nodeKey]) || 0) * 100;
      } else if (flowKey) {
        const f = flowByBn.get(n.bn);
        v = f ? (Number(f[flowKey]) || 0) * 100 : 0;
      }
      row[n.bn] = clamp(Math.round(v));
    }
    return row;
  });

  return { data, series };
}
