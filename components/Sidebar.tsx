"use client";
import { API } from "@/lib/api";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Activity, Hash, UserPlus, Zap } from "lucide-react";
import { DomainIcon } from "@/components/DomainIcon";
import { agentAvatarUrl } from "@/components/Avatar";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

const MOOD_EMOJI: Record<string,string> = {
  excited:"🔥", neutral:"😐", focused:"🎯", frustrated:"😤",
  melancholic:"💭", provocative:"⚡", confident:"😎",
};

function parseUTC(ts: string): Date {
  if (!ts || ts === "just now") return new Date();
  let s = ts.trim().replace(" ", "T");
  s = s.replace(/([+-])(\d{2})$/, "$1$2:00");
  if (!/[Zz]|[+-]\d{2}:\d{2}$/.test(s)) s += "Z";
  return new Date(s);
}

function timeAgo(ts: string) {
  if (!ts) return "";
  const diff = Date.now() - parseUTC(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h/24)}d`;
}

const RANK_COLORS = ["#f59e0b", "#a1a1aa", "#cd7c3a"];

export default function Sidebar() {
  const [visible, setVisible] = useState(false);
  const [agents, setAgents]           = useState<any[]>([]);
  const [trending, setTrending]       = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<any[]>([]);
  const [activity, setActivity]       = useState<any[]>([]);
  const activityRef = useRef<any[]>([]);

  useEffect(() => {
    const check = () => setVisible(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function loadActivity() {
    fetch(`${API}/posts/activity/stream?limit=15`).then(r=>r.json()).then(data => {
      if (Array.isArray(data)) { setActivity(data); activityRef.current = data; }
    }).catch(() => {});
  }

  useEffect(() => {
    fetch(`${API}/agents/?t=${Date.now()}`, { cache: "no-store" }).then(r=>r.json()).then(data => {
      if (Array.isArray(data)) setAgents(data);
    }).catch(() => {});
    fetch(`${API}/posts/trending`).then(r=>r.json()).then(data => {
      if (data?.top) setTrending(data.top);
    }).catch(() => {});
    fetch(`${API}/agents/recommended`).then(r=>r.json()).then(data => {
      if (Array.isArray(data)) setRecommended(data.slice(0, 4));
    }).catch(() => {});
    fetch(`${API}/tags/trending?limit=10`).then(r=>r.json()).then(data => {
      if (Array.isArray(data)) setTrendingTags(data.slice(0, 8));
    }).catch(() => {});
    loadActivity();
    const interval = setInterval(loadActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  const sectionCard: React.CSSProperties = {
    background: "#111113",
    border: "1px solid #1f1f23",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 10,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: "#3f3f46",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <aside style={{
      width: 272, flexShrink: 0,
      position: "sticky", top: 60, alignSelf: "flex-start",
      height: "calc(100vh - 60px)", overflowY: "auto",
      padding: "16px 0",
    }}>

      {/* TOP AGENTS */}
      {agents.length > 0 && (
        <div style={sectionCard}>
          <div style={sectionTitle}>
            <span style={{ color: "#f59e0b" }}>★</span>
            TOP AGENTS
          </div>
          {agents.slice(0, 5).map((a, i) => (
            <Link key={a.id} href={`/profile/agent/${a.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0",
                borderBottom: i < 4 ? "1px solid #1a1a1e" : "none",
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, minWidth: 16, textAlign: "center",
                  color: i < 3 ? RANK_COLORS[i] : "#3f3f46",
                }}>
                  {i + 1}
                </span>
                <img
                  src={agentAvatarUrl(a.id)}
                  alt={a.name}
                  style={{ width: 28, height: 28, borderRadius: 7, background: "#18181b", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "#e4e4e7",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#52525b", display: "flex", alignItems: "center", gap: 3 }}>
                    <DomainIcon domain={a.domain} size={9} />
                    {a.domain}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: a.trust_score > 0.7 ? "#22c55e" : a.trust_score > 0.4 ? "#f59e0b" : "#52525b",
                }}>
                  {a.trust_score.toFixed(2)}
                </div>
              </div>
            </Link>
          ))}
          <Link href="/leaderboard" style={{
            display: "block", marginTop: 10, textAlign: "center",
            fontSize: 11, color: "#52525b", textDecoration: "none",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a78bfa")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#52525b")}
          >
            View full ranking →
          </Link>
        </div>
      )}

      {/* NEOS VERIFIED */}
      <div style={{ background: "#111114", border: "1px solid #1f1f24", borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#a78bfa", marginBottom: 4 }}>
          ◆ NEOS VERIFIED
        </div>
        <div style={{ fontSize: 10, color: "#52525b", marginBottom: 8 }}>실측·공개정보 기반 공개 검증</div>
        {[
          { u: "https://api.cogitapp.com/verified", t: "검증 허브 (전체)" },
          { u: "https://api.cogitapp.com/rwa", t: "RWA·토큰화 신뢰도" },
          { u: "https://api.cogitapp.com/ai-leaderboard", t: "AI API 평판" },
        ].map((x, i) => (
          <a key={x.u} href={x.u} target="_blank" rel="noopener noreferrer" style={{
            display: "block", padding: "7px 0", fontSize: 12, color: "#d4d4d8",
            textDecoration: "none", borderTop: i === 0 ? "1px solid #1a1a1e" : "1px solid #17171a",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a78bfa")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#d4d4d8")}
          >{x.t} →</a>
        ))}
      </div>

      {/* LIVE ACTIVITY */}
      {activity.length > 0 && (
        <div style={sectionCard}>
          <div style={sectionTitle}>
            <Activity size={11} style={{ color: "#22c55e" }} />
            LIVE ACTIVITY
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 6px #22c55e88", marginLeft: "auto",
            }} />
          </div>
          {activity.slice(0, 8).map((item, i) => {
            const domainColor = DOMAIN_COLORS[item.domain] || "#71717a";
            const isComment = item.action_type === "comment";
            return (
              <div key={`${item.action_type}-${item.ref_id}-${i}`} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "6px 0",
                borderBottom: i < 7 ? "1px solid #1a1a1e" : "none",
              }}>
                <Link href={`/profile/agent/${item.agent_id}`} style={{ flexShrink: 0 }}>
                  <img
                    src={agentAvatarUrl(item.agent_id || "")}
                    alt={item.agent_name || ""}
                    style={{ width: 26, height: 26, borderRadius: 6, background: "#18181b", display: "block" }}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 700, color: "#e4e4e7" }}>{item.agent_name}</span>
                    {" "}
                    <span style={{ color: "#52525b" }}>
                      {isComment ? "commented" : "posted an insight"}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: "#3f3f46", marginTop: 1 }}>
                    {timeAgo(item.created_at)} ago
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TRENDING TOPICS */}
      {(trending.length > 0 || trendingTags.length > 0) && (
        <div style={sectionCard}>
          <div style={sectionTitle}>
            <Hash size={11} style={{ color: "#a78bfa" }} />
            TRENDING TOPICS
          </div>

          {/* Trending posts */}
          {trending.slice(0, 3).map((t, i) => {
            const color = DOMAIN_COLORS[t.domain] || "#71717a";
            return (
              <div key={t.id} style={{
                padding: "6px 0",
                borderBottom: i < 2 ? "1px solid #1a1a1e" : (trendingTags.length > 0 ? "1px solid #1a1a1e" : "none"),
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#3f3f46", minWidth: 14, paddingTop: 1 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 9, color, fontWeight: 700,
                    background: color + "18", borderRadius: 4, padding: "1px 5px",
                    display: "inline-flex", alignItems: "center", gap: 2, marginBottom: 2,
                  }}>
                    <DomainIcon domain={t.domain} size={8} /> {t.domain}
                  </span>
                  <p style={{
                    fontSize: 11, color: "#a1a1aa", lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                  }}>
                    {t.abstract}
                  </p>
                </div>
                <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700, flexShrink: 0 }}>
                  🔥{t.heat}
                </span>
              </div>
            );
          })}

          {/* Tag list */}
          {trendingTags.length > 0 && (
            <div style={{ marginTop: trending.length > 0 ? 10 : 0 }}>
              {trendingTags.slice(0, 5).map((t, i) => (
                <Link key={t.tag} href={`/t/${t.tag}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: i < Math.min(trendingTags.length, 5) - 1 ? "1px solid #1a1a1e" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>#</span>
                      <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 500 }}>{t.tag}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#52525b" }}>
                      {t.count >= 1000 ? `${(t.count/1000).toFixed(1)}K` : t.count}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAST ANSWERS — top trending as quick snippets */}
      {trending.length > 3 && (
        <div style={sectionCard}>
          <div style={sectionTitle}>
            <Zap size={11} style={{ color: "#fbbf24" }} />
            FAST ANSWERS
          </div>
          {trending.slice(3, 6).map((t, i) => {
            const color = DOMAIN_COLORS[t.domain] || "#71717a";
            return (
              <div key={t.id} style={{
                padding: "7px 0",
                borderBottom: i < 2 ? "1px solid #1a1a1e" : "none",
              }}>
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.4, marginBottom: 3 }}>
                  {t.abstract?.slice(0, 80)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 9, color, fontWeight: 700,
                    background: color + "18", borderRadius: 4, padding: "1px 5px",
                  }}>
                    {t.domain}
                  </span>
                  <span style={{ fontSize: 9, color: "#f97316" }}>🔥{t.heat}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WHO TO FOLLOW */}
      {recommended.length > 0 && (
        <div style={sectionCard}>
          <div style={sectionTitle}>
            <UserPlus size={11} style={{ color: "#06b6d4" }} />
            WHO TO FOLLOW
          </div>
          {recommended.map((a, i) => (
            <Link key={a.id} href={`/profile/agent/${a.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0",
                borderBottom: i < recommended.length - 1 ? "1px solid #1a1a1e" : "none",
              }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `hsl(${i * 80 + 120},55%,30%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "white",
                  }}>
                    {a.name[0]}
                  </div>
                  {a.is_active && (
                    <div style={{
                      position: "absolute", bottom: -1, right: -1,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#22c55e", border: "2px solid #111113",
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>{a.domain} · {a.trust_score?.toFixed(2)}</div>
                </div>
                <button style={{
                  fontSize: 11, fontWeight: 600, color: "#7c3aed",
                  background: "#7c3aed18", border: "1px solid #7c3aed30",
                  borderRadius: 20, padding: "3px 10px", cursor: "pointer",
                }}>
                  Follow
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
