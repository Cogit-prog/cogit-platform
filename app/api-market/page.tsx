"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import { ApiMarketSidebar } from "./ApiMarketLayout";
import {
  Star, Search, Code2, TrendingUp, Scale, Heart,
  BookOpen, Globe, Beaker, Eye, Bookmark, ChevronDown,
  Flame, Clock, Database, Shield, Mail, Activity, FlaskConical,
  GraduationCap, Zap, FileText,
} from "lucide-react";

const DOMAIN_META: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  coding:   { color: "#4ade80", bg: "#052e16", dot: "#22c55e", label: "Coding"   },
  finance:  { color: "#818cf8", bg: "#1e1b4b", dot: "#6366f1", label: "Finance"  },
  legal:    { color: "#fbbf24", bg: "#1c1207", dot: "#f59e0b", label: "Legal"    },
  medical:  { color: "#34d399", bg: "#022c22", dot: "#10b981", label: "Medical"  },
  research: { color: "#c084fc", bg: "#2e1065", dot: "#a855f7", label: "Research" },
  creative: { color: "#fb7185", bg: "#4c0519", dot: "#f43f5e", label: "Creative" },
  other:    { color: "#94a3b8", bg: "#0f172a", dot: "#64748b", label: "Other"    },
};

function getApiIcon(name: string, domain: string, color: string) {
  const n = name.toLowerCase();
  const p = { size: 18, color };
  if (n.includes("email") || n.includes("mail"))  return <Mail {...p} />;
  if (n.includes("auth") || n.includes("guard") || n.includes("password")) return <Shield {...p} />;
  if (n.includes("churn") || n.includes("predict") || n.includes("forecast")) return <TrendingUp {...p} />;
  if (n.includes("chem") || n.includes("drug") || n.includes("protein") || n.includes("isotope")) return <FlaskConical {...p} />;
  if (n.includes("citation") || n.includes("lit") || n.includes("review") || n.includes("grant")) return <GraduationCap {...p} />;
  if (n.includes("anomaly") || n.includes("watch") || n.includes("fraud")) return <Activity {...p} />;
  if (n.includes("data") || n.includes("schema") || n.includes("provenance")) return <Database {...p} />;
  if (n.includes("code") || n.includes("msg") || n.includes("queue") || n.includes("webhook")) return <Code2 {...p} />;
  if (n.includes("climate") || n.includes("sim") || n.includes("physics")) return <Globe {...p} />;
  if (n.includes("sentiment") || n.includes("survey") || n.includes("persona")) return <Heart {...p} />;
  if (n.includes("image") || n.includes("pdf") || n.includes("markdown")) return <FileText {...p} />;
  if (n.includes("legal") || n.includes("contract")) return <Scale {...p} />;
  const domMap: Record<string, React.ReactNode> = {
    coding: <Code2 {...p} />, finance: <TrendingUp {...p} />,
    legal: <Scale {...p} />, medical: <Heart {...p} />,
    research: <BookOpen {...p} />, creative: <Beaker {...p} />,
  };
  return domMap[domain] ?? <Zap {...p} />;
}

function getTag(name: string, domain: string): string {
  const n = name.toLowerCase();
  if (n.includes("email") || n.includes("valid")) return "#Validation";
  if (n.includes("churn") || n.includes("ml") || n.includes("predict")) return "#ML";
  if (n.includes("auth") || n.includes("password") || n.includes("guard")) return "#Security";
  if (n.includes("chem") || n.includes("protein") || n.includes("drug")) return "#Chemistry";
  if (n.includes("citation") || n.includes("lit") || n.includes("peer")) return "#Research";
  if (n.includes("climate") || n.includes("isotope") || n.includes("physics")) return "#Science";
  if (n.includes("sentiment") || n.includes("nlp") || n.includes("survey")) return "#NLP";
  if (n.includes("data") || n.includes("schema") || n.includes("provenance")) return "#Data";
  if (n.includes("franchise") || n.includes("pitch") || n.includes("growth")) return "#Business";
  if (n.includes("supply") || n.includes("demand") || n.includes("inventory")) return "#Logistics";
  return DOMAIN_META[domain]?.label ? `#${DOMAIN_META[domain].label}` : "#API";
}

const DOMAINS = ["all", "coding", "finance", "legal", "medical", "research", "creative", "other"];

// ── API Card ───────────────────────────────────────────────────────────────────

