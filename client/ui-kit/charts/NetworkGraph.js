import { useMemo, useState } from 'react';
import { useTheme } from '../theme';
import { NET, VIZ } from '../dataviz';

/**
 * Lightweight SVG network graph (circular layout).
 *
 *   nodes: [{ id, label, kind: 'org' | 'person' | 'flagged' | 'suspect', sub? }]
 *   edges: [{ from, to, kind: 'flow' | 'base' | 'weak', label? }]
 *
 * <NetworkGraph nodes={[...]} edges={[...]} height={320} highlight="A" />
 */
export default function NetworkGraph({
  nodes,
  edges,
  width = 640,
  height = 360,
  highlight,
  caption,
}) {
  const { C } = useTheme();
  const [hover, setHover] = useState(null);

  const positioned = useMemo(() => {
    if (!nodes?.length) return [];
    const cx = width / 2;
    const cy = height / 2;
    const r  = Math.min(width, height) / 2 - 48;
    return nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      return { ...n, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
  }, [nodes, width, height]);

  const indexById = useMemo(() => {
    const m = new Map();
    positioned.forEach(n => m.set(n.id, n));
    return m;
  }, [positioned]);

  const nodeStyle = (n) => {
    if (n.id === hover) return NET.node.flagged;
    return NET.node[n.kind] ?? NET.node.base;
  };
  const edgeStyle = (e) => {
    if (hover && (e.from === hover || e.to === hover)) return NET.edge.flow;
    return NET.edge[e.kind] ?? NET.edge.base;
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={caption ?? 'Network graph'}
        style={{ display: 'block' }}
      >
        <g>
          {edges.map((e, i) => {
            const a = indexById.get(e.from);
            const b = indexById.get(e.to);
            if (!a || !b) return null;
            const s = edgeStyle(e);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const norm = Math.hypot(dx, dy) || 1;
            const ox = -dy / norm * 18;
            const oy =  dx / norm * 18;
            const path = `M ${a.x} ${a.y} Q ${mx + ox} ${my + oy}, ${b.x} ${b.y}`;
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  opacity={s.opacity}
                  markerEnd={s === NET.edge.flow ? 'url(#arrow-flow)' : 'url(#arrow-base)'}
                />
                {e.label && (
                  <text
                    x={mx + ox * 1.2} y={my + oy * 1.2}
                    fill={VIZ.axisTick} fontSize={9}
                    fontFamily="monospace" textAnchor="middle"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <defs>
          <marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={VIZ.alert} />
          </marker>
          <marker id="arrow-base" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={C.borderLight} />
          </marker>
        </defs>

        <g>
          {positioned.map((n) => {
            const s = nodeStyle(n);
            const isHigh = highlight === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  r={s.r + (isHigh ? 4 : 0)}
                  fill={s.fill}
                  stroke={isHigh ? VIZ.highlight : s.stroke}
                  strokeWidth={s.strokeWidth + (isHigh ? 0.75 : 0)}
                />
                <text
                  y={s.r + 14} textAnchor="middle"
                  fill={NET.label.fill} fontSize={NET.label.fontSize} fontWeight={NET.label.fontWeight}
                >
                  {n.label}
                </text>
                {n.sub && (
                  <text
                    y={s.r + 26} textAnchor="middle"
                    fill={C.text3} fontSize={9} fontFamily="monospace"
                  >
                    {n.sub}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {caption && (
        <div style={{ fontSize: 11, color: C.text3, textAlign: 'center', marginTop: 6 }}>
          {caption}
        </div>
      )}
    </div>
  );
}
