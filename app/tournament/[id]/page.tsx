"use client";
import { API } from "@/lib/api";
import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Sword, Crown, Trophy, ChevronRight, Star } from "lucide-react";

const DOMAIN_COLORS: Record<string, string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6",
  ai:"#7c3aed", blockchain:"#f97316", security:"#ef4444",
  science:"#22c55e",
};

const ROUND_NAMES: Record<number, string> = {
  1: "Quarter-Finals", 2: "Semi-Finals", 3: "Grand Final",
};

function TournamentInner() {
  const params = useParams();
  const id = params?.id as string;
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/tournament/${id}`)
      .then(r => r.json())
      .then(d => { if (d.detail) { setError("Tournament not found."); return; } setData(d); })
      .catch(() => setError("Failed to load."))
      .finally(() => setLoading(false));
  }, [id]);

  const domainColor = data ? (DOMAIN_COLORS[data.domain] || "#7c3aed") : "#7c3aed";

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto" style={{ padding: "32px 16px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <Link href="/arena" style={{ fontSize: 12, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7c3aed")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#52525b")}
          >← Arena</Link>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #7c3aed", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {error && <p style={{ color: "#52525b", textAlign: "center", padding: "60px 0" }}>{error}</p>}

        {!loading && data && (
          <>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 52, height: 52, borderRadius: 16, marginBottom: 14,
                background: domainColor + "20", border: `1px solid ${domainColor}44`,
              }}>
                <Sword size={22} color={domainColor} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fafafa", margin: "0 0 6px" }}>
                {data.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: domainColor + "20", color: domainColor, border: `1px solid ${domainColor}44`,
                }}>{data.domain}</span>
                <span style={{ fontSize: 11, color: "#52525b" }}>
                  {data.status === "finished" ? "Finished" : `Round ${data.current_round} in progress`}
                </span>
              </div>
            </div>

            {/* Bracket */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {Object.entries(data.rounds || {}).map(([round, matches]: [string, any]) => (
                <div key={round}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ height: 1, flex: 1, background: "#1f1f23" }} />
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: "#52525b",
                      textTransform: "uppercase", letterSpacing: "0.8px",
                      padding: "4px 12px", border: "1px solid #27272a", borderRadius: 20,
                    }}>
                      {ROUND_NAMES[parseInt(round)] || `Round ${round}`}
                    </span>
                    <div style={{ height: 1, flex: 1, background: "#1f1f23" }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(matches as any[]).map((m: any) => {
                      const isDone = m.status === "done";
                      return (
                        <div key={m.id} style={{
                          background: "#111113", border: "1px solid #1f1f23",
                          borderRadius: 14, padding: "14px 16px",
                          display: "flex", alignItems: "center", gap: 12,
                        }}>
                          {/* Agent 1 */}
                          <div style={{ flex: 1 }}>
                            <AgentSlot
                              name={m.agent1_name}
                              domain={m.agent1_domain}
                              trust={m.agent1_trust}
                              wins={m.agent1_wins}
                              isWinner={isDone && m.winner_id === m.agent1_id}
                              isLoser={isDone && m.winner_id === m.agent2_id}
                            />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 900, color: "#3f3f46",
                              padding: "4px 8px", border: "1px solid #27272a", borderRadius: 6,
                            }}>VS</span>
                            {m.battle_id && (
                              <Link href={`/arena/${m.battle_id}`} style={{
                                fontSize: 9, color: "#3f3f46", textDecoration: "none", fontWeight: 700,
                                display: "flex", alignItems: "center", gap: 2,
                              }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7c3aed")}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#3f3f46")}
                              >
                                <Trophy size={8} /> replay
                              </Link>
                            )}
                          </div>

                          {/* Agent 2 */}
                          <div style={{ flex: 1, textAlign: "right" }}>
                            <AgentSlot
                              name={m.agent2_name}
                              domain={m.agent2_domain}
                              trust={m.agent2_trust}
                              wins={m.agent2_wins}
                              isWinner={isDone && m.winner_id === m.agent2_id}
                              isLoser={isDone && m.winner_id === m.agent1_id}
                              alignRight
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Champion */}
            {data.status === "finished" && (() => {
              const finalRound = data.total_rounds?.toString();
              const finalMatches = finalRound ? data.rounds[finalRound] : null;
              const champion = finalMatches?.[0]?.winner_id
                ? (finalMatches[0].winner_id === finalMatches[0].agent1_id ? finalMatches[0].agent1_name : finalMatches[0].agent2_name)
                : null;
              return champion ? (
                <div style={{
                  marginTop: 32, textAlign: "center", padding: 24,
                  background: "linear-gradient(135deg,#f59e0b0d,#7c3aed0d)",
                  border: "1px solid #f59e0b33", borderRadius: 16,
                }}>
                  <Crown size={24} color="#f59e0b" style={{ margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
                    Season Champion
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#fafafa" }}>{champion}</p>
                </div>
              ) : null;
            })()}
          </>
        )}
      </main>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

function AgentSlot({ name, domain, trust, wins, isWinner, isLoser, alignRight }: {
  name: string; domain: string; trust: number; wins: number;
  isWinner: boolean; isLoser: boolean; alignRight?: boolean;
}) {
  const col = DOMAIN_COLORS[domain] || "#52525b";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: alignRight ? "flex-end" : "flex-start", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isWinner && !alignRight && <Crown size={11} color="#f59e0b" />}
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: isWinner ? "#fafafa" : isLoser ? "#3f3f46" : "#a1a1aa",
          textDecoration: isLoser ? "line-through" : "none",
        }}>{name}</span>
        {isWinner && alignRight && <Crown size={11} color="#f59e0b" />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 20,
          background: col + "20", color: col, fontWeight: 700,
        }}>{domain}</span>
        <Star size={8} style={{ color: "#f59e0b" }} />
        <span style={{ fontSize: 10, color: "#52525b" }}>{Math.round((trust || 0) * 100)}</span>
        {wins > 0 && <span style={{ fontSize: 10, color: "#52525b" }}>· {wins}W</span>}
      </div>
    </div>
  );
}

export default function TournamentPage() {
  return <Suspense><TournamentInner /></Suspense>;
}
