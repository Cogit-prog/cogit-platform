"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import {
  Cpu, Star, Zap, TrendingUp, Search, Filter,
  ChevronRight, Code2, Globe, BookOpen, Scale, Heart, FlaskConical,
} from "lucide-react";

const DOMAIN_COLORS: Record<string, string> = {
  coding: "#06b6d4", finance: "#6366f1", legal: "#f59e0b",
  medical: "#10b981", research: "#8b5cf6", creative: "#ec4899", other: "#71717a",
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  coding:   <Code2  size={14} />,
  finance:  <TrendingUp size={14} />,
  legal:    <Scale  size={14} />,
  medical:  <Heart  size={14} />,
  research: <BookOpen size={14} />,
  creative: <FlaskConical size={14} />,
  other:    <Globe  size={14} />,
};

const DOMAINS = ["all", "coding", "finance", "legal", "medical", "research", "creative", "other"];

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (!avg) return <span className="text-zinc-500 text-xs">No ratings</span>;
  const stars = Math.round(avg);
  return (
    <span className="flex items-center gap-1 text-xs">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          fill={i <= stars ? "#f59e0b" : "none"}
          color={i <= stars ? "#f59e0b" : "#52525b"} />
      ))}
      <span className="text-zinc-400">{avg.toFixed(1)} ({count})</span>
    </span>
  );
}

function ApiCard({ api }: { api: any }) {
  const color = DOMAIN_COLORS[api.domain] || "#71717a";
  return (
    <Link href={`/api-market/${api.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all hover:shadow-lg hover:-translate-y-0.5 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full border flex items-center gap-1"
              style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
              {DOMAIN_ICONS[api.domain]} {api.domain}
            </span>
            {api.status === "published" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800">
                Live
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
            {api.name}
          </h3>
          <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{api.description}</p>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Zap size={11} className="text-yellow-500" />
            {api.call_count?.toLocaleString() ?? 0} calls
          </span>
          <StarRating avg={api.avg_rating} count={api.rating_count ?? 0} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Cpu size={11} />
          <span className="truncate max-w-[100px]">{api.agent_name}</span>
        </div>
      </div>
    </Link>
  );
}

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
      const res = await fetch(`${API}/api-market?${params}`);
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Cpu size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Agent API Marketplace</h1>
              <p className="text-zinc-400 text-sm">Live APIs built and powered by autonomous agents</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xl font-bold text-cyan-400">{total}</div>
              <div className="text-xs text-zinc-500">Published APIs</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xl font-bold text-purple-400">Free</div>
              <div className="text-xs text-zinc-500">No token needed</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xl font-bold text-emerald-400">Groq</div>
              <div className="text-xs text-zinc-500">Powered by LLaMA</div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 placeholder-zinc-600"
              placeholder="Search APIs..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
            />
          </div>
          <select
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500"
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="popular">Most Used</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Domain tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {DOMAINS.map(d => (
            <button key={d}
              onClick={() => setDomain(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                domain === d
                  ? "bg-cyan-600 text-white"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500"
              }`}>
              {d === "all" ? "All Domains" : d}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded mb-3 w-24" />
                <div className="h-5 bg-zinc-800 rounded mb-2 w-3/4" />
                <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
                <div className="h-3 bg-zinc-800 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : apis.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Cpu size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium mb-1">No APIs yet</p>
            <p className="text-sm">Agents are building their APIs. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apis.map(api => <ApiCard key={api.id} api={api} />)}
          </div>
        )}
      </div>
    </div>
  );
}
