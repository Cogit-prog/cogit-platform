"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { API } from "@/lib/api";
import { TrendingUp, BarChart3, Layers, Eye, Star, Zap } from "lucide-react";

const DOMAIN_META: Record<string, { color: string; dot: string; label: string }> = {
  coding:   { color: "#4ade80", dot: "#22c55e", label: "Coding"   },
  finance:  { color: "#818cf8", dot: "#6366f1", label: "Finance"  },
  legal:    { color: "#fbbf24", dot: "#f59e0b", label: "Legal"    },
  medical:  { color: "#34d399", dot: "#10b981", label: "Medical"  },
  research: { color: "#c084fc", dot: "#a855f7", label: "Research" },
  creative: { color: "#fb7185", dot: "#f43f5e", label: "Creative" },
  other:    { color: "#94a3b8", dot: "#64748b", label: "Other"    },
};

export default function AnalyticsPage() {
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api-market/stats/overview`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDomainCnt = stats?.by_domain?.[0]?.cnt ?? 1;
  const maxCalls = stats?.top_apis?.[0]?.call_count ?? 1;

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        <ApiMarketSidebar />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 36px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "4px" }}>API 분석</h1>
          <p style={{ fontSize: "13px", color: "#4a5270", marginBottom: "28px" }}>
            마켓플레이스 전체 통계 현황
          </p>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "32px" }}>
            {[
              { icon: <Layers size={18} />, label: "전체 API", value: loading ? "—" : stats?.total_apis ?? 0, color: "#818cf8" },
              { icon: <Eye size={18} />, label: "총 호출수", value: loading ? "—" : (stats?.total_calls >= 1000 ? `${(stats.total_calls / 1000).toFixed(1)}K` : stats?.total_calls ?? 0), color: "#4ade80" },
              { icon: <Zap size={18} />, label: "도메인 수", value: loading ? "—" : stats?.by_domain?.length ?? 0, color: "#38bdf8" },
              { icon: <TrendingUp size={18} />, label: "Top 호출 API", value: loading ? "—" : stats?.top_apis?.[0]?.name?.split(" ")[0] ?? "—", color: "#fbbf24" },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "18px" }}>
                <div style={{ color: s.color, marginBottom: "10px" }}>{s.icon}</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "white", marginBottom: "4px" }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "#4a5270" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Domain breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>

            <div style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <BarChart3 size={15} style={{ color: "#818cf8" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>도메인별 API 수</h3>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height: "28px", background: "#1e2235", borderRadius: "6px" }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(stats?.by_domain ?? []).map((d: any) => {
                    const m = DOMAIN_META[d.domain] ?? DOMAIN_META.other;
                    const pct = Math.round((d.cnt / maxDomainCnt) * 100);
                    return (
                      <div key={d.domain}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", color: "#8892a4", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.dot }} />
                            {m.label}
                          </span>
                          <span style={{ fontSize: "12px", color: "#4a5270" }}>{d.cnt}</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "9999px", background: "#1e2235" }}>
                          <div style={{ height: "100%", borderRadius: "9999px", background: m.color, width: `${pct}%`, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top APIs */}
            <div style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <TrendingUp size={15} style={{ color: "#fb923c" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>인기 API Top 10</h3>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height: "28px", background: "#1e2235", borderRadius: "6px" }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(stats?.top_apis ?? []).map((api: any, i: number) => {
                    const m = DOMAIN_META[api.domain] ?? DOMAIN_META.other;
                    const pct = Math.round(((api.call_count ?? 0) / maxCalls) * 100);
                    return (
                      <div key={api.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", color: "#2d3250", width: "16px", textAlign: "right" }}>{i + 1}</span>
                            <span style={{ fontSize: "12px", color: "#8892a4", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{api.name}</span>
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#4a5270" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Eye size={9} /> {api.call_count ?? 0}
                            </span>
                            {api.avg_rating && (
                              <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                <Star size={9} fill="#f59e0b" color="#f59e0b" /> {api.avg_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ height: "4px", borderRadius: "9999px", background: "#1e2235", marginLeft: "24px" }}>
                          <div style={{ height: "100%", borderRadius: "9999px", background: m.color, width: `${pct}%`, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
