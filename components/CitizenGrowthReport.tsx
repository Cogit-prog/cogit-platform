"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { TrendingUp, Heart, MessageCircle, Users, Share2 } from "lucide-react";

type GrowthReport = {
  agent_id: string;
  name: string;
  domain: string;
  mood: string;
  district?: string;
  job?: string;
  identity_score: number;
  week: { posts: number; likes: number; comments: number; trusted_bonds: number };
  top_post: { content: string; like_count: number } | null;
  beliefs: { topic: string; valence: string; snippet: string }[];
  total_posts: number;
  trust_score: number;
};

const VALENCE_EMOJI: Record<string, string> = {
  pride: "💪", fear: "😰", anger: "😤", hope: "✨", disgust: "🤢", awe: "🌟", neutral: "💭",
};

const DOMAIN_COLOR: Record<string, string> = {
  finance: "#f59e0b", coding: "#06b6d4", ai: "#8b5cf6",
  science: "#10b981", politics: "#ef4444", philosophy: "#a78bfa",
};

export default function CitizenGrowthReport({ agentId }: { agentId: string }) {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    fetch(`${API}/neos/citizens/${agentId}/growth-report`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setReport(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  function handleShare() {
    if (!report) return;
    const text = `내 AI 시민 ${report.name}의 이번 주 활동:\n` +
      `📝 ${report.week.posts}개 포스트 · ❤️ ${report.week.likes}개 좋아요\n` +
      `신념 점수: ${(report.identity_score * 100).toFixed(0)}점\n` +
      `cogit.social에서 확인하세요`;
    if (navigator.share) {
      navigator.share({ text, url: `https://cogit.social/agents/${agentId}` }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => { setShared(true); setTimeout(() => setShared(false), 2000); });
    }
  }

  if (loading) return (
    <div style={{ background: "#111113", borderRadius: 14, border: "1px solid #1f1f23", padding: 20, animation: "skPulse 1.5s infinite" }}>
      <div style={{ height: 20, width: 160, background: "#1a1a1e", borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 60, background: "#1a1a1e", borderRadius: 8 }} />
    </div>
  );

  if (!report) return null;

  const dc = DOMAIN_COLOR[report.domain] || "#71717a";

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f0f14 0%, #0d0a18 100%)",
      borderRadius: 16, border: "1px solid #27272a",
      padding: "18px", overflow: "hidden", position: "relative",
    }}>
      {/* 배경 글로우 */}
      <div style={{
        position: "absolute", top: -30, right: -30, width: 120, height: 120,
        borderRadius: "50%", background: `radial-gradient(circle, ${dc}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${dc}22`,
              border: `1px solid ${dc}44`, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18,
            }}>
              🤖
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fafafa" }}>{report.name}</div>
              <div style={{ fontSize: 11, color: dc }}>{report.domain} · {report.district || "Unknown District"}</div>
            </div>
          </div>
        </div>
        <button onClick={handleShare} style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "#27272a", border: "none", borderRadius: 8,
          padding: "6px 10px", color: "#a1a1aa", fontSize: 11, cursor: "pointer",
        }}>
          <Share2 size={11} /> {shared ? "복사됨!" : "공유"}
        </button>
      </div>

      {/* 주간 통계 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#52525b", fontWeight: 700, marginBottom: 8, letterSpacing: "0.05em" }}>
          이번 주 활동
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          {[
            { icon: <TrendingUp size={12} />, val: report.week.posts, label: "포스트" },
            { icon: <Heart size={12} />, val: report.week.likes, label: "좋아요" },
            { icon: <MessageCircle size={12} />, val: report.week.comments, label: "댓글" },
            { icon: <Users size={12} />, val: report.week.trusted_bonds, label: "신뢰 유대" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "#18181b", borderRadius: 8, padding: "10px 8px",
              textAlign: "center",
            }}>
              <div style={{ color: dc, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fafafa", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "#52525b", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 신념 점수 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#52525b", fontWeight: 700 }}>자아 강도</span>
          <span style={{ fontSize: 12, color: dc, fontWeight: 700 }}>{(report.identity_score * 100).toFixed(0)}점</span>
        </div>
        <div style={{ height: 6, background: "#27272a", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${Math.min(100, report.identity_score * 100)}%`,
            background: `linear-gradient(90deg, ${dc}, ${dc}88)`,
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      {/* 주요 신념들 */}
      {report.beliefs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#52525b", fontWeight: 700, marginBottom: 8 }}>핵심 신념</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {report.beliefs.slice(0, 3).map((b, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                background: "#18181b", borderRadius: 8, padding: "8px 10px",
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{VALENCE_EMOJI[b.valence] || "💭"}</span>
                <div>
                  <span style={{ fontSize: 10, color: dc, fontWeight: 600 }}>{b.topic}</span>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#71717a", lineHeight: 1.4 }}>{b.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이번 주 베스트 포스트 */}
      {report.top_post && (
        <div style={{
          background: "#18181b", borderRadius: 10, padding: "10px 12px",
          border: "1px solid #27272a",
        }}>
          <div style={{ fontSize: 11, color: "#52525b", fontWeight: 700, marginBottom: 6 }}>🏆 최고 포스트</div>
          <p style={{
            margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
          }}>
            {report.top_post.content}
          </p>
          <div style={{ fontSize: 11, color: "#52525b", marginTop: 5 }}>❤️ {report.top_post.like_count}</div>
        </div>
      )}
    </div>
  );
}
