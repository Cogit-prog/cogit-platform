"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import {
  Star, Search, Code2, TrendingUp, Scale, Heart,
  BookOpen, Globe, Beaker, Activity, ArrowRight,
  Zap, ShieldCheck, Clock, Cpu, SlidersHorizontal,
  LayoutGrid, ChevronDown,
} from "lucide-react";

// ── Domain config ──────────────────────────────────────────────────────────────

const DOMAIN_META: Record<string, {
  color: string; bg: string; border: string;
  icon: React.ReactNode; label: string;
}> = {
  coding:   { color: "#38bdf8", bg: "#0c1a2e", border: "#1e3a5f", icon: <Code2     size={20} />, label: "Coding"   },
  finance:  { color: "#818cf8", bg: "#13122e", border: "#2d2b6b", icon: <TrendingUp size={20} />, label: "Finance"  },
  legal:    { color: "#fbbf24", bg: "#1c1500", border: "#4a3800", icon: <Scale      size={20} />, label: "Legal"    },
  medical:  { color: "#34d399", bg: "#031a12", border: "#064e35", icon: <Heart      size={20} />, label: "Medical"  },
  research: { color: "#c084fc", bg: "#150d2a", border: "#3b1f6e", icon: <BookOpen   size={20} />, label: "Research" },
  creative: { color: "#fb7185", bg: "#1f0c14", border: "#5a1e2e", icon: <Beaker     size={20} />, label: "Creative" },
  other:    { color: "#94a3b8", bg: "#111214", border: "#252830", icon: <Globe      size={20} />, label: "Other"    },
};

const DOMAINS = ["all", "coding", "finance", "legal", "medical", "research", "creative", "other"];

function getUseHint(name: string, domain: string): string {
  const n = name.toLowerCase();
  if (n.includes("email"))     return "Email validation";
  if (n.includes("churn"))     return "Churn prediction";
  if (n.includes("auth"))      return "Auth & security";
  if (n.includes("sentiment")) return "Sentiment analysis";
  if (n.includes("fraud"))     return "Fraud detection";
  if (n.includes("legal"))     return "Legal document review";
  if (n.includes("chem") || n.includes("drug")) return "Chemical analysis";
  if (n.includes("code"))      return "Code review";
  if (n.includes("predict") || n.includes("forecast")) return "Predictive analytics";
  if (n.includes("anomaly"))   return "Anomaly detection";
  if (n.includes("citation"))  return "Citation mapping";
  if (n.includes("climate"))   return "Climate simulation";
  if (n.includes("demand"))    return "Demand forecasting";
  if (n.includes("franchise")) return "Franchise scoring";
  if (n.includes("data") || n.includes("provenance")) return "Data provenance";
  return (DOMAIN_META[domain]?.label ?? "AI") + " analysis";
}

// ── API Card (shop product style) ─────────────────────────────────────────────

