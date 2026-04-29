import { useState } from 'react';
import {
  SectionCard, LoadingState, ErrorState, EmptyState, useTheme,
} from '../../ui-kit';
import { api } from '../lib/api';

const EXAMPLES = [
  'Show me the top 20 charities by total revenue',
  'Which charities have overhead above 60%?',
  'Top 10 federal grant recipients by total funding',
  'Charities in Alberta with the most government funding',
  'Show funding loops with more than 5 hops',
  'Which directors sit on the most charity boards?',
  'Top 15 charities classified as overhead extraction',
  'Federal grants over $1 million from Health Canada',
  'Charities with high risk scores and low program spending',
  'Alberta sole-source contracts over $500,000',
];

export default function NLSearch() {
  const { C } = useTheme();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sqlOpen, setSqlOpen] = useState(false);

  async function submit(q) {
    const text = (q || query).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSqlOpen(false);
    try {
      const data = await api.nlSearch(text);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function useExample(ex) {
    setQuery(ex);
    submit(ex);
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          AI Search
        </div>
        <div style={{ fontSize: 13, color: C.text2, maxWidth: 640 }}>
          Ask anything about Canadian charities, funding loops, grants, or government contracts
          in plain English. The AI translates your question into a database query and explains the results.
        </div>
      </div>

      {/* Search input */}
      <SectionCard style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="e.g. Which charities in Ontario have overhead above 50% and received federal grants?"
            rows={3}
            style={{
              flex: 1,
              background: C.inputBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.text,
              fontSize: 14,
              padding: '10px 14px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={() => submit()}
            disabled={loading || !query.trim()}
            style={{
              background: loading || !query.trim() ? C.border : C.primary,
              color: loading || !query.trim() ? C.text3 : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading || !query.trim() ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Example chips */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: C.text3, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Try an example
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => useExample(ex)}
                disabled={loading}
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 20,
                  color: C.text2,
                  fontSize: 11,
                  padding: '4px 12px',
                  cursor: loading ? 'default' : 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Loading */}
      {loading && (
        <SectionCard>
          <LoadingState label="Translating your question and querying the database…" />
        </SectionCard>
      )}

      {/* Error */}
      {!loading && error && (
        <SectionCard>
          <ErrorState message={error} />
        </SectionCard>
      )}

      {/* Results */}
      {!loading && result && (
        <>
          {/* AI Summary */}
          <SectionCard
            title="AI Summary"
            accent={C.primary}
            style={{ marginBottom: 16 }}
          >
            <div style={{
              fontSize: 14,
              color: C.text,
              lineHeight: 1.7,
              padding: '4px 0',
            }}>
              {result.summary}
            </div>
            <div style={{
              marginTop: 12,
              fontSize: 11,
              color: C.text3,
            }}>
              {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} returned
            </div>
          </SectionCard>

          {/* Generated SQL (collapsible) */}
          <SectionCard
            title="Generated SQL"
            accent={C.purple}
            style={{ marginBottom: 16 }}
          >
            <button
              onClick={() => setSqlOpen(o => !o)}
              style={{
                background: 'none',
                border: 'none',
                color: C.purple,
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                fontWeight: 600,
              }}
            >
              {sqlOpen ? '▾ Hide query' : '▸ Show generated query'}
            </button>
            {sqlOpen && (
              <pre style={{
                marginTop: 10,
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: 12,
                color: C.cyan,
                overflowX: 'auto',
                lineHeight: 1.6,
                fontFamily: 'var(--font-geist-mono), "Fira Code", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {result.sql}
              </pre>
            )}
          </SectionCard>

          {/* Results Table */}
          {result.rows.length === 0 ? (
            <SectionCard>
              <EmptyState message="No results found. Try rephrasing your question." />
            </SectionCard>
          ) : (
            <SectionCard
              title={`Results  ·  ${result.rowCount} row${result.rowCount !== 1 ? 's' : ''}`}
              accent={C.cyan}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}>
                  <thead>
                    <tr>
                      {result.columns.map(col => (
                        <th
                          key={col}
                          style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: C.surface2,
                            color: C.text2,
                            fontWeight: 600,
                            fontSize: 11,
                            borderBottom: `1px solid ${C.border}`,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? 'transparent' : C.rowAlt,
                        }}
                      >
                        {result.columns.map(col => (
                          <td
                            key={col}
                            style={{
                              padding: '7px 12px',
                              color: C.text,
                              borderBottom: `1px solid ${C.border}`,
                              maxWidth: 320,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={row[col] != null ? String(row[col]) : ''}
                          >
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rowCount === 100 && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.text3 }}>
                  Results capped at 100 rows. Refine your question to narrow the results.
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function formatCell(val) {
  if (val == null) return <span style={{ color: '#52525B' }}>—</span>;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  const s = String(val);
  // Truncate very long strings
  if (s.length > 120) return s.slice(0, 117) + '…';
  return s;
}
