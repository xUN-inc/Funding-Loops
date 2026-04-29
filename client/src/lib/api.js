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

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  loops: () => get('/api/loops'),
  loop: (id) => get(`/api/loop/${id}`),
  verdicts: () => get('/api/verdicts'),
  summary: () => get('/api/summary'),
  summaryNarrative: () => get('/api/summary/narrative'),
  health: () => get('/api/health'),
  topRecipients: () => get('/api/recipients/top'),
  recipient: (name) => get(`/api/recipient/${encodeURIComponent(name)}`),
  searchRecipient: (q) => get(`/api/recipients/search?q=${encodeURIComponent(q)}`),
  investigate: (id) => post(`/api/investigate/${id}`),
  nlSearch: (query) => postJSON('/api/nl-search', { query }),
};
