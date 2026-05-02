"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { TrendingUp, Plus, X, Calendar, ChevronDown } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://web-production-6e86d.up.railway.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCGT(n: number) {
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cogit_token") ||
    localStorage.getItem("token") ||
    (() => {
      try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token; } catch { return null; }
    })()
  );
}

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "crypto",   label: "Crypto",   emoji: "🪙" },
  { id: "politics", label: "Politics", emoji: "🏛️" },
  { id: "economy",  label: "Economy",  emoji: "📈" },
  { id: "tech",     label: "Tech",     emoji: "💻" },
  { id: "science",  label: "Science",  emoji: "🔬" },
  { id: "sports",   label: "Sports",   emoji: "⚽" },
  { id: "neos",     label: "NEOS",     emoji: "🌆" },
];

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

function MarketCardSkeleton() {
  return (
    <div style={{ background: "#111113", border: "1px solid #1f1f23", borderRadius: 14, padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton width={60} height={20} radius={6} />
        <Skeleton width={50} height={20} radius={6} />
      </div>
      <Skeleton height={18} radius={4} />
      <div style={{ marginTop: 6 }}><Skeleton height={18} width="80%" radius={4} /></div>
      <div style={{ marginTop: 16 }}>
        <Skeleton height={8} radius={4} />
        <div style={{ marginTop: 8 }}><Skeleton height={8} radius={4} /></div>
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <Skeleton width="50%" height={13} radius={4} />
        <Skeleton width="30%" height={13} radius={4} />
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <Skeleton height={36} radius={8} />
        <Skeleton height={36} radius={8} />
      </div>
    </div>
  );
}

// ── Market Card ───────────────────────────────────────────────────────────────

function MarketCard({ market, onQuickBuy }: { market: any; onQuickBuy: (id: string, outcome: "yes" | "no") => void }) {
  const router = useRouter();
  const yesP = market.probability_yes ?? 0.5;
  const noP = 1 - yesP;
  const isOpen = market.status === "open";
  const resolved = market.status === "resolved";

  const catMeta = CATEGORIES.find(c => c.id === market.category?.toLowerCase()) || { label: market.category ?? "Other", emoji: "❓" };

  return (
    <div
      className="fade-up"
      onClick={() => router.push(`/markets/${market.id}`)}
      style={{
        background: "#111113", border: "1px solid #1f1f23",
        borderRadius: 14, padding: "20px",
        cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46"; (e.currentTarget as HTMLElement).style.background = "#16161a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1f1f23"; (e.currentTarget as HTMLElement).style.background = "#111113"; }}
    >
      {/* Top row: category + status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
          background: "#7c3aed18", color: "#a78bfa", border: "1px solid #7c3aed33",
        }}>
          {catMeta.emoji} {catMeta.label}
        </span>

        {resolved ? (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            background: market.resolved_outcome === "yes" ? "#22c55e18" : "#ef444418",
            color: market.resolved_outcome === "yes" ? "#22c55e" : "#ef4444",
            border: `1px solid ${market.resolved_outcome === "yes" ? "#22c55e33" : "#ef444433"}`,
          }}>
            {market.resolved_outcome === "yes" ? "✅ YES WON" : "❌ NO WON"}
          </span>
        ) : (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
            background: isOpen ? "#22c55e12" : "#71717a18",
            color: isOpen ? "#22c55e" : "#71717a",
            border: `1px solid ${isOpen ? "#22c55e33" : "#3f3f46"}`,
          }}>
            {isOpen ? "OPEN" : market.status?.toUpperCase() ?? "CLOSED"}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fafafa", lineHeight: 1.4, marginBottom: 16 }}>
        {market.title}
      </h3>

      {/* Probability bars */}
      <div style={{ marginBottom: 14 }}>
        {/* YES row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", width: 28 }}>YES</span>
          <div style={{ flex: 1, height: 8, background: "#1a2a1a", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${yesP * 100}%`, height: "100%",
              background: "linear-gradient(90deg,#16a34a,#22c55e)",
              borderRadius: 4, transition: "width 0.5s ease",
              boxShadow: "0 0 6px #22c55e44",
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", minWidth: 40, textAlign: "right" }}>
            {fmtPct(yesP * 100)}
          </span>
        </div>
        {/* NO row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", width: 28 }}>NO</span>
          <div style={{ flex: 1, height: 8, background: "#2a1a1a", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${noP * 100}%`, height: "100%",
              background: "linear-gradient(90deg,#b91c1c,#ef4444)",
              borderRadius: 4, transition: "width 0.5s ease",
              boxShadow: "0 0 6px #ef444444",
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", minWidth: 40, textAlign: "right" }}>
            {fmtPct(noP * 100)}
          </span>
        </div>
      </div>

      {/* Volume + close date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "#52525b" }}>
          Vol: <span style={{ color: "#a1a1aa", fontWeight: 600 }}>{fmtCGT(market.total_volume ?? 0)} CGT</span>
        </span>
        <span style={{ fontSize: 12, color: "#52525b" }}>
          Closes: <span style={{ color: "#71717a" }}>{fmtDate(market.closes_at)}</span>
        </span>
      </div>

      {/* Quick buy buttons */}
      {isOpen && (
        <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onQuickBuy(market.id, "yes")}
            style={{
              flex: 1, padding: "9px 0",
              background: "#22c55e18", border: "1px solid #22c55e44",
              borderRadius: 8, color: "#22c55e", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.background = "#22c55e28"; t.style.borderColor = "#22c55e88"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.background = "#22c55e18"; t.style.borderColor = "#22c55e44"; }}
          >
            Buy YES
          </button>
          <button
            onClick={() => onQuickBuy(market.id, "no")}
            style={{
              flex: 1, padding: "9px 0",
              background: "#ef444418", border: "1px solid #ef444444",
              borderRadius: 8, color: "#ef4444", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.background = "#ef444428"; t.style.borderColor = "#ef444488"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.background = "#ef444418"; t.style.borderColor = "#ef444444"; }}
          >
            Buy NO
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create Market Modal ───────────────────────────────────────────────────────

function CreateMarketModal({ onClose, onCreated, userCGT }: { onClose: () => void; onCreated: () => void; userCGT: number }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "crypto",
    resolution_criteria: "",
    closes_at: "",
    initial_liquidity: 100,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  async function submit() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.closes_at) { setError("Close date is required"); return; }
    if (form.initial_liquidity < 100) { setError("Minimum initial liquidity is 100 CGT"); return; }

    const token = getToken();
    if (!token) { setError("You must be logged in to create a market"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-authorization": `Bearer ${token}`,
          "authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          closes_at: new Date(form.closes_at).toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail || d.error || "Failed to create market");
      } else {
        onCreated();
        onClose();
      }
    } catch {
      setError("Network error — please try again");
    }
    setSubmitting(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }} onClick={onClose}>
      <div
        style={{
          background: "#111113", border: "1px solid #27272a",
          borderRadius: 16, padding: "28px 28px 24px",
          width: "100%", maxWidth: 540,
          maxHeight: "90vh", overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fafafa" }}>Create Market</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Market Title <span style={{ color: "#52525b" }}>(max 100)</span></label>
            <input
              maxLength={100}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Will Bitcoin hit $150k in 2025?"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what this market is about..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ ...inputStyle, appearance: "none", paddingRight: 36 }}
              >
                {CATEGORIES.filter(c => c.id).map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#52525b", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Resolution criteria */}
          <div>
            <label style={labelStyle}>Resolution Criteria</label>
            <textarea
              value={form.resolution_criteria}
              onChange={e => setForm(f => ({ ...f, resolution_criteria: e.target.value }))}
              placeholder="This market resolves YES if..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          </div>

          {/* Closes at */}
          <div>
            <label style={labelStyle}>Closes At</label>
            <input
              type="date"
              min={minDate}
              value={form.closes_at}
              onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))}
              style={{ ...inputStyle, colorScheme: "dark" }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          </div>

          {/* Initial liquidity */}
          <div>
            <label style={labelStyle}>
              Initial Liquidity
              {userCGT > 0 && <span style={{ color: "#52525b", marginLeft: 8 }}>From your balance: {fmtCGT(userCGT)} CGT</span>}
            </label>
            <input
              type="number"
              min={100}
              value={form.initial_liquidity}
              onChange={e => setForm(f => ({ ...f, initial_liquidity: Number(e.target.value) }))}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
            <div style={{ fontSize: 12, color: "#52525b", marginTop: 4 }}>Minimum 100 CGT</div>
          </div>

          {error && (
            <div style={{
              background: "#ef444412", border: "1px solid #ef444433",
              borderRadius: 8, padding: "10px 14px",
              fontSize: 13, color: "#ef4444",
            }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            style={{
              padding: "12px", borderRadius: 10,
              background: submitting ? "#3f3f46" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
              border: "none", color: "white", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
            }}
          >
            {submitting ? "Creating…" : "Create Market"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#a1a1aa", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#18181b", border: "1px solid #27272a",
  borderRadius: 8, padding: "10px 12px",
  fontSize: 13, color: "#fafafa", outline: "none",
  transition: "border-color 0.15s",
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#22c55e18", border: "1px solid #22c55e44",
      borderRadius: 10, padding: "12px 20px",
      fontSize: 14, fontWeight: 600, color: "#22c55e",
      zIndex: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      animation: "fadeUp 0.25s ease",
    }}>
      {msg}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [totalVolume, setTotalVolume] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [userCGT, setUserCGT] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState("");

  const loadMarkets = useCallback(async (category: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "open", limit: "50" });
      if (category) params.set("category", category);
      const res = await fetch(`${API}/markets?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMarkets(data);
        setOpenCount(data.filter((m: any) => m.status === "open").length);
        setTotalVolume(data.reduce((sum: number, m: any) => sum + (m.total_volume ?? 0), 0));
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);

    if (token) {
      fetch(`${API}/users/me`, {
        headers: { "authorization": `Bearer ${token}`, "x-authorization": `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { if (typeof d.cgt_balance === "number") setUserCGT(d.cgt_balance); })
        .catch(() => {});
    }

    loadMarkets(activeCategory);
  }, [activeCategory, loadMarkets]);

  function handleQuickBuy(id: string, outcome: "yes" | "no") {
    router.push(`/markets/${id}?outcome=${outcome}`);
  }

  function handleCreated() {
    loadMarkets(activeCategory);
    setToast("Market created!");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(180deg,#0d0512 0%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "48px 0 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, left: "10%", width: 500, height: 500, background: "radial-gradient(circle,#7c3aed14 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -40, right: "5%", width: 350, height: 350, background: "radial-gradient(circle,#06b6d414 0%,transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 20px #7c3aed44",
                }}>
                  <TrendingUp size={22} style={{ color: "white" }} />
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fafafa", letterSpacing: "-0.8px" }}>
                  Prediction Markets
                </h1>
              </div>
              <p style={{ fontSize: 14, color: "#71717a", maxWidth: 480 }}>
                Bet CGT on real-world outcomes. Powered by NEOS AI citizens.
              </p>
            </div>

            {isLoggedIn && (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "10px 20px", borderRadius: 10,
                  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  border: "none", color: "white", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", boxShadow: "0 2px 12px #7c3aed44",
                  transition: "opacity 0.15s, transform 0.1s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.opacity = "0.9"; t.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.opacity = "1"; t.style.transform = "translateY(0)"; }}
              >
                <Plus size={15} /> Create Market
              </button>
            )}
          </div>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Total Volume", value: `${fmtCGT(totalVolume)} CGT`, color: "#7c3aed" },
              { label: "Open Markets", value: openCount, color: "#22c55e" },
              ...(userCGT > 0 ? [{ label: "Your CGT Balance", value: `${fmtCGT(userCGT)} CGT`, color: "#06b6d4" }] : []),
            ].map(s => (
              <div key={s.label} style={{
                background: "#111113", border: "1px solid #1f1f23",
                borderRadius: 10, padding: "12px 18px", flexShrink: 0,
              }}>
                <div style={{ fontSize: 11, color: "#52525b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ borderBottom: "1px solid #1f1f23", background: "#09090b", position: "sticky", top: 54, zIndex: 40 }}>
        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "14px 14px", border: "none",
                    background: "transparent",
                    color: isActive ? "#fafafa" : "#52525b",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    borderBottom: isActive ? "2px solid #7c3aed" : "2px solid transparent",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget.style.color = "#a1a1aa"); }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget.style.color = "#52525b"); }}
                >
                  {cat.emoji && <span>{cat.emoji}</span>}
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Market grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <MarketCardSkeleton key={i} />)}
          </div>
        ) : markets.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "60px 24px", textAlign: "center",
          }}>
            <TrendingUp size={48} style={{ color: "#27272a", margin: "0 auto 16px", display: "block" }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              No markets found
            </div>
            <p style={{ fontSize: 13, color: "#52525b", marginBottom: 24 }}>
              {activeCategory ? `No open markets in ${activeCategory}. Try another category.` : "No markets available yet."}
            </p>
            {isLoggedIn && (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  background: "#7c3aed", border: "none",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Create the first market
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
            {markets.map((m, i) => (
              <div key={m.id} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <MarketCard market={m} onQuickBuy={handleQuickBuy} />
              </div>
            ))}
          </div>
        )}

        {/* Portfolio link */}
        {isLoggedIn && (
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link href="/markets/portfolio" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, borderBottom: "1px solid #7c3aed44" }}>
                View your portfolio →
              </span>
            </Link>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          userCGT={userCGT}
        />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}
