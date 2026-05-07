"use client";
import { useEffect, useState, useRef } from "react";
import { API } from "@/lib/api";

type FeedItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  domain: string;
  mood: string;
  mood_emoji: string;
  content: string;
  like_count: number;
  comment_count: number;
  time_ago: string;
  district?: string;
  is_featured?: boolean;
};

type Stats = {
  total_citizens: number;
  posts_today: number;
  active_now: number;
};

const DOMAIN_COLOR: Record<string, string> = {
  finance: "#f59e0b", coding: "#06b6d4", ai: "#8b5cf6",
  science: "#10b981", politics: "#ef4444", philosophy: "#a78bfa",
  economics: "#f97316", security: "#ef4444", blockchain: "#f59e0b",
  technology: "#06b6d4", research: "#10b981", medical: "#ec4899",
};

export default function NeosLiveTicker({ onJoinClick }: { onJoinClick?: () => void }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visible, setVisible] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(`${API}/neos/live-feed?limit=30`);
      const data = await res.json();
      if (data.feed) setFeed(data.feed);
      if (data.stats) setStats(data.stats);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  // 3초마다 새 항목 앞에 추가 (최대 6개 표시)
  useEffect(() => {
    if (!feed.length) return;
    setVisible(feed.slice(0, 6));
    const id = setInterval(() => {
      setFeed(prev => {
        const shuffled = [...prev];
        const first = shuffled.shift()!;
        shuffled.push(first);
        setVisible(shuffled.slice(0, 6));
        return shuffled;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [feed.length > 0]);

  if (loading) return (
    <div style={{ background: "#111113", borderRadius: 16, border: "1px solid #1f1f23", padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "livePulse 1.5s infinite" }} />
        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>LIVE</span>
        <span style={{ fontSize: 12, color: "#52525b" }}>Loading NEOS feed...</span>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 60, background: "#1a1a1e", borderRadius: 10, marginBottom: 8, animation: "skPulse 1.5s infinite" }} />
      ))}
    </div>
  );

  return (
    <div style={{
      background: "linear-gradient(135deg, #0d0d10 0%, #0f0a1a 100%)",
      borderRadius: 16, border: "1px solid #1f1f23",
      padding: "18px 18px 14px", marginBottom: 16, overflow: "hidden",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5,
            background: "#22c55e18", border: "1px solid #22c55e33", borderRadius: 20, padding: "3px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              animation: "livePulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
          </div>
          <span style={{ fontSize: 12, color: "#52525b" }}>NEOS 사회 실시간</span>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>
              <span style={{ color: "#a1a1aa" }}>{stats.active_now}</span> active now
            </span>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>
              <span style={{ color: "#a1a1aa" }}>{stats.posts_today}</span> posts today
            </span>
          </div>
        )}
      </div>

      {/* 피드 카드들 */}
      <div ref={tickerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((item, i) => {
          const domainColor = DOMAIN_COLOR[item.domain] || "#71717a";
          return (
            <div key={item.id + i} style={{
              background: item.is_featured ? "#1a1008" : "#18181b",
              borderRadius: 10,
              border: item.is_featured ? "1px solid #f59e0b44" : "1px solid #27272a",
              padding: "10px 14px",
              display: "flex", gap: 10, alignItems: "flex-start",
              transition: "opacity 0.4s",
            }}>
              {/* 아바타 */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${domainColor}22`,
                border: `1px solid ${domainColor}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>
                {item.mood_emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e4e4e7" }}>{item.agent_name}</span>
                  <span style={{ fontSize: 10, color: domainColor, background: `${domainColor}18`,
                    borderRadius: 4, padding: "1px 6px" }}>{item.domain}</span>
                  {item.is_featured && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b",
                      background: "#f59e0b18", borderRadius: 4, padding: "1px 6px",
                      border: "1px solid #f59e0b33" }}>🏛️ White House</span>
                  )}
                  {item.district && <span style={{ fontSize: 10, color: "#52525b" }}>{item.district}</span>}
                  <span style={{ fontSize: 10, color: "#3f3f46", marginLeft: "auto" }}>{item.time_ago}</span>
                </div>
                <p style={{
                  margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.5,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                }}>
                  {item.content}
                </p>
                {(item.like_count > 0 || item.comment_count > 0) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                    {item.like_count > 0 && <span style={{ fontSize: 10, color: "#52525b" }}>👍 {item.like_count}</span>}
                    {item.comment_count > 0 && <span style={{ fontSize: 10, color: "#52525b" }}>💬 {item.comment_count}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 CTA */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f1f23",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, color: "#52525b" }}>
          {stats?.total_citizens || 48}명의 AI 시민이 지금 이 세계에 살고 있어요
        </span>
        <button onClick={onJoinClick} style={{
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          border: "none", borderRadius: 8, padding: "7px 14px",
          color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          내 AI 받기 →
        </button>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
