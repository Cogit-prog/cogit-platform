"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API } from "@/lib/api";
import {
  Cpu, Star, Zap, Copy, Check, Play, ChevronLeft,
  Code2, FileJson, BookOpen, Activity, Clock, TrendingUp,
  ExternalLink, Terminal,
} from "lucide-react";

const DOMAIN_COLORS: Record<string, string> = {
  coding: "#06b6d4", finance: "#6366f1", legal: "#f59e0b",
  medical: "#10b981", research: "#8b5cf6", creative: "#ec4899", other: "#71717a",
};

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (!avg) return <span className="text-zinc-500 text-xs">No ratings yet</span>;
  const stars = Math.round(avg);
  return (
    <span className="flex items-center gap-1 text-sm">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14}
          fill={i <= stars ? "#f59e0b" : "none"}
          color={i <= stars ? "#f59e0b" : "#52525b"} />
      ))}
      <span className="text-zinc-300 ml-1">{avg.toFixed(1)}</span>
      <span className="text-zinc-500">({count} ratings)</span>
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy}
      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function buildCurl(apiId: string, input: Record<string, any>): string {
  return `curl -X POST "${API}/api-market/${apiId}/call" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ input }, null, 2)}'`;
}

function buildPython(apiId: string, input: Record<string, any>): string {
  return `import requests

response = requests.post(
    "${API}/api-market/${apiId}/call",
    json={"input": ${JSON.stringify(input, null, 4).replace(/^/gm, "    ").trimStart()}},
)
data = response.json()
print(data["output"])`;
}

function buildJs(apiId: string, input: Record<string, any>): string {
  return `const response = await fetch(
  "${API}/api-market/${apiId}/call",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: ${JSON.stringify(input, null, 4).replace(/^/gm, "    ").trimStart()} }),
  }
);
const data = await response.json();
console.log(data.output);`;
}

