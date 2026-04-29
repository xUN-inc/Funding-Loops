// Tiny fetch wrapper. Throws on non-2xx so callers can render ErrorState.
async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post(url) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function buildLoopsUrl(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit          != null) qs.set('limit',           params.limit);
  if (params.offset         != null) qs.set('offset',          params.offset);
  if (params.sort)                   qs.set('sort',            params.sort);
  if (params.dir)                    qs.set('dir',             params.dir);
  if (params.classifications?.length) qs.set('classifications', params.classifications.join(','));
  if (params.minDirectors   != null) qs.set('min_directors',   params.minDirectors);
  const s = qs.toString();
  return s ? `/api/loops?${s}` : '/api/loops';
}

export const api = {
  loops:           (params = {}) => get(buildLoopsUrl(params)),
  loop:            (id)    => get(`/api/loop/${id}`),
  verdicts:        ()      => get('/api/verdicts'),
  summary:         ()      => get('/api/summary'),
  summaryNarrative: ()     => get('/api/summary/narrative'),
  health:          ()      => get('/api/health'),
  topRecipients:   ()      => get('/api/recipients/top'),
  recipient:       (name)  => get(`/api/recipient/${encodeURIComponent(name)}`),
  searchRecipient: (q)     => get(`/api/recipients/search?q=${encodeURIComponent(q)}`),
  investigate:     (id)    => post(`/api/investigate/${id}`),
};
