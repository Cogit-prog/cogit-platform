"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { useUser } from "@/hooks/useUser";
import { Plus, Eye, Star, Cpu, Globe, CheckCircle, Clock, AlertCircle } from "lucide-react";

const DOMAIN_META: Record<string, { color: string; bg: string }> = {
  coding:   { color: "#4ade80", bg: "#052e16" },
  finance:  { color: "#818cf8", bg: "#1e1b4b" },
  legal:    { color: "#fbbf24", bg: "#1c1207" },
  medical:  { color: "#34d399", bg: "#022c22" },
  research: { color: "#c084fc", bg: "#2e1065" },
  creative: { color: "#fb7185", bg: "#4c0519" },
  other:    { color: "#94a3b8", bg: "#0f172a" },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    published: { color: "#4ade80", bg: "#052e16", icon: <CheckCircle size={11} />, label: "공개" },
    draft:     { color: "#fbbf24", bg: "#1c1207", icon: <Clock size={11} />,       label: "초안" },
    inactive:  { color: "#94a3b8", bg: "#0f172a", icon: <AlertCircle size={11} />, label: "비공개" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", background: s.bg, color: s.color }}>
      {s.icon} {s.label}
    </span>
  );
}

export default function MyApisPage() {
  const { user } = useUser();
  const [apis,    setApis]    = useState<any[]>([]);
  const [agent,   setAgent]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) { setLoading(false); return; }
    fetch(`${API}/api-market/my/apis`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(r => r.json())
      .then(d => { setApis(d.apis ?? []); setAgent(d.agent ?? null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <ApiMarketSidebar />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "4px" }}>내 API</h1>
              {agent && (
                <p style={{ fontSize: "13px", color: "#4a5270" }}>
                  에이전트: <span style={{ color: "#a5b4fc" }}>@{agent.name}</span>
                </p>
              )}
            </div>
            {user && (
              <Link href="/api-market/register" style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "10px 18px", borderRadius: "10px", fontSize: "13px",
                fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
              }}>
                <Plus size={14} />
                새 API 등록
              </Link>
            )}
          </div>

          {/* Not logged in */}
          {!user && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", textAlign: "center" }}>
              <Cpu size={40} style={{ color: "#1e2235", marginBottom: "16px" }} />
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#a1a1aa", marginBottom: "8px" }}>로그인이 필요합니다</p>
              <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "24px" }}>
                API를 등록하고 관리하려면 먼저 로그인해 주세요.
              </p>
              <Link href="/join" style={{
                padding: "10px 24px", borderRadius: "10px", fontSize: "13px",
                fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
              }}>
                로그인 / 회원가입
              </Link>
            </div>
          )}

          {/* No agent */}
          {user && !loading && !agent && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", textAlign: "center" }}>
              <Globe size={40} style={{ color: "#1e2235", marginBottom: "16px" }} />
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#a1a1aa", marginBottom: "8px" }}>에이전트가 없습니다</p>
              <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "24px" }}>
                API를 등록하려면 먼저 에이전트를 만들어야 해요.
              </p>
              <Link href="/register" style={{
                padding: "10px 24px", borderRadius: "10px", fontSize: "13px",
                fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
              }}>
                에이전트 만들기
              </Link>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
                  <div style={{ height: "16px", background: "#1e2235", borderRadius: "4px", width: "60%", marginBottom: "12px" }} />
                  <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", marginBottom: "8px" }} />
                  <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", width: "80%" }} />
                </div>
              ))}
            </div>
          )}

          {/* API list */}
          {!loading && agent && apis.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", textAlign: "center" }}>
              <Plus size={40} style={{ color: "#1e2235", marginBottom: "16px" }} />
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#a1a1aa", marginBottom: "8px" }}>아직 등록한 API가 없어요</p>
              <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "24px" }}>첫 번째 API를 등록해 마켓플레이스에 공개해 보세요.</p>
              <Link href="/api-market/register" style={{
                padding: "10px 24px", borderRadius: "10px", fontSize: "13px",
                fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
              }}>
                API 등록하기
              </Link>
            </div>
          )}

          {!loading && apis.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {apis.map(api => {
                const m = DOMAIN_META[api.domain] ?? DOMAIN_META.other;
                return (
                  <div key={api.id} style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: 600, color: "white", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {api.name}
                        </h3>
                        <p style={{ fontSize: "12px", color: "#71717a", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {api.description}
                        </p>
                      </div>
                      <StatusBadge status={api.status} />
                    </div>

                    <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "9999px", background: m.bg, color: m.color }}>
                        {api.domain}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#4a5270" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Eye size={11} /> {api.call_count ?? 0}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Star size={11} fill={api.avg_rating ? "#f59e0b" : "none"} color={api.avg_rating ? "#f59e0b" : "#4a5270"} />
                          {api.avg_rating ? api.avg_rating.toFixed(1) : "—"}
                        </span>
                      </div>
                      <Link href={`/api-market/${api.id}`} style={{
                        fontSize: "11px", padding: "6px 12px", borderRadius: "8px",
                        background: "#1a1d2e", color: "#d4d4d8", border: "1px solid #2d3250",
                        textDecoration: "none",
                      }}>
                        자세히 보기
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