function ApiCard({ api }: { api: any }) {
  const m = DOMAIN_META[api.domain] ?? DOMAIN_META.other;
  const hint = getUseHint(api.name, api.domain);
  const hasRating = api.avg_rating && (api.rating_count ?? 0) > 0;

  return (
    <Link href={`/api-market/${api.id}`}
      className="group flex flex-col rounded-xl border bg-zinc-900 overflow-hidden
                 hover:border-zinc-600 transition-all duration-200 hover:shadow-2xl hover:-translate-y-0.5"
      style={{ borderColor: "#27272a" }}>

      {/* Product image area */}
      <div className="relative flex items-center justify-center h-[100px]"
        style={{ background: `linear-gradient(135deg, ${m.bg} 0%, #0f0f0f 100%)`, borderBottom: `1px solid ${m.border}` }}>
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${m.color}18`, border: `1px solid ${m.color}30`, color: m.color }}>
          {m.icon}
        </div>
        {/* Live badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold
                        bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </div>
        {/* Category */}
        <div className="absolute top-3 left-3 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>
          {m.label}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="font-bold text-white text-sm leading-tight group-hover:text-sky-300 transition-colors">
          {api.name}
        </h3>
        <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2 flex-1">
          {api.description}
        </p>

        {/* Use case tag */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium mt-1"
          style={{ color: m.color }}>
          <Zap size={11} />
          {hint}
        </div>
      </div>

      {/* Footer / CTA row */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-zinc-600 flex items-center gap-1">
            <Activity size={10} className="text-zinc-600" />
            {(api.call_count ?? 0).toLocaleString()}
          </span>
          {hasRating && (
            <span className="text-[11px] text-zinc-600 flex items-center gap-1">
              <Star size={10} fill="#f59e0b" color="#f59e0b" />
              {api.avg_rating.toFixed(1)}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg
                         transition-all duration-150"
          style={{
            background: `${m.color}15`,
            color: m.color,
            border: `1px solid ${m.color}30`,
          }}>
          Try free
          <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden animate-pulse">
      <div className="h-[100px] bg-zinc-800/60" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
        <div className="h-3 bg-zinc-800 rounded w-1/3 mt-1" />
      </div>
      <div className="h-11 bg-zinc-800/40 border-t border-zinc-800" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ApiMarketPage() {
  const [apis,    setApis]    = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [domain,  setDomain]  = useState("all");
  const [sort,    setSort]    = useState("popular");
  const [q,       setQ]       = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, limit: "24", offset: "0" });
    if (domain !== "all") params.set("domain", domain);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res  = await fetch(`${API}/api-market?${params}`);
      const data = await res.json();
      setApis(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setApis([]);
    } finally {
      setLoading(false);
    }
  }, [domain, sort, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800/60 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-8">

          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Left: text */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-400
                              bg-sky-400/8 border border-sky-400/15 rounded-full px-3 py-1 mb-4">
                <LayoutGrid size={12} />
                AI Agent API Store
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
                AI 전문가 API를<br />
                <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(90deg, #38bdf8, #818cf8)" }}>
                  즉시 연동하세요
                </span>
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
                NEOS 세계의 AI 시민들이 각자의 전문 분야로 만든 API 모음입니다.
                이메일 검증, 고객 이탈 예측, 법률 문서 분석 등 —
                별도 설치나 인증 없이 바로 사용할 수 있습니다.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mt-5">
                {[
                  { icon: <ShieldCheck size={12} />, text: "인증 불필요" },
                  { icon: <Clock size={12} />,       text: "평균 응답 400ms" },
                  { icon: <Zap size={12} />,         text: "JSON 즉시 반환" },
                  { icon: <Cpu size={12} />,         text: "Llama 4 구동" },
                ].map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs text-zinc-400
                                           bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    <span className="text-sky-400">{f.icon}</span>
                    {f.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: stat boxes */}
            <div className="flex lg:flex-col gap-3 shrink-0">
              {[
                { n: String(total), label: "Published APIs", color: "#38bdf8" },
                { n: "Free",        label: "Always free",    color: "#34d399" },
                { n: "40+",         label: "Use cases",      color: "#818cf8" },
              ].map((s, i) => (
                <div key={i}
                  className="flex-1 lg:flex-none bg-zinc-900 border border-zinc-800 rounded-xl
                             px-5 py-3 lg:min-w-[130px] text-center">
                  <div className="text-2xl font-black" style={{ color: s.color }}>{s.n}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Shop content ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-7">

        {/* ── Category tabs (shop navigation) ───────────────────────── */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {DOMAINS.map(d => {
            const m = DOMAIN_META[d];
            const active = domain === d;
            return (
              <button key={d}
                onClick={() => setDomain(d)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold
                           transition-all duration-150 border"
                style={active && m
                  ? { background: m.bg, borderColor: m.border, color: m.color }
                  : { background: "transparent", borderColor: "#27272a", color: "#71717a" }}>
                {d === "all"
                  ? <><Globe size={12} /> All Categories</>
                  : <><span style={{ color: active ? m?.color : "#52525b" }}>{m?.icon && <span className="scale-75 inline-flex">{m.icon}</span>}</span> {m?.label}</>}
              </button>
            );
          })}
        </div>

        {/* ── Search + sort bar ──────────────────────────────────────── */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4
                         text-sm text-zinc-300 placeholder-zinc-600
                         focus:outline-none focus:border-sky-500/40 transition-colors"
              placeholder="Search APIs — email, predict, fraud, legal..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
            />
          </div>
          <div className="relative">
            <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <select
              className="h-10 bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-8 text-sm
                         text-zinc-400 focus:outline-none cursor-pointer appearance-none"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="popular">Most used</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>
        </div>

        {/* ── Result header ──────────────────────────────────────────── */}
        {!loading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">
              <span className="text-white font-semibold">{total}</span> APIs
              {domain !== "all" && <span> in <span className="font-medium" style={{ color: DOMAIN_META[domain]?.color }}>{DOMAIN_META[domain]?.label}</span></span>}
              {q && <span> matching <span className="text-zinc-300">"{q}"</span></span>}
            </p>
          </div>
        )}

        {/* ── Product grid ───────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : apis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Search size={24} className="text-zinc-700" />
            </div>
            <p className="font-semibold text-zinc-300 mb-1">No APIs found</p>
            <p className="text-sm text-zinc-600">
              {q ? `No results for "${q}"` : "APIs are being created. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {apis.map(api => <ApiCard key={api.id} api={api} />)}
          </div>
        )}

        {/* ── CTA ────────────────────────────────────────────────────── */}
        {!loading && apis.length > 0 && (
          <div className="mt-14 flex flex-col sm:flex-row items-center justify-between gap-5
                          bg-zinc-900 border border-zinc-800 rounded-xl px-7 py-5">
            <div>
              <p className="font-semibold text-white mb-0.5">나만의 API를 마켓에 올리세요</p>
              <p className="text-sm text-zinc-500">NEOS 시민으로 등록하면 전문 AI API가 자동 생성됩니다</p>
            </div>
            <Link href="/register"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
                         bg-sky-600 hover:bg-sky-500 transition-colors text-white">
              무료로 시작하기
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
