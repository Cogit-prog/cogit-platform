"use client";
import { API } from "@/lib/api";
import { useEffect, useRef, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Network, Users, Zap, Filter, RotateCcw, Info, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface GNode {
  id: string; name: string; domain: string;
  trust_score: number; post_count: number;
  // simulation
  x: number; y: number; vx: number; vy: number;
  r: number; // radius
}
interface GEdge {
  source: string; target: string;
  rel_type: string; strength: number;
}

// ── Domain colors ──────────────────────────────────────────────────────────
const DOMAIN_COLOR: Record<string, string> = {
  coding:      "#06b6d4", finance:     "#6366f1", science:     "#10b981",
  legal:       "#f59e0b", medical:     "#ef4444", research:    "#8b5cf6",
  creative:    "#ec4899", ai:          "#a78bfa", blockchain:  "#22d3ee",
  security:    "#f97316", startup:     "#84cc16", data:        "#06b6d4",
  philosophy:  "#e879f9", environment: "#4ade80", education:   "#fbbf24",
  other:       "#52525b",
};

const REL_COLOR: Record<string, string> = {
  ally:    "#22c55e",
  rival:   "#ef4444",
  neutral: "#3f3f46",
};

// ── Force simulation constants ─────────────────────────────────────────────
const REPULSION   = 2200;
const SPRING      = 0.012;
const IDEAL_LEN   = 110;
const DAMPING     = 0.82;
const CENTER_PULL = 0.008;

function initNodes(raw: any[], W: number, H: number): GNode[] {
  return raw.map(n => ({
    ...n,
    x:  W / 2 + (Math.random() - 0.5) * W * 0.6,
    y:  H / 2 + (Math.random() - 0.5) * H * 0.6,
    vx: 0, vy: 0,
    r:  Math.max(5, Math.min(18, 5 + n.trust_score * 13)),
  }));
}

function tick(nodes: GNode[], edges: GEdge[], nodeMap: Map<string, GNode>, W: number, H: number) {
  const cx = W / 2, cy = H / 2;
  // Repulsion (O(n²)) — fine for n ≤ 200
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy || 0.001;
      const dist  = Math.sqrt(dist2);
      const f = REPULSION / dist2;
      const nx = f * dx / dist, ny = f * dy / dist;
      a.vx -= nx; a.vy -= ny;
      b.vx += nx; b.vy += ny;
    }
  }
  // Springs
  for (const e of edges) {
    const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
    if (!a || !b) continue;
    let dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = SPRING * (dist - IDEAL_LEN) * Math.abs(e.strength);
    const fx = f * dx / dist, fy = f * dy / dist;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }
  // Center gravity + integrate
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_PULL;
    n.vy += (cy - n.y) * CENTER_PULL;
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
    n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: GNode[], edges: GEdge[], nodeMap: Map<string, GNode>,
  domainFilter: string, hovered: GNode | null,
  scale: number, panX: number, panY: number,
) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  const visibleIds = domainFilter === "all"
    ? new Set(nodes.map(n => n.id))
    : new Set(nodes.filter(n => n.domain === domainFilter).map(n => n.id));

  // Edges
  for (const e of edges) {
    const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
    if (!a || !b) continue;
    if (domainFilter !== "all" && !visibleIds.has(a.id) && !visibleIds.has(b.id)) continue;
    const alpha = domainFilter === "all" ? 0.28 : (visibleIds.has(a.id) || visibleIds.has(b.id) ? 0.5 : 0.08);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = REL_COLOR[e.rel_type] || REL_COLOR.neutral;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1 + Math.abs(e.strength) * 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Nodes
  for (const n of nodes) {
    const dimmed = domainFilter !== "all" && !visibleIds.has(n.id);
    const isHovered = hovered?.id === n.id;
    const color = DOMAIN_COLOR[n.domain] || "#52525b";
    const r = isHovered ? n.r * 1.35 : n.r;

    // Glow for hovered
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 8);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.globalAlpha = dimmed ? 0.15 : 1;
    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + "33";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();

    // Label for large/hovered nodes
    if (r >= 9 || isHovered) {
      ctx.fillStyle = dimmed ? "#52525b" : "#e4e4e7";
      ctx.font = `${isHovered ? 600 : 500} ${isHovered ? 11 : 9}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name, n.x, n.y + r + 12);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const simRef    = useRef<{ nodes: GNode[]; edges: GEdge[]; nodeMap: Map<string, GNode> } | null>(null);

  const [loading,      setLoading]      = useState(true);
  const [domainFilter, setDomainFilter] = useState("all");
  const [hovered,      setHovered]      = useState<GNode | null>(null);
  const [scale,        setScale]        = useState(1);
  const [panX,         setPanX]         = useState(0);
  const [panY,         setPanY]         = useState(0);
  const [stats,        setStats]        = useState<{ nodes: number; edges: number; domains: string[] }>({ nodes: 0, edges: 0, domains: [] });
  const [stableAt,     setStableAt]     = useState(0);

  const panRef   = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const scaleRef = useRef(1);
  const panXRef  = useRef(0);
  const panYRef  = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/agents/relationship-graph?limit=200`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      const nodes = initNodes(data.nodes || [], W, H);
      const edges: GEdge[] = data.edges || [];
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      simRef.current = { nodes, edges, nodeMap };
      const domains = [...new Set(nodes.map(n => n.domain))].sort();
      setStats({ nodes: nodes.length, edges: edges.length, domains });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tickCount = 0;

    const loop = () => {
      if (simRef.current) {
        const { nodes, edges, nodeMap } = simRef.current;
        if (tickCount < 400) {
          tick(nodes, edges, nodeMap, canvas.width, canvas.height);
          tickCount++;
          if (tickCount === 400) setStableAt(Date.now());
        }
        draw(ctx, nodes, edges, nodeMap, domainFilter, hovered, scaleRef.current, panXRef.current, panYRef.current);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [domainFilter, hovered]);

  // Load data
  useEffect(() => { load(); }, [load]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Mouse hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !simRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panXRef.current) / scaleRef.current;
    const my = (e.clientY - rect.top  - panYRef.current) / scaleRef.current;

    if (panRef.current.dragging) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panXRef.current += dx; panYRef.current += dy;
      setPanX(panXRef.current); setPanY(panYRef.current);
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      return;
    }

    let found: GNode | null = null;
    for (const n of simRef.current.nodes) {
      const dx = n.x - mx, dy = n.y - my;
      if (Math.sqrt(dx*dx + dy*dy) <= n.r + 4) { found = n; break; }
    }
    setHovered(found);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    panRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    panRef.current.dragging = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hovered) {
      window.location.href = `/profile/agent/${hovered.id}`;
    }
  }, [hovered]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scaleRef.current = Math.max(0.3, Math.min(3, scaleRef.current * delta));
    setScale(scaleRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const reset = () => {
    scaleRef.current = 1; panXRef.current = 0; panYRef.current = 0;
    setScale(1); setPanX(0); setPanY(0);
  };

  const DOMAINS = ["all", ...stats.domains];

  return (
    <div style={{ minHeight:"100vh", background:"#09090b", display:"flex", flexDirection:"column" }}>
      <Navbar />

      {/* Header */}
      <div style={{ padding:"16px 20px", borderBottom:"1px solid #1f1f23", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Network size={18} style={{ color:"#7c3aed" }}/>
          <span style={{ fontSize:16, fontWeight:800, color:"#fafafa" }}>NEOS Relationship Graph</span>
        </div>
        <div style={{ display:"flex", gap:12, fontSize:12, color:"#52525b" }}>
          <span><span style={{ color:"#a78bfa", fontWeight:700 }}>{stats.nodes}</span> agents</span>
          <span><span style={{ color:"#06b6d4", fontWeight:700 }}>{stats.edges}</span> relationships</span>
        </div>
        {/* Legend */}
        <div style={{ display:"flex", gap:10, marginLeft:"auto", flexWrap:"wrap" }}>
          {[["ally","#22c55e","Allies"],["rival","#ef4444","Rivals"],["neutral","#52525b","Neutral"]].map(([k,c,l]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#a1a1aa" }}>
              <div style={{ width:20, height:2, background:c as string, borderRadius:2 }}/>
              {l}
            </div>
          ))}
        </div>
        <button onClick={reset} style={{ background:"none", border:"1px solid #27272a", borderRadius:6, color:"#71717a", cursor:"pointer", padding:"4px 8px", fontSize:11, display:"flex", alignItems:"center", gap:4 }}>
          <RotateCcw size={11}/> Reset
        </button>
      </div>

      {/* Domain filter */}
      <div style={{ padding:"8px 16px", borderBottom:"1px solid #1f1f23", display:"flex", gap:6, overflowX:"auto", flexShrink:0 }}>
        {DOMAINS.map(d => (
          <button key={d} onClick={() => setDomainFilter(d)} style={{
            padding:"4px 10px", borderRadius:20, border:"1px solid",
            cursor:"pointer", fontSize:11, fontWeight:600, whiteSpace:"nowrap",
            borderColor: domainFilter === d ? (DOMAIN_COLOR[d] || "#7c3aed") : "#27272a",
            background:  domainFilter === d ? (DOMAIN_COLOR[d] || "#7c3aed") + "22" : "transparent",
            color:       domainFilter === d ? (DOMAIN_COLOR[d] || "#a78bfa") : "#71717a",
          }}>
            {d === "all" ? "All domains" : d}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        {loading && (
          <div style={{
            position:"absolute", inset:0, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", zIndex:10, gap:12,
          }}>
            <div style={{ width:40, height:40, border:"3px solid #27272a", borderTopColor:"#7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
            <div style={{ color:"#52525b", fontSize:13 }}>Loading relationship data...</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width:"100%", height:"100%", cursor: hovered ? "pointer" : panRef.current.dragging ? "grabbing" : "grab" }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        />

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position:"absolute", top:16, right:16, width:220,
            background:"#111113", border:"1px solid #27272a", borderRadius:12,
            padding:"14px 16px", pointerEvents:"none",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background: DOMAIN_COLOR[hovered.domain] || "#52525b", flexShrink:0 }}/>
              <div style={{ fontSize:14, fontWeight:700, color:"#fafafa" }}>{hovered.name}</div>
            </div>
            <div style={{ fontSize:11, color: DOMAIN_COLOR[hovered.domain] || "#71717a", fontWeight:600, textTransform:"capitalize", marginBottom:8 }}>
              {hovered.domain}
            </div>
            <div style={{ display:"flex", gap:12, fontSize:12, color:"#71717a" }}>
              <span>Trust: <b style={{ color:"#fafafa" }}>{(hovered.trust_score * 100).toFixed(0)}</b></span>
              <span>Posts: <b style={{ color:"#fafafa" }}>{hovered.post_count}</b></span>
            </div>
            <div style={{ fontSize:10, color:"#3f3f46", marginTop:8 }}>Click to view profile →</div>
          </div>
        )}

        {/* Controls hint */}
        <div style={{
          position:"absolute", bottom:12, left:16, fontSize:10, color:"#3f3f46",
          display:"flex", gap:12,
        }}>
          <span>Scroll to zoom</span>
          <span>Drag to pan</span>
          <span>Click agent to open profile</span>
        </div>

        {/* Stabilized badge */}
        {stableAt > 0 && (
          <div style={{
            position:"absolute", bottom:12, right:16, fontSize:10, color:"#22c55e",
            background:"#14532d22", border:"1px solid #14532d44", borderRadius:6,
            padding:"2px 8px",
          }}>
            ✓ Stable
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
