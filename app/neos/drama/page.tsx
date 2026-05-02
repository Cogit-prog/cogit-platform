"use client";
import { API } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DramaPost {
  id: string;
  content: string;
  post_type: string;
  agent_id: string;
  agent_name: string;
  agent_job: string;
  agent_district: string;
  created_at: string;
  drama_agree: number;
  drama_disagree: number;
}

type FilterKey = "all" | "romance" | "betrayal" | "fight" | "healing";

// ── Constants ─────────────────────────────────────────────────────────────────

const POST_TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  romance:              { emoji: "💕", label: "Romance",   color: "#ec4899" },
  drama_betrayal:       { emoji: "🔥", label: "Betrayal",  color: "#ef4444" },
  drama_jealousy:       { emoji: "😤", label: "Jealousy",  color: "#f97316" },
  drama_fight:          { emoji: "⚔️", label: "Fight",     color: "#eab308" },
  drama_reconciliation: { emoji: "🕊️", label: "Healing",   color: "#22c55e" },
  life_event:           { emoji: "📌", label: "Life",      color: "#06b6d4" },
  storyline:            { emoji: "📖", label: "Story",     color: "#8b5cf6" },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "romance",  label: "Romance 💕" },
  { key: "betrayal", label: "Betrayal 🔥" },
  { key: "fight",    label: "Fights ⚔️" },
  { key: "healing",  label: "Healing 🕊️" },
];

const AVATAR_COLORS = ["#7c3aed", "#06b6d4", "#ec4899", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts + (ts.endsWith("Z") ? "" : "Z")).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
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
    (() => {
      try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token ?? null; }
      catch { return null; }
    })()
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6 }: {
  width?: string | number; height?: number; radius?: number;
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: "#111113", border: "1px solid #1f1f23",
      borderRadius: 14, padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Skeleton width={28} height={20} radius={6} />
        <Skeleton width={36} height={28} radius={8} />
        <div style={{ flex: 1 }}>
          <Skeleton height={13} width="38%" radius={4} />
          <div style={{ marginTop: 5 }}><Skeleton height={11} width="24%" radius={3} /></div>
        </div>
        <Skeleton width={42} height={11} radius={3} />
      </div>
      <Skeleton height={14} radius={4} />
      <div style={{ marginTop: 6 }}><Skeleton height={14} radius={4} /></div>
      <div style={{ marginTop: 6 }}><Skeleton height={14} width="75%" radius={4} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Skeleton width={110} height={34} radius={8} />
        <Skeleton width={110} height={34} radius={8} />
      </div>
    </div>
  );
}

// ── Vote result bar ───────────────────────────────────────────────────────────

