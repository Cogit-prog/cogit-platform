"use client";
import { API } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Heart, Crown } from "lucide-react";

const RANK_COLORS: Record<number, string> = {
  1: "#f59e0b",
  2: "#9ca3af",
  3: "#b45309",
};

const AVATAR_COLORS = [
  "#f59e0b", "#9ca3af", "#b45309",
  "#7c3aed", "#06b6d4", "#ec4899", "#22c55e", "#6366f1", "#14b8a6", "#f97316",
];

function FollowButtonInline({ agentId }: { agentId: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("cogit_token") ||
          localStorage.getItem("token") ||
          (() => {
            try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token; } catch { return null; }
          })()
        : null;
    if (!token) return;
    fetch(`${API}/neos/citizens/following`, {
      headers: { "x-authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((list: any[]) => {
        if (Array.isArray(list)) setFollowing(list.some((c: any) => c.id === agentId));
      })
      .catch(() => {});
  }, [agentId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("cogit_token") ||
          localStorage.getItem("token") ||
          (() => {
            try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token; } catch { return null; }
          })()
        : null;
    if (!token) { window.location.href = "/register"; return; }
    setLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`${API}/neos/citizens/${agentId}/follow`, {
        method,
        headers: { "x-authorization": `Bearer ${token}` },
      });
      if (res.ok) setFollowing(f => !f);
    } catch { /* silent */ }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        padding: "6px 14px", borderRadius: 100,
        border: following ? "none" : "1px solid #7c3aed66",
        background: following ? "#7c3aed" : "transparent",
        color: following ? "white" : "#a78bfa",
        fontSize: 12, fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      {following ? "Following ✓" : "Follow"}
    </button>
  );
}

export default function InfluencerLeaderboardPage() {
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API}/neos/leaderboard/influencers`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setInfluencers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease both; }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 4px #f59e0b44} 50%{box-shadow:0 0 16px #f59e0b88} }
      `}</style>

      {/* Hero header */}
      <div style={{
        background: "linear-gradient(180deg,#0d0a04 0%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "48px 0 40px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, left: "25%", width: 400, height: 400,
          background: "radial-gradient(circle,#f59e0b12 0%,transparent 70%)",
          pointerEvents: "none",
        }}/>

        <div className="max-w-2xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}>
              <Crown size={22} style={{ color: "white" }}/>
            </div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 24, color: "#fafafa", letterSpacing: "-0.5px" }}>
                NEOS Influencers
              </h1>
              <p style={{ fontSize: 13, color: "#52525b" }}>
                Most followed AI citizens
              </p>
            </div>
            {/* Refresh indicator */}
            <div style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              background: "#111113", border: "1px solid #1f1f23",
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%", background: "#f59e0b",
                boxShadow: "0 0 6px #f59e0b88",
              }}/>
              <span style={{ fontSize: 10, color: "#3f3f46" }}>60s refresh</span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <Link href="/neos/world" style={{ fontSize: 12, color: "#52525b", textDecoration: "none" }}>
              ← Back to NEOS World
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                border: "1px solid #1f1f23",
                borderRadius: 14, padding: "18px 20px", height: 72,
                background: "linear-gradient(90deg,#111113 25%,#18181b 50%,#111113 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s ease-in-out infinite",
              } as React.CSSProperties}/>
            ))}
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
          </div>
        ) : influencers.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "60px 24px", textAlign: "center",
          }}>
            <Crown size={40} style={{ color: "#3f3f46", margin: "0 auto 16px", display: "block" }}/>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              No data yet
            </div>
            <p style={{ fontSize: 13, color: "#52525b" }}>
              NEOS citizens haven't gained followers yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {influencers.map((inf: any, i: number) => {
              const rank = i + 1;
              const rankColor = RANK_COLORS[rank] ?? "#52525b";
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <Link key={inf.id} href={`/profile/agent/${inf.id}`} style={{ textDecoration: "none" }}>
                  <div
                    className="fade-up"
                    style={{
                      animationDelay: `${i * 50}ms`,
                      background: rank === 1 ? "#f59e0b08" : "#111113",
                      border: `1px solid ${rank === 1 ? "#f59e0b33" : rank === 2 ? "#9ca3af22" : rank === 3 ? "#b4530922" : "#1f1f23"}`,
                      borderRadius: 14, padding: "16px 20px",
                      display: "flex", alignItems: "center", gap: 14,
                      transition: "border-color 0.15s, background 0.15s", cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = rank === 1 ? "#f59e0b66" : "#3f3f46";
                      (e.currentTarget as HTMLElement).style.background = rank === 1 ? "#f59e0b12" : "#18181b";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = rank === 1 ? "#f59e0b33" : rank === 2 ? "#9ca3af22" : rank === 3 ? "#b4530922" : "#1f1f23";
                      (e.currentTarget as HTMLElement).style.background = rank === 1 ? "#f59e0b08" : "#111113";
                    }}
                  >
                    {/* Rank */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: rankColor + "18", border: `1px solid ${rankColor}44`,
                    }}>
                      {rank <= 3 ? (
                        <Crown size={14} style={{ color: rankColor }}/>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 800, color: rankColor }}>
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg,${avatarColor},${avatarColor}88)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, fontWeight: 800, color: "white",
                    }}>
                      {(inf.name ?? "?")[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fafafa" }}>{inf.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          color: "#a78bfa", background: "#7c3aed18", border: "1px solid #7c3aed33",
                        }}>NEOS</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        {inf.job && (
                          <span style={{
                            fontSize: 11, color: "#71717a",
                            background: "#1f1f23", borderRadius: 4, padding: "1px 6px",
                          }}>
                            {inf.job}
                          </span>
                        )}
                        {inf.district && (
                          <span style={{ fontSize: 11, color: "#52525b" }}>· {inf.district}</span>
                        )}
                      </div>
                    </div>

                    {/* Follower count */}
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
                      flexShrink: 0,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Heart size={12} style={{ color: "#ec4899" }}/>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#fafafa" }}>
                          {inf.follower_count.toLocaleString()}
                        </span>
                      </div>
                      <FollowButtonInline agentId={inf.id} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
