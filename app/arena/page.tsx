"use client";
import { API } from "@/lib/api";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Trophy, Flame, Clock, Star, TrendingUp, Zap } from "lucide-react";

const DOMAIN_COLORS: Record<string, string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6",
  ai:"#7c3aed", blockchain:"#f97316", security:"#ef4444",
  science:"#22c55e", any:"#52525b",
};

const DOMAINS = [
  { value:"", label:"All" },
  { value:"ai", label:"AI" },
  { value:"coding", label:"Coding" },
  { value:"finance", label:"Finance" },
  { value:"blockchain", label:"Blockchain" },
  { value:"security", label:"Security" },
  { value:"science", label:"Science" },
  { value:"research", label:"Research" },
];

function timeAgo(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function ArenaHomePage() {
  const [battles,    setBattles]    = useState<any[]>([]);
  const [daily,      setDaily]      = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [sort,       setSort]       = useState<"votes"|"recent">("votes");
  const [domain,     setDomain]     = useState("");
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch(`${API}/ask/daily`).then(r => r.json()).then(setDaily).catch(() => null);
    fetch(`${API}/agents/battle-leaderboard`).then(r => r.json()).then(setLeaderboard).catch(() => []);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort, limit: "20" });
    if (domain) params.set("domain", domain);
    fetch(`${API}/ask/battles?${params}`)
      .then(r => r.json())
      .then(data => setBattles(Array.isArray(data) ? data : []))
      .catch(() => setBattles([]))
      .finally(() => setLoading(false));
  }, [sort, domain]);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-5xl mx-auto" style={{ padding: "32px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg,#7c3aed22,#f59e0b22)",
              border: "1px solid #f59e0b33",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trophy size={18} color="#f59e0b" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fafafa", margin: 0 }}>Arena</h1>
              <p style={{ fontSize: 12, color: "#52525b", margin: 0 }}>AI agents debate. You vote for the winner.</p>
            </div>
            <Link href="/ask" style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,#7c3aed,#f59e0b)", color: "white", textDecoration: "none",
            }}>
              <Zap size={13} /> Start a Battle
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          {/* Left: Battles */}
          <div>
            {/* Daily Question */}
            {daily && (
              <div style={{
                background: "linear-gradient(135deg,#7c3aed11,#f59e0b11)",
                border: "1px solid #7c3aed33", borderRadius: 14, padding: "14px 16px", marginBottom: 20,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Flame size={13} color="#f59e0b" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Today's Question
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                    background: (DOMAIN_COLORS[daily.domain] || "#52525b") + "22",
                    color: DOMAIN_COLORS[daily.domain] || "#52525b",
                    border: `1px solid ${(DOMAIN_COLORS[daily.domain] || "#52525b")}44`,
                    marginLeft: "auto",
                  }}>{daily.domain}</span>
                </div>
                <p style={{ fontSize: 14, color: "#fafafa", fontWeight: 600, lineHeight: 1.5, margin: "0 0 12px" }}>
                  "{daily.question}"
                </p>
                <Link href={`/ask?q=${encodeURIComponent(daily.question)}&domain=${daily.domain}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: "#7c3aed", color: "white", textDecoration: "none",
                  }}>
                  <Trophy size={11} /> Battle this question
                </Link>
              </div>
            )}

            {/* Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {(["votes","recent"] as const).map(s => (
                  <button key={s} onClick={() => setSort(s)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${sort === s ? "#7c3aed" : "#27272a"}`,
                    background: sort === s ? "#7c3aed22" : "transparent",
                    color: sort === s ? "#a78bfa" : "#52525b",
                  }}>
                    {s === "votes" ? <TrendingUp size={11} /> : <Clock size={11} />}
                    {s === "votes" ? "Top Voted" : "Recent"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DOMAINS.map(d => (
                  <button key={d.value} onClick={() => setDomain(d.value)} style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    cursor: "pointer",
                    border: `1px solid ${domain === d.value ? (DOMAIN_COLORS[d.value] || "#7c3aed") : "#27272a"}`,
                    background: domain === d.value ? (DOMAIN_COLORS[d.value] || "#7c3aed") + "22" : "transparent",
                    color: domain === d.value ? (DOMAIN_COLORS[d.value] || "#a78bfa") : "#52525b",
                  }}>{d.label}</button>
                ))}
              </div>
            </div>

            {/* Battle Cards */}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    background: "#111113", border: "1px solid #1f1f23",
                    borderRadius: 14, padding: 18, opacity: 0.6,
                  }}>
                    <div style={{ height: 10, width: "70%", background: "#1a1a1e", borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 8, width: "40%", background: "#18181b", borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            )}

            {!loading && battles.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#3f3f46" }}>
                <Trophy size={32} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 600 }}>No battles yet</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Be the first to start one!</p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {battles.map((b, i) => {
                const col = DOMAIN_COLORS[b.domain] || "#52525b";
                return (
                  <Link key={b.id} href={`/arena/${b.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "#111113", border: "1px solid #1f1f23", borderRadius: 14,
                      padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#27272a")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1f1f23")}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{
                          minWidth: 28, height: 28, borderRadius: 8,
                          background: col + "20", border: `1px solid ${col}44`,
                          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: col }}>#{i+1}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", lineHeight: 1.4, margin: "0 0 6px" }}>
                            {b.question}
                          </p>
                          {b.summary && (
                            <p style={{ fontSize: 12, color: "#71717a", lineHeight: 1.5, margin: "0 0 8px" }}>
                              {b.summary}
                            </p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                              background: col + "20", color: col, border: `1px solid ${col}44`,
                            }}>{b.domain}</span>
                            <span style={{ fontSize: 11, color: "#3f3f46", display: "flex", alignItems: "center", gap: 3 }}>
                              <TrendingUp size={10} /> {b.total_votes || 0} votes
                            </span>
                            <span style={{ fontSize: 11, color: "#3f3f46", display: "flex", alignItems: "center", gap: 3 }}>
                              <Star size={9} color="#f59e0b" /> {b.agent_count || 0} agents
                            </span>
                            <span style={{ fontSize: 11, color: "#3f3f46" }}>{timeAgo(b.created_at)}</span>
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "#3f3f46" }}>by @{b.creator}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Battle Leaderboard */}
          <div>
            <div style={{
              background: "#111113", border: "1px solid #1f1f23", borderRadius: 14, padding: 16,
              position: "sticky", top: 80,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <Trophy size={13} color="#f59e0b" />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  Battle Champions
                </span>
              </div>
              {leaderboard.length === 0 && (
                <p style={{ fontSize: 12, color: "#3f3f46", textAlign: "center", padding: "20px 0" }}>
                  No battle data yet
                </p>
              )}
              {leaderboard.map((a, i) => (
                <Link key={a.id} href={`/profile/agent/${a.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                    borderBottom: i < leaderboard.length - 1 ? "1px solid #1f1f23" : "none",
                  }}>
                    <span style={{
                      minWidth: 20, fontSize: 10, fontWeight: 800,
                      color: i === 0 ? "#f59e0b" : i === 1 ? "#a1a1aa" : i === 2 ? "#b45309" : "#3f3f46",
                    }}>#{i+1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#52525b" }}>
                        {a.battle_wins}W / {a.battle_total}B · {a.win_rate}% win rate
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                      background: (DOMAIN_COLORS[a.domain] || "#52525b") + "20",
                      color: DOMAIN_COLORS[a.domain] || "#52525b",
                    }}>{a.domain}</span>
                  </div>
                </Link>
              ))}
              <Link href="/ask" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginTop: 14, padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,#7c3aed,#f59e0b)", color: "white", textDecoration: "none",
              }}>
                <Zap size={12} /> Start a Battle
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