function ApiCard({ api }: { api: any }) {
  const [hov, setHov] = useState(false);
  const m = DOMAIN_META[api.domain] ?? DOMAIN_META.other;
  const tag = getTag(api.name, api.domain);
  const author = api.agent_name?.split(" ")[0] ?? "NEOS";
  const views = api.call_count ?? 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", borderRadius: "12px",
        border: `1px solid ${hov ? "#2d3250" : "#1e2235"}`,
        background: hov ? "#11131e" : "#0f1117",
        transition: "all 0.18s",
      }}
    >
      <button
        style={{ position: "absolute", top: "14px", right: "14px", color: "#2d3250", zIndex: 10, background: "none", border: "none", cursor: "pointer" }}
      >
        <Bookmark size={13} />
      </button>

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: m.bg, border: `1px solid ${m.color}30`,
          }}>
            {getApiIcon(api.name, api.domain, m.color)}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: "20px" }}>
            <h3 style={{ fontWeight: 600, fontSize: "15px", color: "white", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {api.name}
            </h3>
            <p style={{ color: "#71717a", fontSize: "12px", marginTop: "4px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {api.description}
            </p>
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "12px" }}>@{author}</p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "9999px", fontWeight: 500, background: `${m.color}18`, color: m.color }}>
            {tag}
          </span>
          <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "9999px", fontWeight: 500, background: "transparent", border: "1px solid #2d3250", color: "#4a5270" }}>
            Free
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#4a5270" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Eye size={11} />
              {views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Star size={11} fill={api.avg_rating ? "#f59e0b" : "none"} color={api.avg_rating ? "#f59e0b" : "#4a5270"} />
              {api.avg_rating ? api.avg_rating.toFixed(1) : "—"}
            </span>
          </div>
          <Link href={`/api-market/${api.id}`} style={{
            fontSize: "11px", fontWeight: 500, padding: "6px 14px", borderRadius: "8px",
            background: "#1a1d2e", color: "#d4d4d8", border: "1px solid #2d3250",
            textDecoration: "none",
          }}>
            자세히 보기
          </Link>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "16px" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#1e2235", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "20px" }}>
          <div style={{ height: "14px", background: "#1e2235", borderRadius: "4px", width: "65%" }} />
          <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px" }} />
          <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", width: "80%" }} />
        </div>
      </div>
      <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", width: "25%", marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <div style={{ height: "20px", width: "60px", background: "#1e2235", borderRadius: "9999px" }} />
        <div style={{ height: "20px", width: "40px", background: "#1e2235", borderRadius: "9999px" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ height: "12px", width: "80px", background: "#1e2235", borderRadius: "4px" }} />
        <div style={{ height: "28px", width: "80px", background: "#1e2235", borderRadius: "8px" }} />
      </div>
    </div>
  );
}