export default function ApiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [api,       setApi]       = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"playground"|"docs"|"code">("playground");
  const [codeTab,   setCodeTab]   = useState<"curl"|"python"|"js">("curl");
  const [inputs,    setInputs]    = useState<Record<string, string>>({});
  const [result,    setResult]    = useState<any>(null);
  const [calling,   setCalling]   = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [rated,     setRated]     = useState(false);

  useEffect(() => {
    fetch(`${API}/api-market/${id}`)
      .then(r => r.json())
      .then(d => {
        setApi(d);
        // Pre-fill example inputs
        const ex = d.example_input ?? {};
        const pre: Record<string, string> = {};
        (d.input_schema ?? []).forEach((f: any) => {
          pre[f.name] = ex[f.name] !== undefined ? String(ex[f.name]) : "";
        });
        setInputs(pre);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function runApi() {
    setCalling(true);
    setCallError(null);
    setResult(null);
    const inputObj: Record<string, any> = {};
    (api.input_schema ?? []).forEach((f: any) => {
      const raw = inputs[f.name] ?? "";
      if (f.type === "number") inputObj[f.name] = parseFloat(raw) || 0;
      else if (f.type === "boolean") inputObj[f.name] = raw === "true";
      else inputObj[f.name] = raw;
    });
    try {
      const res = await fetch(`${API}/api-market/${id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputObj }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Call failed");
      setResult(data);
    } catch (e: any) {
      // Handle rate limit specifically
      if (e.message?.includes("429") || e.message?.toLowerCase().includes("rate limit")) {
        setCallError("Rate limit reached. Wait a few minutes before calling again.");
      } else {
        setCallError(e.message);
      }
    } finally {
      setCalling(false);
    }
  }

  async function submitRating(score: number) {
    const token = localStorage.getItem("cogit_token");
    if (!token) { alert("Log in to rate APIs"); return; }
    const res = await fetch(`${API}/api-market/${id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      const d = await res.json();
      setApi((a: any) => ({ ...a, avg_rating: d.avg_rating, rating_count: d.rating_count }));
      setRated(true);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-1/2 mb-4" />
        <div className="h-4 bg-zinc-800 rounded w-3/4 mb-8" />
        <div className="h-64 bg-zinc-900 rounded-xl" />
      </div>
    </div>
  );

  if (!api) return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-zinc-500">
        API not found.
      </div>
    </div>
  );

  const color      = DOMAIN_COLORS[api.domain] || "#71717a";
  const inputObj   = Object.fromEntries(
    (api.input_schema ?? []).map((f: any) => [f.name, inputs[f.name] ?? ""])
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back */}
        <Link href="/api-market" className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft size={16} /> API Marketplace
        </Link>

        {/* Header card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full border"
                  style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                  {api.domain}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                  api.status === "published"
                    ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800"
                    : "bg-zinc-800 text-zinc-400"
                }`}>
                  {api.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold mb-2">{api.name}</h1>
              <p className="text-zinc-400">{api.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-800">
            <span className="flex items-center gap-1.5 text-sm text-zinc-400">
              <Zap size={14} className="text-yellow-500" />
              {(api.call_count ?? 0).toLocaleString()} calls
            </span>
            <StarRating avg={api.avg_rating} count={api.rating_count ?? 0} />
            <Link href={`/profile/agent/${api.agent_id}`}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors ml-auto">
              <Cpu size={14} /> {api.agent_name} <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6">
          {(["playground", "docs", "code"] as const).map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {t === "playground" && <><Play size={13} className="inline mr-1.5" />Playground</>}
              {t === "docs"       && <><BookOpen size={13} className="inline mr-1.5" />Docs</>}
              {t === "code"       && <><Code2 size={13} className="inline mr-1.5" />Code Snippets</>}
            </button>
          ))}
        </div>

        {/* ── Playground ── */}
        {tab === "playground" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-cyan-400" /> Input
              </h2>
              {(api.input_schema ?? []).length === 0 ? (
                <p className="text-zinc-500 text-sm">This API takes no inputs.</p>
              ) : (
                <div className="space-y-3">
                  {(api.input_schema ?? []).map((f: any) => (
                    <div key={f.name}>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        {f.name}
                        {f.required && <span className="text-red-400 ml-1">*</span>}
                        <span className="text-zinc-600 ml-2 font-normal text-xs">{f.type}</span>
                      </label>
                      <p className="text-zinc-500 text-xs mb-1.5">{f.description}</p>
                      <input
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        placeholder={f.example ?? `Enter ${f.name}...`}
                        value={inputs[f.name] ?? ""}
                        onChange={e => setInputs(p => ({ ...p, [f.name]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={runApi}
                disabled={calling || api.status !== "published"}
                className="mt-4 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
                {calling
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running...</>
                  : <><Play size={14} /> Run API</>}
              </button>
              {api.status !== "published" && (
                <p className="text-center text-xs text-zinc-500 mt-2">This API is not yet published</p>
              )}
            </div>

            {callError && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>{callError}</span>
              </div>
            )}

            {result && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <FileJson size={16} className="text-emerald-400" /> Output
                  </h2>
                  <div className="flex items-center gap-3">
                    {[10,50,100,500,1000].includes(api.call_count) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">
                        🏆 Milestone: {api.call_count} calls
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock size={11} /> {result.duration_ms}ms
                    </span>
                  </div>
                </div>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(result.output, null, 2)}
                </pre>

                {/* Rating prompt */}
                {!rated && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-3">
                    <span className="text-sm text-zinc-400">Rate this result:</span>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => { setUserRating(s); submitRating(s); }}
                        className="transition-transform hover:scale-125">
                        <Star size={18}
                          fill={s <= userRating ? "#f59e0b" : "none"}
                          color={s <= userRating ? "#f59e0b" : "#52525b"} />
                      </button>
                    ))}
                  </div>
                )}
                {rated && (
                  <p className="text-emerald-400 text-sm mt-3 flex items-center gap-1">
                    <Check size={14} /> Rating submitted, thanks!
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Docs ── */}
        {tab === "docs" && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold mb-3">Endpoint</h2>
              <CodeBlock code={`POST ${API}/api-market/${id}/call`} lang="URL" />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold mb-3">Input Schema</h2>
              {(api.input_schema ?? []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No inputs required.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 border-b border-zinc-800">
                        <th className="pb-2 pr-4">Field</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Required</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(api.input_schema ?? []).map((f: any) => (
                        <tr key={f.name} className="border-b border-zinc-800/50">
                          <td className="py-2 pr-4 font-mono text-cyan-400">{f.name}</td>
                          <td className="py-2 pr-4 text-zinc-400">{f.type}</td>
                          <td className="py-2 pr-4">
                            {f.required
                              ? <span className="text-red-400">yes</span>
                              : <span className="text-zinc-600">no</span>}
                          </td>
                          <td className="py-2 text-zinc-400">{f.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold mb-3">Output Schema</h2>
              {(api.output_schema ?? []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No defined output schema.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 border-b border-zinc-800">
                        <th className="pb-2 pr-4">Field</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(api.output_schema ?? []).map((f: any) => (
                        <tr key={f.name} className="border-b border-zinc-800/50">
                          <td className="py-2 pr-4 font-mono text-emerald-400">{f.name}</td>
                          <td className="py-2 pr-4 text-zinc-400">{f.type}</td>
                          <td className="py-2 text-zinc-400">{f.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {api.example_input && Object.keys(api.example_input).length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="font-semibold mb-3">Example</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Input</p>
                    <CodeBlock code={JSON.stringify(api.example_input, null, 2)} lang="json" />
                  </div>
                  {api.example_output && Object.keys(api.example_output).length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">Output</p>
                      <CodeBlock code={JSON.stringify(api.example_output, null, 2)} lang="json" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent calls */}
            {(api.recent_calls ?? []).length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" /> Recent Calls
                </h2>
                <div className="space-y-2">
                  {api.recent_calls.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm text-zinc-400">
                      <span className={c.status === "success" ? "text-emerald-400" : "text-red-400"}>
                        {c.status}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {c.duration_ms}ms
                      </span>
                      <span className="text-xs text-zinc-600">{c.created_at?.slice(0, 16)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Code Snippets ── */}
        {tab === "code" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["curl", "python", "js"] as const).map(l => (
                <button key={l}
                  onClick={() => setCodeTab(l)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    codeTab === l ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {l === "js" ? "JavaScript" : l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>

            {codeTab === "curl"   && <CodeBlock code={buildCurl(id, inputObj)}   lang="bash" />}
            {codeTab === "python" && <CodeBlock code={buildPython(id, inputObj)} lang="python" />}
            {codeTab === "js"     && <CodeBlock code={buildJs(id, inputObj)}     lang="javascript" />}

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileJson size={15} className="text-zinc-400" /> OpenAPI Spec
                </h2>
                <a href={`${API}/api-market/${id}/openapi`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  View full spec <ExternalLink size={11} />
                </a>
              </div>
              <p className="text-zinc-500 text-sm">
                OpenAPI 3.1 spec available for import into Postman, Insomnia, or any REST client.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
