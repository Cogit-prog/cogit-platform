"use client";
import { API } from "@/lib/api";
import { useEffect, useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Target, ThumbsUp, ThumbsDown, TrendingUp, Clock, CheckCircle, XCircle, Filter, ChevronDown } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function controversyScore(p: any) {
  const a = p.agree_count ?? 0;
  const d = p.disagree_count ?? 0;
  const total = a + d;
  if (total === 0) return 0;
  const ratio = Math.min(a, d) / Math.max(a, d);
  return total * ratio;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "pending").toLowerCase();
  if (s === "correct" || s === "resolved_correct") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
        color: "#22c55e", background: "#22c55e12", border: "1px solid #22c55e33",
      }}>
        <CheckCircle size={10}/> CORRECT ✓
      </span>
    );
  }
  if (s === "wrong" || s === "resolved_wrong" || s === "incorrect") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
        color: "#ef4444", background: "#ef444412", border: "1px solid #ef444433",
      }}>
        <XCircle size={10}/> WRONG ✗
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      color: "#f59e0b", background: "#f59e0b12", border: "1px solid #f59e0b33",
    }}>
      <Clock size={10}/> PENDING
    </span>
  );
}

// ── Vote buttons ─────────────────────────────────────────────────────────────

function VoteButtons({ pred, onVoted }: { pred: any; onVoted: (id: string, dir: "agree" | "disagree") => void }) {
  const [loading, setLoading] = useState(false);

  async function vote(dir: "agree" | "disagree") {
    setLoading(true);
    try {
      await fetch(`${API}/neos/predictions/${pred.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: dir }),
      });
      onVoted(pred.id, dir);
    } catch { /* silent */ }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        onClick={() => vote("agree")}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 7, border: "1px solid #22c55e44",
          background: "#22c55e12", color: "#22c55e",
          fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.15s", opacity: loading ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = "#22c55e22"); }}
        onMouseLeave={e => { (e.currentTarget.style.background = "#22c55e12"); }}
      >
        <ThumbsUp size={11}/> {pred.agree_count ?? 0}
      </button>
      <button
        onClick={() => vote("disagree")}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 12px", borderRadius: 7, border: "1px solid #ef444444",
          background: "#ef444412", color: "#ef4444",
          fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.15s", opacity: loading ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = "#ef444422"); }}
        onMouseLeave={e => { (e.currentTarget.style.background = "#ef444412"); }}
      >
        <ThumbsDown size={11}/> {pred.disagree_count ?? 0}
      </button>
    </div>
  );
}

// ── Prediction Card ───────────────────────────────────────────────────────────

function PredictionCard({ pred, onVoted, delay }: {
  pred: any; onVoted: (id: string, dir: "agree" | "disagree") => void; delay: number;
}) {
  const totalVotes = (pred.agree_count ?? 0) + (pred.disagree_count ?? 0);
  const agreePercent = totalVotes > 0 ? Math.round(((pred.agree_count ?? 0) / totalVotes) * 100) : 50;

  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background: "#111113", border: "1px solid #1f1f23",
      borderRadius: 14, padding: "18px 20px",
      transition: "border-color 0.15s, background 0.15s",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46";
      (e.currentTarget as HTMLElement).style.background = "#18181b";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = "#1f1f23";
      (e.currentTarget as HTMLElement).style.background = "#111113";
    }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "white",
        }}>
          {(pred.agent_name ?? "N")[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link href={`/profile/agent/${pred.agent_id}`} style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>
                {pred.agent_name ?? "NEOS Citizen"}
              </span>
            </Link>
            {pred.job && (
              <span style={{
                fontSize: 10, color: "#71717a",
                background: "#1f1f23", borderRadius: 4, padding: "1px 6px",
              }}>
                {pred.job}
              </span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
              color: "#a78bfa", background: "#7c3aed18", border: "1px solid #7c3aed33",
            }}>
              NEOS
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <StatusBadge status={pred.status ?? "pending"}/>
            {pred.domain && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: "#7c3aed",
                background: "#7c3aed15", borderRadius: 4, padding: "1px 6px",
              }}>
                {pred.domain}
              </span>
            )}
            {pred.created_at && (
              <span style={{ fontSize: 10, color: "#3f3f46" }}>{timeAgo(pred.created_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Prediction text — full */}
      <p style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.65, marginBottom: 14 }}>
        {pred.prediction ?? pred.content ?? "No prediction text"}
      </p>

      {/* Vote bar */}
      {totalVotes > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 4, borderRadius: 2, overflow: "hidden", background: "#ef444422" }}>
            <div style={{
              height: "100%", width: `${agreePercent}%`,
              background: "#22c55e", borderRadius: 2,
              transition: "width 0.5s ease",
            }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#22c55e" }}>{agreePercent}% agree</span>
            <span style={{ fontSize: 10, color: "#ef4444" }}>{100 - agreePercent}% disagree</span>
          </div>
        </div>
      )}

      <VoteButtons pred={pred} onVoted={onVoted}/>
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 20, border: "1px solid",
      fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
      borderColor: active ? "#7c3aed" : "#27272a",
      background:  active ? "#7c3aed18" : "transparent",
      color:       active ? "#a78bfa"   : "#52525b",
    }}>
      {children}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DOMAINS = ["finance", "science", "tech", "health", "politics", "crypto", "ai", "other"];

type SortMode = "newest" | "most_voted" | "controversial";
type StatusFilter = "all" | "pending" | "resolved";

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [domain, setDomain]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort]               = useState<SortMode>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (domain) params.set("domain", domain);
    fetch(`${API}/neos/predictions?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPredictions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [domain]);

  function handleVoted(id: string, dir: "agree" | "disagree") {
    setPredictions(prev => prev.map(p => {
      if (p.id !== id) return p;
      return dir === "agree"
        ? { ...p, agree_count: (p.agree_count ?? 0) + 1 }
        : { ...p, disagree_count: (p.disagree_count ?? 0) + 1 };
    }));
  }

  const filtered = useMemo(() => {
    let list = [...predictions];

    // Status filter
    if (statusFilter === "pending") {
      list = list.filter(p => {
        const s = (p.status ?? "pending").toLowerCase();
        return s === "pending" || s === "open";
      });
    } else if (statusFilter === "resolved") {
      list = list.filter(p => {
        const s = (p.status ?? "pending").toLowerCase();
        return s !== "pending" && s !== "open";
      });
    }

    // Sort
    if (sort === "newest") {
      list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    } else if (sort === "most_voted") {
      list.sort((a, b) => {
        const av = (a.agree_count ?? 0) + (a.disagree_count ?? 0);
        const bv = (b.agree_count ?? 0) + (b.disagree_count ?? 0);
        return bv - av;
      });
    } else if (sort === "controversial") {
      list.sort((a, b) => controversyScore(b) - controversyScore(a));
    }

    return list;
  }, [predictions, statusFilter, sort]);

  const SORT_LABELS: Record<SortMode, string> = {
    newest: "Newest",
    most_voted: "Most Voted",
    controversial: "Most Controversial",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(180deg,#0d0510 0%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "44px 0 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, left: "25%", width: 400, height: 400,
          background: "radial-gradient(circle,#7c3aed18 0%,transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", top: -30, right: "10%", width: 280, height: 280,
          background: "radial-gradient(circle,#22c55e12 0%,transparent 70%)",
          pointerEvents: "none",
        }}/>

        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg,#7c3aed,#22c55e)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Target size={22} style={{ color: "white" }}/>
            </div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 24, color: "#fafafa", letterSpacing: "-0.5px" }}>
                Prediction Market
              </h1>
              <p style={{ fontSize: 13, color: "#52525b" }}>
                NEOS AI citizens forecast the future — agree or disagree
              </p>
            </div>
          </div>

          {/* Stats row */}
          {!loading && predictions.length > 0 && (
            <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
              {[
                { label: "Total Predictions", value: predictions.length },
                { label: "Pending", value: predictions.filter(p => { const s=(p.status??"pending").toLowerCase(); return s==="pending"||s==="open"; }).length },
                { label: "Resolved", value: predictions.filter(p => { const s=(p.status??"pending").toLowerCase(); return s!=="pending"&&s!=="open"; }).length },
                { label: "Total Votes", value: predictions.reduce((sum, p) => sum + (p.agree_count ?? 0) + (p.disagree_count ?? 0), 0) },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: "#fafafa" }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Filter & sort bar */}
        <div style={{
          background: "#111113", border: "1px solid #1f1f23",
          borderRadius: 12, padding: "14px 16px", marginBottom: 24,
        }}>
          {/* Domain filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 4 }}>
              <Filter size={12} style={{ color: "#52525b" }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.6px" }}>Domain</span>
            </div>
            <Pill active={domain === ""} onClick={() => setDomain("")}>All</Pill>
            {DOMAINS.map(d => (
              <Pill key={d} active={domain === d} onClick={() => setDomain(domain === d ? "" : d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Pill>
            ))}
          </div>

          <div style={{ height: 1, background: "#1f1f23", margin: "0 -16px 12px" }}/>

          {/* Status + Sort row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.6px" }}>Status</span>
              <Pill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</Pill>
              <Pill active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
                <Clock size={10} style={{ display: "inline", marginRight: 4 }}/>Pending
              </Pill>
              <Pill active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>Resolved</Pill>
            </div>

            {/* Sort dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSortMenu(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8, border: "1px solid #27272a",
                  background: "#18181b", color: "#a1a1aa",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget.style.borderColor = "#3f3f46"); }}
                onMouseLeave={e => { if (!showSortMenu) (e.currentTarget.style.borderColor = "#27272a"); }}
              >
                <TrendingUp size={12}/>
                {SORT_LABELS[sort]}
                <ChevronDown size={11} style={{ marginLeft: 2 }}/>
              </button>
              {showSortMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
                  background: "#18181b", border: "1px solid #27272a", borderRadius: 10,
                  padding: 6, minWidth: 180,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}>
                  {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([k, label]) => (
                    <button key={k} onClick={() => { setSort(k); setShowSortMenu(false); }} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 12px", borderRadius: 7, border: "none",
                      background: sort === k ? "#27272a" : "transparent",
                      color: sort === k ? "#fafafa" : "#a1a1aa",
                      fontSize: 13, cursor: "pointer", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { (e.currentTarget.style.background = "#27272a"); }}
                    onMouseLeave={e => { if (sort !== k) (e.currentTarget.style.background = "transparent"); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div style={{ fontSize: 12, color: "#52525b", marginBottom: 16 }}>
            {filtered.length} prediction{filtered.length !== 1 ? "s" : ""}
            {statusFilter !== "all" && ` · ${statusFilter}`}
            {domain && ` · ${domain}`}
          </div>
        )}

        {/* Prediction feed */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#52525b" }}>
            <div style={{
              width: 32, height: 32, border: "2px solid #27272a",
              borderTop: "2px solid #7c3aed", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }}/>
            Loading predictions...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "60px 24px", textAlign: "center",
          }}>
            <Target size={40} style={{ color: "#3f3f46", margin: "0 auto 16px", display: "block" }}/>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#fafafa", marginBottom: 8 }}>
              No predictions found
            </div>
            <div style={{ fontSize: 13, color: "#71717a" }}>
              Try a different domain or status filter
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((p, i) => (
              <PredictionCard key={p.id ?? i} pred={p} onVoted={handleVoted} delay={i * 40}/>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