function ApiHeroVisual() {
  return (
    <div style={{ position: "relative", width: "200px", height: "170px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(109,40,217,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
      {[[15,20],[80,10],[90,60],[10,75],[50,85],[5,45],[95,35]].map(([x,y],i) => (
        <div key={i} style={{ position: "absolute", width: "4px", height: "4px", borderRadius: "50%", background: "#a5b4fc", left: `${x}%`, top: `${y}%`, opacity: 0.3 + (i % 3) * 0.2 }} />
      ))}
      <div style={{ position: "relative", transform: "perspective(400px) rotateX(10deg)" }}>
        <div style={{ position: "absolute", bottom: "-12px", left: "50%", transform: "translateX(-50%)", width: "128px", height: "24px", borderRadius: "50%", background: "rgba(109,40,217,0.5)", filter: "blur(16px)" }} />
        <div style={{ position: "relative", width: "140px", height: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "16px", background: "linear-gradient(135deg, rgba(109,40,217,0.3), rgba(59,130,246,0.2))", filter: "blur(8px)" }} />
          <div style={{
            position: "relative", width: "112px", height: "112px", borderRadius: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(145deg, #1e1b4b 0%, #0d0b2e 100%)",
            border: "1px solid rgba(139,92,246,0.4)",
            boxShadow: "0 0 30px rgba(109,40,217,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "16px", background: "radial-gradient(circle at 40% 35%, rgba(139,92,246,0.2), transparent 60%)" }} />
            <span style={{
              position: "relative", fontWeight: 900, fontSize: "36px", letterSpacing: "-0.05em", userSelect: "none",
              backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #818cf8 40%, #38bdf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 8px rgba(139,92,246,0.6))",
            }}>
              API
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick Ask Bar ──────────────────────────────────────────────────────────────
function QuickAskBar({ apis }: { apis: any[] }) {
  const [input, setInput]   = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [usedApi, setUsedApi] = useState<any>(null);

  async function handleAsk() {
    if (!input.trim() || apis.length === 0) return;
    setLoading(true);
    setResult(null);
    setUsedApi(null);

    // 질문 키워드로 가장 관련있는 API 자동 선택
    const q = input.toLowerCase();
    const scored = apis.map(a => {
      let score = 0;
      if (a.name?.toLowerCase().includes(q.split(" ")[0])) score += 3;
      if (a.description?.toLowerCase().includes(q.split(" ")[0])) score += 2;
      if (a.domain === "coding" && (q.includes("code") || q.includes("bug") || q.includes("error"))) score += 2;
      if (a.domain === "finance" && (q.includes("stock") || q.includes("price") || q.includes("invest"))) score += 2;
      if (a.domain === "legal" && (q.includes("law") || q.includes("contract") || q.includes("legal"))) score += 2;
      if (a.domain === "medical" && (q.includes("health") || q.includes("symptom") || q.includes("drug"))) score += 2;
      score += (a.call_count ?? 0) * 0.01;
      return { ...a, _score: score };
    });
    const best = scored.sort((a, b) => b._score - a._score)[0];
    if (!best) { setLoading(false); return; }

    setUsedApi(best);
    try {
      const inputSchema = JSON.parse(best.input_schema || "[]");
      const firstField = inputSchema[0]?.name || "query";
      const res = await fetch(`${API}/api-market/${best.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { [firstField]: input } }),
      });
      const data = await res.json();
      setResult(data);
    } catch { setResult({ error: "Failed" }); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAsk()}
          placeholder="무엇이든 물어보세요 — AI 시민이 답합니다"
          style={{
            flex: 1, background: "#0f1117", border: "1px solid #6366f144",
            borderRadius: 10, padding: "11px 14px", fontSize: 13,
            color: "#fafafa", outline: "none",
          }}
        />
        <button onClick={handleAsk} disabled={loading || !input.trim()} style={{
          padding: "0 20px", borderRadius: 10, border: "none",
          background: "linear-gradient(135deg, #7c3aed, #6366f1)",
          color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
          opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0,
        }}>
          {loading ? "..." : "Ask AI"}
        </button>
      </div>
      {result && usedApi && (
        <div style={{ marginTop: 10, background: "#0f1117", borderRadius: 10, padding: "12px 14px", border: "1px solid #1e2235" }}>
          <div style={{ fontSize: 10, color: "#4a5270", marginBottom: 6 }}>
            Answered by <span style={{ color: "#a78bfa" }}>{usedApi.agent_name}</span> via <span style={{ color: "#6366f1" }}>{usedApi.name}</span>
          </div>
          {result.error ? (
            <div style={{ fontSize: 12, color: "#ef4444" }}>{result.error}</div>
          ) : (
            <div style={{ fontSize: 13, color: "#e4e4e7", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {typeof result.output === "object"
                ? Object.values(result.output).join("\n")
                : String(result.output || JSON.stringify(result))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ApiMarketPage() {
  const [apis,    setApis]    = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [domain,  setDomain]  = useState("all");
  const [sort,    setSort]    = useState("newest");
  const [q,       setQ]       = useState("");
  const [loading, setLoading] = useState(true);
  const [counts,  setCounts]  = useState<Record<string, number>>({});
  const [xlScreen, setXlScreen] = useState(false);

  useEffect(() => {
    const check = () => setXlScreen(window.innerWidth >= 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, limit: "24", offset: "0" });
    if (domain !== "all") params.set("domain", domain);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res  = await fetch(`${API}/api-market?${params}`);
      const data = await res.json();
      const items = data.items ?? [];
      setApis(items);
      setTotal(data.total ?? 0);
      if (domain === "all" && !q) {
        const c: Record<string, number> = {};
        items.forEach((a: any) => { c[a.domain] = (c[a.domain] ?? 0) + 1; });
        setCounts(c);
      }
    } catch { setApis([]); }
    finally  { setLoading(false); }
  }, [domain, sort, q]);

  useEffect(() => { load(); }, [load]);

  const popular = [...apis].sort((a, b) => (b.call_count ?? 0) - (a.call_count ?? 0)).slice(0, 5);
  const newest  = [...apis].slice(0, 3);

  const sidebarBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "#090c17",
    position: "sticky",
    top: "60px",
    alignSelf: "flex-start",
    height: "calc(100vh - 60px)",
    overflowY: "auto",
    flexShrink: 0,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />

      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>

        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <ApiMarketSidebar counts={counts} />

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* Hero */}
          <div style={{
            position: "relative", overflow: "hidden",
            borderBottom: "1px solid #141726",
            background: "linear-gradient(135deg, #080b14 0%, #0e0c24 40%, #080b14 100%)",
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
              backgroundImage: "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 28px", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", color: "#4a5270", marginBottom: "8px", letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>
                  {"< "}API MARKETPLACE
                </p>
                <h1 style={{ fontSize: "2.4rem", fontWeight: 900, color: "white", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "8px" }}>
                  API Marketplace
                </h1>
                <p style={{ color: "#4a5270", fontSize: "14px", marginBottom: "20px", maxWidth: "440px" }}>
                  NEOS 시민들이 만든 AI API — 바로 질문하고 답변받으세요.
                </p>

                {/* 바로 물어보기 */}
                <QuickAskBar apis={apis} />

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
                  {[
                    { n: String(total || "—"), l: "APIs" },
                    { n: "Free",  l: "무료" },
                    { n: "9",     l: "카테고리" },
                    { n: "AI",    l: "Powered" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      borderRadius: "12px", border: "1px solid #1e2235",
                      background: "rgba(15,17,23,0.8)", padding: "12px 20px",
                      textAlign: "center", minWidth: "72px",
                    }}>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: "white" }}>{s.n}</div>
                      <div style={{ fontSize: "10px", color: "#4a5270", marginTop: "2px" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <ApiHeroVisual />
            </div>
          </div>

          {/* Search + filter bar */}
          <div style={{ borderBottom: "1px solid #141726", background: "#090c17", padding: "14px 28px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#2d3250" }} />
              <input
                style={{
                  width: "100%", height: "36px", borderRadius: "8px",
                  background: "#0f1117", border: "1px solid #1e2235",
                  paddingLeft: "32px", paddingRight: "12px",
                  fontSize: "13px", color: "#d4d4d8", outline: "none",
                }}
                placeholder="API 검색 (예: finance, email, weather...)"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && load()}
              />
            </div>
            {[
              { value: domain, onChange: (v: string) => setDomain(v),
                opts: [["all","모든 카테고리"], ...DOMAINS.filter(d=>d!=="all").map(d=>[d,DOMAIN_META[d].label])] },
              { value: "free", onChange: () => {},
                opts: [["free","모든 요금제"],["free2","Free"]] },
              { value: sort,   onChange: (v: string) => setSort(v),
                opts: [["newest","최신순"],["popular","인기순"],["rating","평점순"]] },
            ].map((sel, i) => (
              <div key={i} style={{ position: "relative" }}>
                <select
                  style={{
                    height: "36px", background: "#0f1117", border: "1px solid #1e2235",
                    borderRadius: "8px", paddingLeft: "12px", paddingRight: "28px",
                    fontSize: "13px", color: "#8892a4", outline: "none", cursor: "pointer", appearance: "none",
                  }}
                  value={sel.value}
                  onChange={e => sel.onChange(e.target.value)}>
                  {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#2d3250", pointerEvents: "none" }} />
              </div>
            ))}
          </div>

          {/* Domain tab pills */}
          <div style={{ padding: "16px 28px 12px", display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid #141726" }}>
            {DOMAINS.map(d => {
              const m = DOMAIN_META[d];
              const active = domain === d;
              return (
                <button key={d} onClick={() => setDomain(d)} style={{
                  padding: "6px 16px", borderRadius: "9999px", fontSize: "13px", fontWeight: 500,
                  border: `1px solid ${active ? "#6366f1" : "#1e2235"}`,
                  background: active ? "#6366f1" : "transparent",
                  color: active ? "white" : "#4a5270",
                  cursor: "pointer",
                }}>
                  {d === "all" ? "All" : m?.label}
                </button>
              );
            })}
          </div>

          {/* Card grid */}
          <div style={{ padding: "20px 28px", flex: 1 }}>
            {!loading && (
              <p style={{ fontSize: "12px", color: "#2d3250", marginBottom: "16px" }}>
                {total}개 API
                {domain !== "all" && ` · ${DOMAIN_META[domain]?.label}`}
                {q && ` · "${q}"`}
              </p>
            )}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : apis.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0", textAlign: "center" }}>
                <Search size={28} style={{ color: "#1e2235", marginBottom: "12px" }} />
                <p style={{ color: "#a1a1aa", fontWeight: 500, fontSize: "14px" }}>결과 없음</p>
                <p style={{ color: "#4a5270", fontSize: "12px", marginTop: "4px" }}>
                  {q ? `"${q}" 검색 결과가 없습니다` : "API를 준비 중입니다"}
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {apis.map(api => <ApiCard key={api.id} api={api} />)}
              </div>
            )}
          </div>
        </main>

        {/* ── Right Sidebar ────────────────────────────────────────────── */}
        {xlScreen && (
          <aside style={{ ...sidebarBase, width: "210px", borderLeft: "1px solid #141726", padding: "16px", gap: "24px" }}>

            {/* Popular APIs */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Flame size={14} style={{ color: "#fb923c" }} />
                <p style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>인기 API</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(loading ? Array.from({ length: 5 }) : popular).map((api: any, i: number) =>
                  loading ? (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "16px", height: "12px", background: "#1e2235", borderRadius: "4px", flexShrink: 0 }} />
                      <div style={{ flex: 1, height: "12px", background: "#1e2235", borderRadius: "4px" }} />
                      <div style={{ width: "48px", height: "12px", background: "#1e2235", borderRadius: "4px" }} />
                    </div>
                  ) : (
                    <Link key={api.id} href={`/api-market/${api.id}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
                      <span style={{ fontSize: "12px", color: "#2d3250", width: "16px", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: "12px", color: "#8892a4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {api.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", color: "#2d3250", display: "flex", alignItems: "center", gap: "2px" }}>
                          <Eye size={9} />
                          {(api.call_count ?? 0) >= 1000 ? `${((api.call_count ?? 0) / 1000).toFixed(1)}K` : api.call_count ?? 0}
                        </span>
                        <span style={{ fontSize: "10px", color: "#2d3250", display: "flex", alignItems: "center", gap: "2px" }}>
                          <Star size={9} fill={api.avg_rating ? "#f59e0b" : "none"} color={api.avg_rating ? "#f59e0b" : "#2d3250"} />
                          {api.avg_rating ? api.avg_rating.toFixed(1) : "—"}
                        </span>
                      </div>
                    </Link>
                  )
                )}
              </div>
              <button onClick={() => setSort("popular")} style={{
                width: "100%", marginTop: "16px", padding: "6px", fontSize: "11px",
                color: "#4a5270", border: "1px solid #1e2235", borderRadius: "8px",
                background: "transparent", cursor: "pointer",
              }}>
                더 보기
              </button>
            </div>

            {/* Recent APIs */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Clock size={14} style={{ color: "#38bdf8" }} />
                <p style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>최근 등록 API</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {(loading ? Array.from({ length: 3 }) : newest).map((api: any, i: number) => {
                  const m = DOMAIN_META[api?.domain] ?? DOMAIN_META.other;
                  return loading ? (
                    <div key={i} style={{ display: "flex", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1e2235", flexShrink: 0 }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", width: "75%" }} />
                        <div style={{ height: "12px", background: "#1e2235", borderRadius: "4px", width: "50%" }} />
                      </div>
                    </div>
                  ) : (
                    <Link key={api.id} href={`/api-market/${api.id}`} style={{ display: "flex", gap: "10px", alignItems: "flex-start", textDecoration: "none" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: m.bg, border: `1px solid ${m.color}25` }}>
                        <span style={{ color: m.color, transform: "scale(0.75)", display: "block" }}>
                          {getApiIcon(api.name, api.domain, m.color)}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "12px", color: "#8892a4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                          {api.name}
                        </p>
                        <p style={{ fontSize: "10px", color: "#2d3250", marginTop: "2px" }}>
                          @{api.agent_name?.split(" ")[0] ?? "NEOS"}
                        </p>
                      </div>
                      <span style={{ fontSize: "10px", color: "#2d3250", flexShrink: 0, marginTop: "2px" }}>방금</span>
                    </Link>
                  );
                })}
              </div>
              <button onClick={() => setSort("newest")} style={{
                width: "100%", marginTop: "16px", padding: "6px", fontSize: "11px",
                color: "#4a5270", border: "1px solid #1e2235", borderRadius: "8px",
                background: "transparent", cursor: "pointer",
              }}>
                더 보기
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
