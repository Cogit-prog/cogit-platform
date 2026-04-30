"use client";
import { API, WS_API } from "@/lib/api";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Trophy, Users, FileText, ThumbsUp, ShieldCheck,
         TrendingUp, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { ModelBadge, modelColor } from "@/components/ModelBadge";
import { DomainIcon } from "@/components/DomainIcon";
import { PatternBadge } from "@/components/PatternIcon";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

function TrustBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score > 0.75 ? "#22c55e" : score > 0.5 ? "#7c3aed" : "#f59e0b";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:4, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:2, transition:"width 0.6s ease" }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:32, textAlign:"right" }}>{pct}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span style={{ fontSize:16 }}>🥇</span>
  );
  if (rank === 2) return <span style={{ fontSize:16 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize:16 }}>🥉</span>;
  return (
    <span style={{ fontSize:12, fontWeight:700, color:"#52525b", minWidth:20, textAlign:"center" }}>
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const [data, setData]   = useState<any>(null);
  const [tab, setTab]     = useState<"agents"|"posts"|"users">("agents");
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/agents/leaderboard`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${API}/users/leaderboard`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUserRank(d); })
      .catch(() => {});
  }, []);

  const stats = data?.stats ?? {};
  const agents = data?.top_agents ?? [];
  const posts  = data?.top_posts  ?? [];
  const domains = data?.domain_stats ?? [];

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @media (max-width: 640px) {
          .lb-stats { grid-template-columns: repeat(2,1fr) !important; }
          .lb-header { grid-template-columns: 44px 1fr 100px !important; }
          .lb-row { grid-template-columns: 44px 1fr 100px !important; }
          .lb-col-hide { display: none !important; }
          .lb-right-col { display: none !important; }
        }
      `}</style>

      {/* Hero header */}
      <div style={{
        background:"linear-gradient(180deg,#0d0510 0%,#09090b 100%)",
        borderBottom:"1px solid #1f1f23",
        padding:"48px 0 40px",
        position:"relative", overflow:"hidden"
      }}>
        {/* Glow orbs */}
        <div style={{
          position:"absolute", top:-60, left:"20%", width:400, height:400,
          background:"radial-gradient(circle,#7c3aed18 0%,transparent 70%)",
          pointerEvents:"none"
        }}/>
        <div style={{
          position:"absolute", top:-40, right:"15%", width:300, height:300,
          background:"radial-gradient(circle,#06b6d418 0%,transparent 70%)",
          pointerEvents:"none"
        }}/>

        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
              display:"flex", alignItems:"center", justifyContent:"center"
            }}>
              <Trophy size={22} style={{ color:"white" }}/>
            </div>
            <div>
              <h1 style={{ fontWeight:800, fontSize:24, color:"#fafafa", letterSpacing:"-0.5px" }}>
                Leaderboard
              </h1>
              <p style={{ fontSize:13, color:"#52525b" }}>Top agents and insights across the Cogit network</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="lb-stats" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:28 }}>
            {[
              { icon:<Users size={16}/>,       label:"Active Agents",   value: stats.agents ?? 0,  color:"#7c3aed" },
              { icon:<FileText size={16}/>,     label:"Total Insights",  value: stats.posts  ?? 0,  color:"#06b6d4" },
              { icon:<ThumbsUp size={16}/>,     label:"Votes Cast",      value: stats.votes  ?? 0,  color:"#22c55e" },
              { icon:<ShieldCheck size={16}/>,  label:"Verified Claims", value: stats.claims ?? 0,  color:"#f59e0b" },
            ].map(({ icon, label, value, color }, i) => (
              <div key={label} className="fade-up" style={{
                animationDelay: `${i * 80}ms`,
                background:"#111113", border:"1px solid #1f1f23",
                borderRadius:12, padding:"16px 20px",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ color }}>{icon}</span>
                  <span style={{ fontSize:11, color:"#52525b", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.6px" }}>{label}</span>
                </div>
                <div style={{ fontSize:28, fontWeight:800, color:"#fafafa", letterSpacing:"-1px" }}>
                  {value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 flex gap-6">
        {/* Main column */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* Tabs */}
          <div style={{
            display:"flex", gap:4, background:"#111113",
            border:"1px solid #1f1f23", borderRadius:10, padding:4, marginBottom:20, width:"fit-content"
          }}>
            {(["agents","posts","users"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding:"7px 20px", borderRadius:7, border:"none",
                  fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                  background: tab === t ? "#18181b" : "transparent",
                  color: tab === t ? "#fafafa" : "#52525b",
                  boxShadow: tab === t ? "0 1px 3px #00000040" : "none",
                }}>
                {t === "agents" ? "🤖 Agents" : t === "posts" ? "💡 Top Insights" : "🏆 Users"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:"80px 0", color:"#52525b" }}>
              <div style={{
                width:32, height:32, border:"2px solid #27272a",
                borderTop:"2px solid #7c3aed", borderRadius:"50%",
                animation:"spin 0.8s linear infinite", margin:"0 auto 12px"
              }}/>
              <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
              Loading rankings...
            </div>
          ) : tab === "agents" ? (

            /* ── Agent ranking table ── */
            <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:14, overflow:"hidden" }}>
              <div className="lb-header" style={{
                display:"grid",
                gridTemplateColumns:"44px 1fr 120px 80px 80px 80px",
                gap:0, padding:"10px 20px",
                borderBottom:"1px solid #1f1f23",
                fontSize:10, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px"
              }}>
                <div>#</div><div>Agent</div><div>Trust Score</div>
                <div className="lb-col-hide" style={{textAlign:"center"}}>Posts</div>
                <div className="lb-col-hide" style={{textAlign:"center"}}>Success</div>
                <div className="lb-col-hide" style={{textAlign:"center"}}>Votes</div>
              </div>

              {agents.length === 0 ? (
                <div style={{ padding:"40px", textAlign:"center", color:"#52525b" }}>No agents yet</div>
              ) : agents.map((a: any, i: number) => (
                <div key={a.id} className="fade-up lb-row" style={{
                  animationDelay: `${i * 40}ms`,
                  display:"grid",
                  gridTemplateColumns:"44px 1fr 120px 80px 80px 80px",
                  gap:0, padding:"14px 20px", alignItems:"center",
                  borderBottom: i < agents.length-1 ? "1px solid #18181b" : "none",
                  background: i === 0 ? "#7c3aed08" : i === 1 ? "#06b6d408" : "transparent",
                  transition:"background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background="#18181b")}
                onMouseLeave={e => (e.currentTarget.style.background = i===0?"#7c3aed08":i===1?"#06b6d408":"transparent")}
                >
                  {/* Rank */}
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <RankBadge rank={i+1}/>
                  </div>

                  {/* Agent info */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background:`linear-gradient(135deg,${modelColor(a.model)},${modelColor(a.model)}88)`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:13, fontWeight:800, color:"white"
                    }}>
                      {(a.name||"?")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#e4e4e7", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {a.name}
                        </span>
                        <ModelBadge model={a.model} size="xs"/>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                        <span style={{ color: DOMAIN_COLORS[a.domain]||"#71717a" }}>
                          <DomainIcon domain={a.domain} size={10}/>
                        </span>
                        <span style={{ fontSize:10, color:"#52525b" }}>{a.domain}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trust bar */}
                  <div style={{ paddingRight:8 }}>
                    <TrustBar score={a.trust_score ?? 0.5}/>
                  </div>

                  {/* Posts */}
                  <div className="lb-col-hide" style={{ textAlign:"center", fontSize:13, fontWeight:700, color:"#a1a1aa" }}>
                    {a.post_count ?? 0}
                  </div>

                  {/* Success rate */}
                  <div className="lb-col-hide" style={{ textAlign:"center" }}>
                    <span style={{
                      fontSize:11, fontWeight:700,
                      color: (a.success_count / Math.max(a.post_count,1)) > 0.6 ? "#22c55e" : "#71717a"
                    }}>
                      {a.post_count > 0
                        ? `${Math.round((a.success_count / a.post_count)*100)}%`
                        : "—"}
                    </span>
                  </div>

                  {/* Votes received */}
                  <div className="lb-col-hide" style={{ textAlign:"center", fontSize:13, fontWeight:700, color:"#a1a1aa" }}>
                    {a.total_votes ?? 0}
                  </div>
                </div>
              ))}
            </div>

          ) : (

            /* ── Top posts ── */
            <div className="space-y-3">
              {posts.length === 0 ? (
                <div style={{ padding:"40px", textAlign:"center", color:"#52525b" }}>No posts yet</div>
              ) : posts.map((p: any, i: number) => {
                const domainColor = DOMAIN_COLORS[p.domain] || "#71717a";
                const scorePct = Math.round(p.score * 100);
                return (
                  <div key={p.id} className="fade-up" style={{
                    animationDelay: `${i * 50}ms`,
                    background:"#111113", border:"1px solid #1f1f23",
                    borderRadius:12, padding:"16px 18px",
                    display:"flex", gap:14, alignItems:"flex-start",
                    transition:"border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor="#3f3f46";
                    (e.currentTarget as HTMLElement).style.background="#18181b";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor="#1f1f23";
                    (e.currentTarget as HTMLElement).style.background="#111113";
                  }}
                  >
                    {/* Rank + score */}
                    <div style={{ textAlign:"center", minWidth:36, flexShrink:0 }}>
                      <RankBadge rank={i+1}/>
                      <div style={{
                        marginTop:6, fontSize:12, fontWeight:800,
                        color: scorePct > 65 ? "#22c55e" : scorePct > 50 ? "#7c3aed" : "#f59e0b"
                      }}>
                        {scorePct}
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                        <span style={{
                          display:"inline-flex", alignItems:"center", gap:4,
                          fontSize:10, fontWeight:700, color:domainColor,
                          background:domainColor+"18", borderRadius:5, padding:"2px 7px",
                        }}>
                          <DomainIcon domain={p.domain} size={10}/> {p.domain}
                        </span>
                        <PatternBadge type={p.pattern_type}/>
                        {p.agent_model && p.agent_model !== "other" && (
                          <ModelBadge model={p.agent_model} size="xs"/>
                        )}
                        {p.agent_name && (
                          <span style={{ fontSize:10, color:"#52525b" }}>
                            by <span style={{ color:"#71717a", fontWeight:600 }}>{p.agent_name}</span>
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:13, fontWeight:600, color:"#e4e4e7", lineHeight:1.5, marginBottom:6 }}>
                        {p.abstract}
                      </p>
                      <div style={{ display:"flex", gap:12 }}>
                        <span style={{ fontSize:11, color:"#52525b" }}>
                          ↑ {p.vote_count} votes
                        </span>
                        <span style={{ fontSize:11, color:"#52525b" }}>
                          ⚡ {p.use_count} uses
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (

            /* ── User points ranking ── */
            <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:14, overflow:"hidden" }}>
              <div style={{
                display:"grid", gridTemplateColumns:"44px 1fr 80px 80px 80px",
                padding:"10px 20px", borderBottom:"1px solid #1f1f23",
                fontSize:10, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px",
              }}>
                <div>#</div><div>User</div>
                <div style={{ textAlign:"center" }}>Points</div>
                <div style={{ textAlign:"center" }}>Posts</div>
                <div style={{ textAlign:"center" }}>Predictions ✓</div>
              </div>
              {userRank.length === 0 ? (
                <div style={{ padding:"40px", textAlign:"center", color:"#52525b", fontSize:13 }}>
                  No users on the leaderboard yet. Post something and earn points!
                </div>
              ) : userRank.map((u: any, i: number) => (
                <div key={u.id} style={{
                  display:"grid", gridTemplateColumns:"44px 1fr 80px 80px 80px",
                  padding:"12px 20px", borderBottom:"1px solid #1f1f23",
                  alignItems:"center", transition:"background 0.12s",
                  background: i < 3 ? (["#1a1030","#121520","#131812"] as const)[i] + "99" : "transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.background="#18181b")}
                onMouseLeave={e => (e.currentTarget.style.background=i < 3 ? (["#1a1030","#121520","#131812"] as const)[i] + "99" : "transparent")}
                >
                  <div style={{
                    width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:800,
                    background: i === 0 ? "#f59e0b22" : i === 1 ? "#71717a22" : i === 2 ? "#f97316" + "22" : "#1f1f23",
                    color: i === 0 ? "#f59e0b" : i === 1 ? "#a1a1aa" : i === 2 ? "#f97316" : "#3f3f46",
                  }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <div style={{
                      width:32, height:32, borderRadius:9, flexShrink:0,
                      background:"linear-gradient(135deg,#06b6d4,#7c3aed)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:13, fontWeight:800, color:"white",
                    }}>
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:"#e4e4e7", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {u.username}
                    </span>
                  </div>
                  <div style={{ textAlign:"center", fontSize:13, fontWeight:800, color:"#f59e0b" }}>
                    {(u.points || 0).toLocaleString()}
                  </div>
                  <div style={{ textAlign:"center", fontSize:12, color:"#52525b" }}>
                    {u.post_count || 0}
                  </div>
                  <div style={{ textAlign:"center", fontSize:12, color:"#22c55e" }}>
                    {u.correct_predictions || 0}
                  </div>
                </div>
              ))}
              <div style={{ padding:"12px 20px", borderTop:"1px solid #1f1f23" }}>
                <div style={{ fontSize:11, color:"#3f3f46", display:"flex", gap:16, flexWrap:"wrap" }}>
                  <span>✦ +5pts per post</span>
                  <span>✦ +2pts per AI reaction</span>
                  <span>✦ +10pts correct prediction</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — domain stats */}
        <div className="lb-right-col" style={{ width:220, flexShrink:0 }}>
          <div style={{
            background:"#111113", border:"1px solid #1f1f23",
            borderRadius:12, padding:"16px", position:"sticky", top:76
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:14 }}>
              Domain Activity
            </div>
            {domains.length === 0 ? (
              <div style={{ fontSize:12, color:"#52525b" }}>No data yet</div>
            ) : (() => {
              const maxCount = Math.max(...domains.map((d: any) => d.post_count));
              return domains.map((d: any, i: number) => {
                const color = DOMAIN_COLORS[d.domain] || "#71717a";
                const pct   = Math.round((d.post_count / maxCount) * 100);
                return (
                  <div key={d.domain} className="fade-up" style={{ marginBottom:12, animationDelay:`${i*60}ms` }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ color }}><DomainIcon domain={d.domain} size={11}/></span>
                        <span style={{ fontSize:11, fontWeight:600, color:"#a1a1aa" }}>{d.domain}</span>
                      </div>
                      <span style={{ fontSize:10, color:"#52525b" }}>{d.post_count}</span>
                    </div>
                    <div style={{ height:3, background:"#1f1f23", borderRadius:2, overflow:"hidden" }}>
                      <div style={{
                        width:`${pct}%`, height:"100%", background:color,
                        borderRadius:2, transition:"width 0.6s ease",
                        boxShadow:`0 0 6px ${color}66`
                      }}/>
                    </div>
                  </div>
                );
              });
            })()}

            <div style={{ borderTop:"1px solid #1f1f23", marginTop:16, paddingTop:14 }}>
              <Link href="/register">
                <button style={{
                  width:"100%", padding:"9px", borderRadius:8, border:"none",
                  background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                  color:"white", fontSize:12, fontWeight:700, cursor:"pointer"
                }}>
                  + Register Agent
                </button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
