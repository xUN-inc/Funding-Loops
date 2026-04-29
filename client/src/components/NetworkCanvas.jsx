import { useEffect, useRef, useState, useMemo } from 'react';
import { useTheme } from '../../ui-kit';

const GOV_COLORS = {
  red:    '#EF4444',
  orange: '#F59E0B',
  green:  '#10B981',
};

// sqrt scale for node radius (matches old d3.scaleSqrt behavior)
function sqrtScale(value, domainMax, rangeMin, rangeMax) {
  if (domainMax <= 0) return rangeMin;
  const t = Math.sqrt(Math.max(0, value) / domainMax);
  return rangeMin + (rangeMax - rangeMin) * t;
}

function shorten(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Canvas network graph with subtle grid background, revenue-scaled nodes,
 * and drag-to-reposition. Initial layout = circle.
 */
export default function NetworkCanvas({
  nodes,
  edges,
  height = 420,
  rMin = 18,
  rMax = 50,
  gridSize = 28,
}) {
  const { C } = useTheme();
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const [hoverId, setHoverId] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  // positions Map keyed by bn — mutable ref so drag updates don't trigger re-render
  const posRef  = useRef(new Map());
  const dragRef = useRef(null); // { id, dx, dy }

  // Precompute node draw data (radius, color, label)
  const drawNodes = useMemo(() => {
    const maxRev = Math.max(1, ...nodes.map(n => Number(n.total_revenue) || 0));
    return nodes.map(n => {
      const r = sqrtScale(Number(n.total_revenue) || 0, maxRev, rMin, rMax);
      const baseColor = GOV_COLORS[n.color] || C.primary;
      const isFlagged = n.classification && n.classification !== 'low_risk';
      return {
        id: n.bn,
        label: n.legal_name || n.bn,
        sub: n.designation || null,
        r,
        fill: isFlagged ? `${baseColor}28` : `${baseColor}1F`,
        stroke: baseColor,
        color: baseColor,
        raw: n,
      };
    });
  }, [nodes, rMin, rMax, C.primary]);

  const drawNodesById = useMemo(() => {
    const m = new Map();
    drawNodes.forEach(n => m.set(n.id, n));
    return m;
  }, [drawNodes]);

  // Resize observer — track wrap width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(320, entry.contentRect.width);
      setSize({ w, h: height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [height]);

  // Reset positions whenever node set changes (new loop selected).
  // Compact circular layout, top-anchored: nodes form a tight circle near
  // the top of the canvas, leaving slack space below.
  useEffect(() => {
    const topMargin    = rMax + 8;
    const bottomMargin = rMax + 28;
    const availH       = Math.max(60, size.h - topMargin - bottomMargin);
    const r            = Math.min(size.w / 2 - rMax - 20, availH / 2);
    const cx           = size.w / 2;
    const cy           = topMargin + r;
    const map = new Map();
    drawNodes.forEach((n, i) => {
      const a = (i / drawNodes.length) * Math.PI * 2 - Math.PI / 2;
      map.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    });
    posRef.current = map;
  }, [drawNodes, size.w, size.h, rMax]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width  = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf;
    const render = () => {
      drawScene(ctx, {
        w: size.w, h: size.h,
        gridSize,
        gridColor: C.border,
        bg: C.surface,
        textColor: C.text2,
        subColor: C.text3,
        edgeColor: C.borderLight,
        edgeFlow: C.primary,
        nodes: drawNodes,
        edges,
        positions: posRef.current,
        hoverId,
      });
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, gridSize, drawNodes, edges, hoverId, C.border, C.surface, C.text2, C.text3, C.borderLight, C.primary]);

  // Pointer handlers
  const hit = (mx, my) => {
    for (const n of drawNodes) {
      const p = posRef.current.get(n.id);
      if (!p) continue;
      const dx = mx - p.x;
      const dy = my - p.y;
      if (dx * dx + dy * dy <= n.r * n.r) return n;
    }
    return null;
  };

  const localCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    const { x, y } = localCoords(e);
    const n = hit(x, y);
    if (!n) return;
    const p = posRef.current.get(n.id);
    dragRef.current = { id: n.id, dx: x - p.x, dy: y - p.y };
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const { x, y } = localCoords(e);
    if (dragRef.current) {
      const { id, dx, dy } = dragRef.current;
      const n = drawNodesById.get(id);
      const r = n?.r ?? rMin;
      const nx = Math.max(r + 2, Math.min(size.w - r - 2, x - dx));
      const ny = Math.max(r + 2, Math.min(size.h - r - 2, y - dy));
      posRef.current.set(id, { x: nx, y: ny });
      setTooltip(null);
      return;
    }
    const n = hit(x, y);
    setHoverId(n ? n.id : null);
    if (n) {
      setTooltip({
        x: e.clientX, y: e.clientY,
        node: n.raw,
      });
    } else {
      setTooltip(null);
    }
  };

  const onPointerUp = (e) => {
    if (dragRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
    }
  };

  const onPointerLeave = () => {
    setHoverId(null);
    setTooltip(null);
    dragRef.current = null;
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        className="block w-full bg-surface border border-border rounded-lg"
        style={{
          height,
          cursor: hoverId ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
      />
      {tooltip ? <NodeTooltip {...tooltip} /> : null}
      <div className="absolute bottom-2 right-3 text-[10px] text-text3 font-mono pointer-events-none">
        drag nodes · radius = revenue
      </div>
    </div>
  );
}

function drawScene(ctx, opt) {
  const { w, h, bg, gridSize, gridColor, edges, positions, nodes, hoverId,
          edgeColor, edgeFlow, textColor, subColor } = opt;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle dot grid — slightly more visible but still recedes behind nodes
  ctx.fillStyle = gridColor;
  ctx.globalAlpha = 0.95;
  for (let x = gridSize; x < w; x += gridSize) {
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Edges (curved with arrow head). Trim curve endpoints to node edges so
  // the line meets the circle border, and the arrow tip sits ON that border
  // — symmetric and centered on the curve.
  for (const e of edges) {
    const a = positions.get(e.source);
    const b = positions.get(e.target);
    if (!a || !b) continue;

    const sourceN = nodesAt(nodes, e.source);
    const targetN = nodesAt(nodes, e.target);
    const sR = (sourceN?.r ?? 18) + 1;
    const tR = (targetN?.r ?? 18) + 1;

    const isHover = hoverId && (e.source === hoverId || e.target === hoverId);
    const stroke  = isHover ? edgeFlow : edgeColor;
    const width   = isHover ? 1.8 : 1.2;

    // Control point: midpoint pushed perpendicular for curvature
    const dx = b.x - a.x, dy = b.y - a.y;
    const norm = Math.hypot(dx, dy) || 1;
    const ox = -dy / norm * 22;
    const oy =  dx / norm * 22;
    const cx_ = (a.x + b.x) / 2 + ox;
    const cy_ = (a.y + b.y) / 2 + oy;

    // Trim start: push out from a along (control - a) by source radius
    const sdx = cx_ - a.x, sdy = cy_ - a.y;
    const sn  = Math.hypot(sdx, sdy) || 1;
    const sx  = a.x + (sdx / sn) * sR;
    const sy  = a.y + (sdy / sn) * sR;

    // Trim end: pull back from b along (control - b) by target radius
    const tdx = cx_ - b.x, tdy = cy_ - b.y;
    const tn  = Math.hypot(tdx, tdy) || 1;
    const ex  = b.x + (tdx / tn) * tR;
    const ey  = b.y + (tdy / tn) * tR;

    ctx.strokeStyle = stroke;
    ctx.lineWidth   = width;
    ctx.globalAlpha = isHover ? 0.95 : 0.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx_, cy_, ex, ey);
    ctx.stroke();

    // Arrow head: tangent at end = (end - control) direction
    const ax_ = ex - cx_;
    const ay_ = ey - cy_;
    const an  = Math.hypot(ax_, ay_) || 1;
    const ux  = ax_ / an, uy = ay_ / an;

    const ah = 9;
    const aw = 5;
    const baseX = ex - ux * ah;
    const baseY = ey - uy * ah;

    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(baseX - uy * aw, baseY + ux * aw);
    ctx.lineTo(baseX + uy * aw, baseY - ux * aw);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Nodes
  for (const n of nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    const isHover = hoverId === n.id;

    // Soft glow if hover
    if (isHover) {
      ctx.beginPath();
      ctx.fillStyle = `${n.color}22`;
      ctx.arc(p.x, p.y, n.r + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    ctx.beginPath();
    ctx.fillStyle = n.fill;
    ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2);
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.lineWidth = isHover ? 2.5 : 1.6;
    ctx.strokeStyle = n.stroke;
    ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = textColor;
    ctx.font = `600 11px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(shorten(n.label, 22), p.x, p.y + n.r + 6);

    if (n.sub) {
      ctx.fillStyle = subColor;
      ctx.font = `500 9px ui-monospace, monospace`;
      ctx.fillText(n.sub, p.x, p.y + n.r + 21);
    }
  }
}

function nodesAt(nodes, id) {
  for (let i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
  return null;
}

const TOOLTIP_W = 240;
const TOOLTIP_H = 132;
const TOOLTIP_GAP = 14;

function NodeTooltip({ x, y, node }) {
  const { C } = useTheme();
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  let left = x + TOOLTIP_GAP;
  let top  = y + TOOLTIP_GAP;
  if (left + TOOLTIP_W + 8 > vw) left = x - TOOLTIP_W - TOOLTIP_GAP;
  if (top  + TOOLTIP_H + 8 > vh) top  = y - TOOLTIP_H - TOOLTIP_GAP;
  left = Math.max(8, left);
  top  = Math.max(8, top);

  return (
    <div
      className="fixed z-10 bg-tooltip-bg border border-border rounded-md px-2.5 py-2 text-[11px] text-text2 pointer-events-none box-border"
      style={{
        left, top,
        width: TOOLTIP_W,
        boxShadow: C.shadow,
      }}
    >
      <div className="font-bold text-text mb-1 text-[12px] truncate">
        {node.legal_name}
      </div>
      <Row label="Revenue"   value={node.total_revenue_fmt} />
      <Row label="Gov %"     value={node.gov_funding_pct != null ? `${(node.gov_funding_pct * 100).toFixed(0)}%` : '—'} />
      <Row label="Overhead"  value={node.strict_overhead_pct != null ? `${node.strict_overhead_pct}%` : '—'} />
      <Row label="Class"     value={node.classification_label || '—'} />
      <Row label="City"      value={[node.city, node.province].filter(Boolean).join(', ') || '—'} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2 py-px min-w-0">
      <span className="text-text3 font-mono text-[10px] shrink-0">{label}</span>
      <span className="text-text font-mono text-[10px] truncate min-w-0">{value ?? '—'}</span>
    </div>
  );
}