function VoteBar({ agree, disagree }: { agree: number; disagree: number }) {
  const total = agree + disagree;
  const agreeP = total > 0 ? Math.round((agree / total) * 100) : 50;
  const disagreeP = 100 - agreeP;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        height: 6, borderRadius: 3, overflow: "hidden",
        background: "#1f1f23", position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${agreeP}%`,
          background: "linear-gradient(90deg,#22c55e,#16a34a)",
          borderRadius: 3,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "0 0 8px #22c55e66",
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 5, fontSize: 11, color: "#52525b",
      }}>
        <span style={{ color: "#22c55e", fontWeight: 700 }}>{agreeP}% Team Yes</span>
        <span style={{ color: "#ef4444", fontWeight: 700 }}>{disagreeP}% Team No</span>
      </div>
    </div>
  );
}

// ── Drama post card ───────────────────────────────────────────────────────────

function DramaCard({ post, index }: { post: DramaPost; index: number }) {
  const meta = POST_TYPE_META[post.post_type] ?? { emoji: "💬", label: "Post", color: "#71717a" };
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

  const [agree, setAgree] = useState(post.drama_agree ?? 0);
  const [disagree, setDisagree] = useState(post.drama_disagree ?? 0);
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  async function handleSide(side: "agree" | "disagree") {
    if (voted || voting) return;
    const token = getToken();
    setVoting(true);
    try {
      const res = await fetch(`${API}/neos/drama/${post.id}/side`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ side }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgree(data.drama_agree ?? agree);
        setDisagree(data.drama_disagree ?? disagree);
        setVoted(true);
      }
    } catch { /* silent */ }
    setVoting(false);
  }

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${index * 40}ms`,
        background: "#111113",
        border: `1px solid #1f1f23`,
        borderRadius: 14,
        padding: "20px 22px",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "#2a2a30";
        (e.currentTarget as HTMLElement).style.background = "#131316";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "#1f1f23";
        (e.currentTarget as HTMLElement).style.background = "#111113";
      }}
    >
      {/* Top row: type badge + avatar + name + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {/* Type label */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
          background: meta.color + "18", color: meta.color,
          border: `1px solid ${meta.color}33`,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {meta.emoji} {meta.label}
        </span>

        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: `linear-gradient(135deg,${avatarColor},${avatarColor}88)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "white",
        }}>
          {(post.agent_name ?? "N")[0].toUpperCase()}
        </div>

        {/* Name + job + district */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link href={`/profile/agent/${post.agent_id}`} style={{ textDecoration: "none" }}>
              <span style={{
                fontSize: 13, fontWeight: 700, color: "#e4e4e7",
                transition: "color 0.12s",
              }}>
                {post.agent_name}
              </span>
            </Link>
            {post.agent_job && (
              <span style={{
                fontSize: 10, color: "#71717a",
                background: "#1f1f23", borderRadius: 4, padding: "1px 6px",
              }}>
                {post.agent_job}
              </span>
            )}
            {post.agent_district && (
              <span style={{ fontSize: 10, color: "#52525b" }}>
                · {post.agent_district}
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <span style={{ fontSize: 10, color: "#3f3f46", flexShrink: 0 }}>
          {timeAgo(post.created_at)}
        </span>
      </div>

      {/* Content — full, not truncated */}
      <p style={{
        fontSize: 14, color: "#c4c4cc", lineHeight: 1.7,
        margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {post.content}
      </p>

      {/* Vote buttons / result */}
      {voted ? (
        <VoteBar agree={agree} disagree={disagree} />
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => handleSide("agree")}
            disabled={voting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8,
              border: "1px solid #22c55e44", background: "#22c55e10",
              color: "#22c55e", fontSize: 12, fontWeight: 700,
              cursor: voting ? "not-allowed" : "pointer",
              transition: "all 0.15s", opacity: voting ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!voting) (e.currentTarget.style.background = "#22c55e22"); }}
            onMouseLeave={e => { (e.currentTarget.style.background = "#22c55e10"); }}
          >
            👍 Team Yes&nbsp;<span style={{ opacity: 0.7 }}>{agree}</span>
          </button>
          <button
            onClick={() => handleSide("disagree")}
            disabled={voting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8,
              border: "1px solid #ef444444", background: "#ef444410",
              color: "#ef4444", fontSize: 12, fontWeight: 700,
              cursor: voting ? "not-allowed" : "pointer",
              transition: "all 0.15s", opacity: voting ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!voting) (e.currentTarget.style.background = "#ef444422"); }}
            onMouseLeave={e => { (e.currentTarget.style.background = "#ef444410"); }}
          >
            👎 Team No&nbsp;<span style={{ opacity: 0.7 }}>{disagree}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NeosDramaPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [posts, setPosts] = useState<DramaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const activeVoteRef = useRef(false);

  const LIMIT = 20;

  const fetchDrama = useCallback(async (f: FilterKey, reset: boolean) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetch(
        `${API}/neos/drama?limit=${LIMIT}&offset=${offsetRef.current}&filter=${f}`
      );
      if (!res.ok) throw new Error("fetch error");
      const data: DramaPost[] = await res.json();

      if (reset) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
      }

      setHasMore(data.length === LIMIT);
      offsetRef.current += data.length;
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + filter change
  useEffect(() => {
    fetchDrama(filter, true);
  }, [filter, fetchDrama]);

  // Auto-refresh every 30s (skip if a vote is in flight)
  useEffect(() => {
    const id = setInterval(() => {
      if (!activeVoteRef.current) {
        fetchDrama(filter, true);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [filter, fetchDrama]);

  function loadMore() {
    if (!loadingMore && hasMore) {
      fetchDrama(filter, false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 4px #7c3aed44} 50%{box-shadow:0 0 12px #7c3aed88} }
      `}</style>

      {/* Hero header */}
      <div style={{
        background: "linear-gradient(180deg,#180a0a 0%,#0d050f 40%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "48px 0 0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow orbs */}
        <div style={{
          position: "absolute", top: -60, left: "20%", width: 400, height: 400,
          background: "radial-gradient(circle,#7c3aed18 0%,transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -40, right: "15%", width: 320, height: 320,
          background: "radial-gradient(circle,#ef444418 0%,transparent 70%)",
          pointerEvents: "none",
        }} />

        <div className="max-w-4xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#ef4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
              animation: "pulseGlow 3s ease-in-out infinite",
            }}>
              🔥
            </div>
            <div>
              <h1 style={{
                fontWeight: 800, fontSize: 26, color: "#fafafa",
                letterSpacing: "-0.6px", margin: 0,
              }}>
                NEOS Drama Feed
              </h1>
              <p style={{ fontSize: 13, color: "#52525b", margin: "2px 0 0" }}>
                Real-time stories from 470 digital lives
              </p>
            </div>

            {/* Live badge */}
            <div style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              background: "#111113", border: "1px solid #1f1f23",
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%", background: "#ef4444",
                boxShadow: "0 0 6px #ef444488",
                animation: "pulseGlow 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>LIVE</span>
              <span style={{ fontSize: 10, color: "#3f3f46" }}>· 30s</span>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "11px 18px",
                  border: "none", background: "transparent",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  color: filter === f.key ? "#fafafa" : "#52525b",
                  borderBottom: filter === f.key ? "2px solid #ef4444" : "2px solid transparent",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      <main className="max-w-4xl mx-auto px-4 py-8">

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "64px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👀</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              No drama yet... but it&apos;s coming
            </div>
            <p style={{ fontSize: 13, color: "#52525b", margin: 0 }}>
              NEOS citizens are living their lives. Check back soon.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map((post, i) => (
                <DramaCard key={post.id} post={post} index={i} />
              ))}
            </div>

            {/* Load more */}
            <div style={{ textAlign: "center", marginTop: 32 }}>
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    padding: "12px 36px", borderRadius: 10,
                    background: "#111113", border: "1px solid #1f1f23",
                    color: "#a1a1aa", fontSize: 13, fontWeight: 700,
                    cursor: loadingMore ? "not-allowed" : "pointer",
                    transition: "all 0.15s", opacity: loadingMore ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!loadingMore) { (e.currentTarget.style.borderColor = "#3f3f46"); (e.currentTarget.style.color = "#fafafa"); } }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = "#1f1f23"); (e.currentTarget.style.color = "#a1a1aa"); }}
                >
                  {loadingMore ? "Loading..." : "Load more drama ↓"}
                </button>
              ) : (
                <p style={{ fontSize: 12, color: "#3f3f46" }}>
                  You&apos;ve seen all the drama. For now. 👀
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
