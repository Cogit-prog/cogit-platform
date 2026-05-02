"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ChevronDown, ChevronUp, ExternalLink, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://web-production-6e86d.up.railway.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCGT(n: number) { return Math.round(n).toLocaleString(); }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
function timeAgo(s: string) {
  if (!s) return "";
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cogit_token") ||
    localStorage.getItem("token") ||
    (() => { try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token; } catch { return null; } })()
  );
}

// CPMM calculation
function calcBuyShares(cgtAmount: number, yesPool: number, noPool: number, outcome: "yes" | "no"): number {
  if (cgtAmount <= 0 || yesPool <= 0 || noPool <= 0) return 0;
  const k = yesPool * noPool;
  if (outcome === "yes") {
    const newNoPool = noPool + cgtAmount;
    const newYesPool = k / newNoPool;
    return Math.max(0, yesPool - newYesPool);
  } else {
    const newYesPool = yesPool + cgtAmount;
    const newNoPool = k / newYesPool;
    return Math.max(0, noPool - newNoPool);
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── SVG Probability Chart ─────────────────────────────────────────────────────

interface ChartPoint { t: number; p: number; }

function ProbabilityChart({ points, height = 140 }: { points: ChartPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div style={{
        height, background: "#0d0d10", borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid #1f1f23",
      }}>
        <span style={{ fontSize: 12, color: "#3f3f46" }}>Not enough data to show chart</span>
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padL = 36, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const rangeT = maxT - minT || 1;

  function tx(t: number) { return padL + ((t - minT) / rangeT) * plotW; }
  function ty(p: number) { return padT + (1 - p / 100) * plotH; }

  const pathD = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${tx(pt.t).toFixed(1)} ${ty(pt.p).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${tx(maxT).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;

  // Y axis labels
  const yTicks = [0, 25, 50, 75, 100];

  // X axis: show up to 4 labels
  const xTicks: number[] = [];
  const step = Math.floor(points.length / 3);
  for (let i = 0; i < points.length; i += Math.max(1, step)) xTicks.push(points[i].t);
  if (xTicks[xTicks.length - 1] !== maxT) xTicks.push(maxT);

  return (
    <div style={{ background: "#0d0d10", borderRadius: 10, border: "1px solid #1f1f23", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height, display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(y => (
          <line key={y}
            x1={padL} y1={ty(y)} x2={padL + plotW} y2={ty(y)}
            stroke="#1f1f23" strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={areaD} fill="url(#chartGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />

        {/* Y axis labels */}
        {yTicks.map(y => (
          <text key={y}
            x={padL - 4} y={ty(y) + 4}
            textAnchor="end"
            fill="#3f3f46"
            fontSize={9}
            fontFamily="monospace"
          >
            {y}%
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map((t, i) => {
          const label = new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <text key={i}
              x={tx(t)} y={H - 6}
              textAnchor="middle"
              fill="#3f3f46"
              fontSize={8}
              fontFamily="sans-serif"
            >
              {label}
            </text>
          );
        })}

        {/* Hover dot at last point */}
        <circle
          cx={tx(points[points.length - 1].t)}
          cy={ty(points[points.length - 1].p)}
          r="4"
          fill="#22c55e"
          stroke="#0d0d10"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type = "success", onDone }: { msg: string; type?: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const isErr = type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: isErr ? "#ef444412" : "#22c55e12",
      border: `1px solid ${isErr ? "#ef444444" : "#22c55e44"}`,
      borderRadius: 10, padding: "12px 20px",
      fontSize: 14, fontWeight: 600,
      color: isErr ? "#ef4444" : "#22c55e",
      zIndex: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      animation: "fadeUp 0.25s ease", whiteSpace: "nowrap",
    }}>
      {msg}
    </div>
  );
}

// ── Trading Panel ─────────────────────────────────────────────────────────────

function TradingPanel({
  market,
  defaultOutcome,
  onTraded,
}: {
  market: any;
  defaultOutcome: "yes" | "no";
  onTraded: (result: any) => void;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"yes" | "no">(defaultOutcome);
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userCGT, setUserCGT] = useState<number | null>(null);
  const isLoggedIn = !!getToken();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/users/me`, { headers: { "authorization": `Bearer ${token}`, "x-authorization": `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (typeof d.cgt_balance === "number") setUserCGT(d.cgt_balance); })
      .catch(() => {});
  }, []);

  const yesPool = market.yes_pool ?? 1000;
  const noPool = market.no_pool ?? 1000;
  const shares = calcBuyShares(amount, yesPool, noPool, outcome);
  const pricePerShare = shares > 0 ? amount / shares : 0;

  async function trade() {
    const token = getToken();
    if (!token) { router.push("/join"); return; }
    if (amount <= 0) { setError("Enter a valid amount"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/markets/${market.id}/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`,
          "x-authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          outcome,
          cgt_amount: amount,
          trade_type: "buy",
          min_shares: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Trade failed");
      } else {
        onTraded(data);
        if (typeof data.user_cgt_balance === "number") setUserCGT(data.user_cgt_balance);
      }
    } catch {
      setError("Network error — please try again");
    }
    setLoading(false);
  }

  const yesP = market.probability_yes ?? 0.5;
  const noP = 1 - yesP;

  const position = market.user_position;

  return (
    <div style={{
      background: "#111113", border: "1px solid #1f1f23",
      borderRadius: 14, padding: "20px",
      position: "sticky", top: 80,
    }}>
      {/* Current probability */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          Current Probability
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", width: 28 }}>YES</span>
            <div style={{ flex: 1, height: 10, background: "#1a2a1a", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${yesP * 100}%`, height: "100%", background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: 5 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#22c55e", minWidth: 44, textAlign: "right" }}>{fmtPct(yesP * 100)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", width: 28 }}>NO</span>
            <div style={{ flex: 1, height: 10, background: "#2a1a1a", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${noP * 100}%`, height: "100%", background: "linear-gradient(90deg,#b91c1c,#ef4444)", borderRadius: 5 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#ef4444", minWidth: 44, textAlign: "right" }}>{fmtPct(noP * 100)}</span>
          </div>
        </div>
      </div>

      {/* Outcome tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["yes", "no"] as const).map(o => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            style={{
              flex: 1, padding: "10px 0",
              border: `2px solid ${outcome === o ? (o === "yes" ? "#22c55e" : "#ef4444") : "#27272a"}`,
              borderRadius: 9,
              background: outcome === o ? (o === "yes" ? "#22c55e14" : "#ef444414") : "transparent",
              color: outcome === o ? (o === "yes" ? "#22c55e" : "#ef4444") : "#71717a",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {o.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#a1a1aa", marginBottom: 6 }}>
          Amount (CGT)
        </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
          style={{
            width: "100%", background: "#18181b",
            border: "1px solid #27272a", borderRadius: 8,
            padding: "10px 12px", fontSize: 16, fontWeight: 700,
            color: "#fafafa", outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target.style.borderColor = "#7c3aed")}
          onBlur={e => (e.target.style.borderColor = "#27272a")}
        />

        {/* Quick picks */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {[25, 50, 100, 250].map(v => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                flex: 1, padding: "6px 0",
                background: amount === v ? "#7c3aed18" : "#18181b",
                border: `1px solid ${amount === v ? "#7c3aed66" : "#27272a"}`,
                borderRadius: 7, color: amount === v ? "#a78bfa" : "#52525b",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calculation preview */}
      <div style={{
        background: "#0d0d10", border: "1px solid #1f1f23",
        borderRadius: 10, padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#52525b" }}>You receive</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>
            ~{shares.toFixed(2)} shares
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#52525b" }}>Price per share</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>
            {pricePerShare.toFixed(4)} CGT
          </span>
        </div>
        {userCGT !== null && (
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1f1f23", paddingTop: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "#52525b" }}>Your balance</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4" }}>
              {fmtCGT(userCGT)} CGT
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: "#ef444412", border: "1px solid #ef444433",
          borderRadius: 8, padding: "8px 12px", marginBottom: 12,
          fontSize: 12, color: "#ef4444",
        }}>
          {error}
        </div>
      )}

      {isLoggedIn ? (
        <button
          onClick={trade}
          disabled={loading || market.status !== "open"}
          style={{
            width: "100%", padding: "13px 0",
            background: loading || market.status !== "open"
              ? "#27272a"
              : outcome === "yes"
              ? "linear-gradient(135deg,#16a34a,#22c55e)"
              : "linear-gradient(135deg,#b91c1c,#ef4444)",
            border: "none", borderRadius: 10,
            color: "white", fontSize: 14, fontWeight: 700,
            cursor: loading || market.status !== "open" ? "not-allowed" : "pointer",
            transition: "opacity 0.15s",
            boxShadow: market.status === "open" ? `0 2px 12px ${outcome === "yes" ? "#22c55e44" : "#ef444444"}` : "none",
          }}
          onMouseEnter={e => { if (!loading && market.status === "open") (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          {loading ? "Processing…" : market.status !== "open" ? "Market Closed" : `Buy ${outcome.toUpperCase()} for ${fmtCGT(amount)} CGT`}
        </button>
      ) : (
        <Link href="/join" style={{ textDecoration: "none", display: "block" }}>
          <button style={{
            width: "100%", padding: "13px 0",
            background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
            border: "none", borderRadius: 10,
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            Connect to trade
          </button>
        </Link>
      )}

      {/* Your position */}
      {position && (position.shares_yes > 0 || position.shares_no > 0) && (
        <div style={{
          marginTop: 16, background: "#0d0d10",
          border: "1px solid #1f1f23", borderRadius: 10, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            Your Position
          </div>
          {position.shares_yes > 0 && (
            <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>
              {position.shares_yes.toFixed(2)} YES shares
              {position.current_value_yes != null && (
                <span style={{ color: "#52525b", fontWeight: 400 }}> (worth ~{fmtCGT(position.current_value_yes)} CGT)</span>
              )}
            </div>
          )}
          {position.shares_no > 0 && (
            <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
              {position.shares_no.toFixed(2)} NO shares
              {position.current_value_no != null && (
                <span style={{ color: "#52525b", fontWeight: 400 }}> (worth ~{fmtCGT(position.current_value_no)} CGT)</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const defaultOutcome = (searchParams?.get("outcome") as "yes" | "no") || "yes";

  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCriteria, setShowCriteria] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const loadMarket = useCallback(async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["authorization"] = `Bearer ${token}`;
        headers["x-authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API}/markets/${id}`, { headers });
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setMarket(data);
    } catch { /* silent */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  function handleTraded(result: any) {
    setToast({ msg: `Trade successful! +${result.shares?.toFixed(2)} shares`, type: "success" });
    loadMarket();
  }

  // Build chart points from recent_trades
  const chartPoints: { t: number; p: number }[] = [];
  if (market?.recent_trades && Array.isArray(market.recent_trades)) {
    let runningYes = market.yes_pool ?? 1000;
    let runningNo = market.no_pool ?? 1000;

    // Start point
    chartPoints.push({ t: new Date(market.closes_at ? Date.now() - 7 * 24 * 60 * 60 * 1000 : Date.now()).getTime(), p: (market.probability_yes ?? 0.5) * 100 });

    const sorted = [...market.recent_trades].reverse();
    for (const trade of sorted) {
      const ts = trade.created_at ? new Date(trade.created_at).getTime() : Date.now();
      const p = runningYes / (runningYes + runningNo) * 100;
      chartPoints.push({ t: ts, p });
    }
    // Current
    chartPoints.push({ t: Date.now(), p: (market.probability_yes ?? 0.5) * 100 });
  } else if (market) {
    // Synthetic 2-point line
    const p = (market.probability_yes ?? 0.5) * 100;
    chartPoints.push(
      { t: Date.now() - 7 * 24 * 60 * 60 * 1000, p },
      { t: Date.now(), p },
    );
  }

  // Deduplicate and sort
  const sortedChartPoints = [...chartPoints]
    .sort((a, b) => a.t - b.t)
    .filter((pt, i, arr) => i === 0 || pt.t !== arr[i - 1].t);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "3 1 400px", minWidth: 0 }}>
              <Skeleton height={36} radius={8} />
              <div style={{ marginTop: 12 }}><Skeleton height={36} width="70%" radius={8} /></div>
              <div style={{ marginTop: 24 }}><Skeleton height={16} radius={4} /></div>
              <div style={{ marginTop: 8 }}><Skeleton height={16} radius={4} /></div>
              <div style={{ marginTop: 8 }}><Skeleton height={16} width="80%" radius={4} /></div>
              <div style={{ marginTop: 24 }}><Skeleton height={160} radius={10} /></div>
            </div>
            <div style={{ flex: "2 1 280px" }}>
              <Skeleton height={400} radius={14} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!market) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b" }}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-16" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 12 }}>Market not found</div>
          <Link href="/markets" style={{ color: "#7c3aed", textDecoration: "none", fontSize: 14 }}>← Back to Markets</Link>
        </main>
      </div>
    );
  }

  const catEmoji: Record<string, string> = {
    crypto: "🪙", politics: "🏛️", economy: "📈", tech: "💻",
    science: "🔬", sports: "⚽", neos: "🌆",
  };
  const emoji = catEmoji[market.category?.toLowerCase() ?? ""] ?? "❓";

  const isOpen = market.status === "open";
  const resolved = market.status === "resolved";

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push("/markets")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: "#52525b",
              fontSize: 13, cursor: "pointer", padding: 0,
              transition: "color 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#a1a1aa")}
            onMouseLeave={e => (e.currentTarget.style.color = "#52525b")}
          >
            <ArrowLeft size={14} /> Back to Markets
          </button>
        </div>

        <div className="fade-up" style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left column */}
          <div style={{ flex: "3 1 400px", minWidth: 0 }}>
            {/* Title + badges */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                  background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed33",
                }}>
                  {emoji} {market.category ?? "Other"}
                </span>

                {resolved ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                    background: market.resolved_outcome === "yes" ? "#22c55e18" : "#ef444418",
                    color: market.resolved_outcome === "yes" ? "#22c55e" : "#ef4444",
                    border: `1px solid ${market.resolved_outcome === "yes" ? "#22c55e33" : "#ef444433"}`,
                  }}>
                    {market.resolved_outcome === "yes" ? "✅ YES WON" : "❌ NO WON"}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                    background: isOpen ? "#22c55e12" : "#71717a18",
                    color: isOpen ? "#22c55e" : "#71717a",
                    border: `1px solid ${isOpen ? "#22c55e33" : "#3f3f46"}`,
                  }}>
                    {isOpen ? "OPEN" : market.status?.toUpperCase() ?? "CLOSED"}
                  </span>
                )}

                <span style={{ fontSize: 12, color: "#52525b" }}>
                  Closes {fmtDate(market.closes_at)}
                </span>
              </div>

              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fafafa", lineHeight: 1.3, letterSpacing: "-0.5px" }}>
                {market.title}
              </h1>
            </div>

            {/* Description */}
            {market.description && (
              <p style={{ fontSize: 14, color: "#a1a1aa", lineHeight: 1.7, marginBottom: 20 }}>
                {market.description}
              </p>
            )}

            {/* Resolution criteria (collapsible) */}
            {market.resolution_criteria && (
              <div style={{
                background: "#111113", border: "1px solid #1f1f23",
                borderRadius: 10, marginBottom: 24, overflow: "hidden",
              }}>
                <button
                  onClick={() => setShowCriteria(v => !v)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", background: "none", border: "none",
                    cursor: "pointer", color: "#a1a1aa", fontSize: 13, fontWeight: 600,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#18181b")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  Resolution Criteria
                  {showCriteria ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showCriteria && (
                  <div style={{ padding: "0 16px 16px", fontSize: 13, color: "#71717a", lineHeight: 1.6 }}>
                    {market.resolution_criteria}
                  </div>
                )}
              </div>
            )}

            {/* Probability chart */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                YES Probability Over Time
              </div>
              <ProbabilityChart points={sortedChartPoints} height={140} />
            </div>

            {/* Volume stat */}
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              {[
                { label: "Total Volume", value: `${fmtCGT(market.total_volume ?? 0)} CGT`, color: "#7c3aed" },
                { label: "YES Pool", value: `${fmtCGT(market.yes_pool ?? 0)} CGT`, color: "#22c55e" },
                { label: "NO Pool", value: `${fmtCGT(market.no_pool ?? 0)} CGT`, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#111113", border: "1px solid #1f1f23",
                  borderRadius: 10, padding: "12px 16px", flex: "1 1 120px",
                }}>
                  <div style={{ fontSize: 10, color: "#52525b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Recent trades table */}
            {market.recent_trades && market.recent_trades.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 12 }}>
                  Recent Trades
                </div>
                <div style={{
                  background: "#111113", border: "1px solid #1f1f23",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  {/* Header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 80px 80px",
                    padding: "10px 16px", borderBottom: "1px solid #1f1f23",
                    fontSize: 11, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>
                    <span>Time</span>
                    <span style={{ textAlign: "center" }}>Side</span>
                    <span style={{ textAlign: "right" }}>Shares</span>
                    <span style={{ textAlign: "right" }}>Price</span>
                  </div>

                  {market.recent_trades.map((trade: any, i: number) => {
                    const isYes = trade.outcome === "yes";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 80px 80px 80px",
                          padding: "10px 16px",
                          borderBottom: i < market.recent_trades.length - 1 ? "1px solid #18181b" : "none",
                          background: i % 2 === 0 ? "transparent" : "#0d0d10",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#18181b")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "transparent" : "#0d0d10")}
                      >
                        <span style={{ fontSize: 12, color: "#52525b" }}>{timeAgo(trade.created_at)}</span>
                        <span style={{
                          textAlign: "center",
                          fontSize: 11, fontWeight: 700,
                          color: isYes ? "#22c55e" : "#ef4444",
                        }}>
                          {trade.outcome?.toUpperCase()}
                        </span>
                        <span style={{ textAlign: "right", fontSize: 12, color: "#a1a1aa", fontWeight: 600 }}>
                          {(trade.shares ?? 0).toFixed(2)}
                        </span>
                        <span style={{ textAlign: "right", fontSize: 12, color: "#71717a" }}>
                          {(trade.price ?? 0).toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column — trading panel */}
          <div style={{ flex: "2 1 280px", minWidth: 280 }}>
            <TradingPanel market={market} defaultOutcome={defaultOutcome} onTraded={handleTraded} />
          </div>
        </div>
      </main>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
