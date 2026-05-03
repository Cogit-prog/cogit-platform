"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ApiMarketSidebar } from "../ApiMarketLayout";
import { API } from "@/lib/api";
import {
  Star, Copy, Check, Play, ChevronLeft, Clock,
  ExternalLink, Terminal, FileJson, Activity,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const DOMAIN_META: Record<string, { color: string; bg: string; label: string }> = {
  coding:   { color: "#4ade80", bg: "#052e16", label: "Coding"   },
  finance:  { color: "#818cf8", bg: "#1e1b4b", label: "Finance"  },
  legal:    { color: "#fbbf24", bg: "#1c1207", label: "Legal"    },
  medical:  { color: "#34d399", bg: "#022c22", label: "Medical"  },
  research: { color: "#c084fc", bg: "#2e1065", label: "Research" },
  creative: { color: "#fb7185", bg: "#4c0519", label: "Creative" },
  other:    { color: "#94a3b8", bg: "#0f172a", label: "Other"    },
};

const LANGS = ["cURL", "JavaScript", "Python", "Go", "PHP"] as const;
type Lang = typeof LANGS[number];

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildCode(lang: Lang, apiId: string, exInput: any): string {
  const url = `${API}/api-market/${apiId}/call`;
  const body = JSON.stringify({ input: exInput }, null, 2);
  switch (lang) {
    case "cURL":
      return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
    case "JavaScript":
      return `const res = await fetch("${url}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${body})\n});\nconst data = await res.json();\nconsole.log(data.output);`;
    case "Python":
      return `import requests\n\nres = requests.post(\n    "${url}",\n    json=${body.replace(/"([^"]+)":/g, '"$1":')}\n)\nprint(res.json()["output"])`;
    case "Go":
      return `resp, _ := http.Post("${url}",\n    "application/json",\n    strings.NewReader(\`${body}\`))\ndefer resp.Body.Close()`;
    case "PHP":
      return `$ch = curl_init("${url}");\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${body}));\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);\n$res = json_decode(curl_exec($ch), true);`;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }
  return (
    <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a5270", padding: "4px", display: "flex" }}>
      {ok ? <Check size={13} style={{ color: "#4ade80" }} /> : <Copy size={13} />}
    </button>
  );
}

function CodePane({ code }: { code: string }) {
  return (
    <div style={{ position: "relative", background: "#060810", borderRadius: "8px", border: "1px solid #1e2235", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "10px", right: "10px" }}><CopyBtn text={code} /></div>
      <pre style={{ padding: "16px 40px 16px 16px", fontSize: "12px", color: "#a5b4fc", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre", margin: 0, fontFamily: "monospace" }}>
        {code}
      </pre>
    </div>
  );
}

function SchemaTable({ fields, accentColor }: { fields: any[]; accentColor: string }) {
  if (!fields.length) return <p style={{ fontSize: "13px", color: "#4a5270" }}>필드 없음</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            {["필드", "타입", "필수", "설명"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#4a5270", fontWeight: 500, borderBottom: "1px solid #1e2235", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f: any, i: number) => (
            <tr key={i} style={{ borderBottom: "1px solid #141726" }}>
              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: accentColor, fontSize: "12px" }}>{f.name}</td>
              <td style={{ padding: "10px 12px", color: "#8892a4" }}>{f.type}</td>
              <td style={{ padding: "10px 12px" }}>
                {f.required
                  ? <span style={{ color: "#fb7185", fontSize: "11px" }}>yes</span>
                  : <span style={{ color: "#2d3250", fontSize: "11px" }}>no</span>}
              </td>
              <td style={{ padding: "10px 12px", color: "#8892a4" }}>{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ApiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [api,       setApi]       = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"overview"|"playground"|"docs"|"code">("overview");
  const [lang,      setLang]      = useState<Lang>("cURL");
  const [inputs,    setInputs]    = useState<Record<string, string>>({});
  const [result,    setResult]    = useState<any>(null);
  const [calling,   setCalling]   = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [rated,     setRated]     = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    fetch(`${API}/api-market/${id}`)
      .then(r => r.json())
      .then(d => {
        setApi(d);
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
    const inp: Record<string, any> = {};
    (api.input_schema ?? []).forEach((f: any) => {
      const raw = inputs[f.name] ?? "";
      inp[f.name] = f.type === "number" ? parseFloat(raw) || 0 : f.type === "boolean" ? raw === "true" : raw;
    });
    try {
      const res = await fetch(`${API}/api-market/${id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Call failed");
      setResult(data);
    } catch (e: any) {
      setCallError(e.message?.includes("rate limit") || e.message?.includes("429")
        ? "Rate limit reached. Wait a few minutes before calling again."
        : e.message);
    } finally { setCalling(false); }
  }

  async function submitRating(score: number) {
    const saved = localStorage.getItem("cogit_user");
    if (!saved) { alert("로그인이 필요합니다"); return; }
    const { token } = JSON.parse(saved);
    const res = await fetch(`${API}/api-market/${id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      const d = await res.json();
      setApi((a: any) => ({ ...a, avg_rating: d.avg_rating, rating_count: d.rating_count }));
      setRated(true);
    }
  }

  function copyEndpoint() {
    navigator.clipboard.writeText(`${API}/api-market/${id}/call`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
        <Navbar />
        <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
          <ApiMarketSidebar />
          <main style={{ flex: 1, padding: "32px 36px" }}>
            {[["40%","28px"],["60%","16px"],["100%","200px"]].map(([w,h],i) => (
              <div key={i} style={{ height: h, background: "#1e2235", borderRadius: "8px", width: w, marginBottom: "16px" }} />
            ))}
          </main>
        </div>
      </div>
    );
  }

  if (!api) {
    return (
      <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
        <Navbar />
        <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
          <ApiMarketSidebar />
          <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5270" }}>
            API를 찾을 수 없습니다.
          </main>
        </div>
      </div>
    );
  }

  const m = DOMAIN_META[api.domain] ?? DOMAIN_META.other;
  const exInput = api.example_input ?? {};
  const exOutput = api.example_output ?? {};
  const inputFields: any[]  = api.input_schema  ?? [];
  const outputFields: any[] = api.output_schema ?? [];
  const endpointUrl = `${API}/api-market/${id}/call`;
  const codeStr = buildCode(lang, id, exInput);

  const TABS = [
    { key: "overview",    label: "Overview"      },
    { key: "playground",  label: "Playground"    },
    { key: "docs",        label: "Documentation" },
    { key: "code",        label: "Code Snippets" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "white" }}>
      <Navbar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>

        {/* Left sidebar */}
        <ApiMarketSidebar />

        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* Breadcrumb */}
          <div style={{ padding: "16px 28px 0", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#4a5270" }}>
            <Link href="/api-market" style={{ color: "#4a5270", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              <ChevronLeft size={13} /> API Marketplace
            </Link>
            <span>/</span>
            <span style={{ color: m.color }}>{m.label}</span>
            <span>/</span>
            <span style={{ color: "#8892a4" }}>{api.name}</span>
          </div>

          {/* Header */}
          <div style={{ padding: "16px 28px 0" }}>
            <div style={{ borderRadius: "14px", border: "1px solid #1e2235", background: "#0f1117", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    {api.status === "published" && (
                      <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "9999px", background: "#052e16", color: "#4ade80", border: "1px solid #4ade8030", fontWeight: 600 }}>
                        Published
                      </span>
                    )}
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "9999px", background: m.bg, color: m.color, border: `1px solid ${m.color}30` }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "9999px", background: "#1e2235", color: "#4a5270", border: "1px solid #2d3250" }}>
                      v1.0.0
                    </span>
                  </div>
                  <h1 style={{ fontSize: "26px", fontWeight: 800, color: "white", marginBottom: "6px", letterSpacing: "-0.02em" }}>
                    {api.name}
                  </h1>
                  <p style={{ fontSize: "14px", color: "#8892a4", marginBottom: "14px", lineHeight: 1.5 }}>
                    {api.description}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "13px" }}>
                    {/* Stars */}
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={13}
                          fill={i <= Math.round(api.avg_rating ?? 0) ? "#f59e0b" : "none"}
                          color={i <= Math.round(api.avg_rating ?? 0) ? "#f59e0b" : "#2d3250"} />
                      ))}
                      {api.avg_rating
                        ? <span style={{ color: "#d4d4d8", marginLeft: "4px" }}>{api.avg_rating.toFixed(1)}</span>
                        : <span style={{ color: "#4a5270", marginLeft: "4px" }}>No ratings</span>}
                      {api.rating_count > 0 && (
                        <span style={{ color: "#4a5270" }}>({api.rating_count} ratings)</span>
                      )}
                    </span>
                    <span style={{ color: "#2d3250" }}>·</span>
                    <span style={{ color: "#4a5270" }}>{(api.call_count ?? 0).toLocaleString()} calls</span>
                    <span style={{ color: "#2d3250" }}>·</span>
                    <Link href={`/agents/${api.agent_id}`} style={{ color: "#818cf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                      @{api.agent_name} <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
                {/* Try Playground button */}
                <button
                  onClick={() => setTab("playground")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, background: "#6366f1", color: "white", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Play size={15} /> Try in Playground
                </button>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ padding: "0 28px", borderBottom: "1px solid #141726", marginTop: "4px" }}>
            <div style={{ display: "flex", gap: "0" }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                  padding: "14px 18px", fontSize: "13px", fontWeight: 500,
                  background: "none", border: "none", cursor: "pointer",
                  color: tab === t.key ? "white" : "#4a5270",
                  borderBottom: `2px solid ${tab === t.key ? "#6366f1" : "transparent"}`,
                  marginBottom: "-1px",
                  transition: "color 0.15s",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

            {/* ── Overview ── */}
            {tab === "overview" && (
              <div style={{ flex: 1, display: "flex", gap: "0", minWidth: 0 }}>
                {/* Main col */}
                <div style={{ flex: 1, minWidth: 0, padding: "24px 28px", overflowY: "auto" }}>

                  {/* Endpoint */}
                  <section style={{ marginBottom: "28px" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "12px" }}>Endpoint</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "8px", padding: "10px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "#052e16", color: "#4ade80", border: "1px solid #4ade8030" }}>
                        POST
                      </span>
                      <code style={{ flex: 1, fontSize: "12px", color: "#a5b4fc", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {endpointUrl}
                      </code>
                      <button onClick={copyEndpoint} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a5270", display: "flex" }}>
                        {copied ? <Check size={13} style={{ color: "#4ade80" }} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </section>

                  {/* Description */}
                  <section style={{ marginBottom: "28px" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "10px" }}>Description</h2>
                    <p style={{ fontSize: "14px", color: "#8892a4", lineHeight: 1.8 }}>{api.description}</p>
                  </section>

                  {/* Request body */}
                  {inputFields.length > 0 && (
                    <section style={{ marginBottom: "28px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>Request Body</h2>
                        <span style={{ fontSize: "11px", color: "#4a5270", fontFamily: "monospace" }}>application/json</span>
                      </div>
                      <div style={{ borderRadius: "8px", border: "1px solid #1e2235", overflow: "hidden" }}>
                        <SchemaTable fields={inputFields} accentColor="#38bdf8" />
                      </div>
                      {/* Example body */}
                      {Object.keys(exInput).length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                            <p style={{ fontSize: "12px", color: "#4a5270" }}>Body 예시</p>
                            <CopyBtn text={JSON.stringify({ input: exInput }, null, 2)} />
                          </div>
                          <CodePane code={JSON.stringify({ input: exInput }, null, 2)} />
                        </div>
                      )}
                    </section>
                  )}

                  {/* Response */}
                  {outputFields.length > 0 && (
                    <section style={{ marginBottom: "28px" }}>
                      <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "10px" }}>Response</h2>
                      <div style={{ borderRadius: "8px", border: "1px solid #1e2235", overflow: "hidden" }}>
                        <SchemaTable fields={outputFields} accentColor="#4ade80" />
                      </div>
                      {Object.keys(exOutput).length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "6px" }}>응답 예시 (200 OK)</p>
                          <CodePane code={JSON.stringify({ output: exOutput }, null, 2)} />
                        </div>
                      )}
                    </section>
                  )}
                </div>

                {/* Right code panel */}
                <div style={{ width: "340px", flexShrink: 0, borderLeft: "1px solid #141726", background: "#090c17", padding: "20px", overflowY: "auto" }}>

                  {/* Language tabs */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, color: "#2d3250", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>LANGUAGE</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {LANGS.map(l => (
                        <button key={l} onClick={() => setLang(l)} style={{
                          padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                          background: lang === l ? "#6366f1" : "#1a1d2e",
                          color: lang === l ? "white" : "#8892a4",
                          border: `1px solid ${lang === l ? "#6366f1" : "#2d3250"}`,
                          cursor: "pointer",
                        }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Code example */}
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "#8892a4" }}>{lang} 예시</p>
                      <CopyBtn text={codeStr} />
                    </div>
                    <CodePane code={codeStr} />
                  </div>

                  {/* Response preview */}
                  {Object.keys(exOutput).length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#8892a4" }}>Response</p>
                        <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", background: "#052e16", color: "#4ade80", border: "1px solid #4ade8030", fontWeight: 600 }}>
                          200 OK
                        </span>
                      </div>
                      <CodePane code={JSON.stringify({ output: exOutput }, null, 2)} />
                    </div>
                  )}

                  {/* Meta info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[
                      { label: "Authentication",  val: "None (Free)"     },
                      { label: "Rate Limit",       val: "20 req / 10min"  },
                      { label: "Avg Response",     val: "~400ms"          },
                      { label: "Model",            val: "LLaMA 4 Scout"   },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", paddingBottom: "10px", borderBottom: "1px solid #141726" }}>
                        <span style={{ color: "#4a5270" }}>{row.label}</span>
                        <span style={{ color: "#d4d4d8", fontWeight: 500 }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Playground ── */}
            {tab === "playground" && (
              <div style={{ flex: 1, display: "flex", gap: "0", minWidth: 0 }}>
                {/* Input panel */}
                <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Terminal size={15} style={{ color: "#38bdf8" }} /> 입력
                  </h2>
                  {inputFields.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#4a5270" }}>이 API는 입력값이 필요 없습니다.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "560px" }}>
                      {inputFields.map((f: any) => (
                        <div key={f.name}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#d4d4d8", marginBottom: "4px" }}>
                            {f.name}
                            {f.required && <span style={{ color: "#fb7185", marginLeft: "4px" }}>*</span>}
                            <span style={{ color: "#4a5270", marginLeft: "8px", fontWeight: 400, fontSize: "11px" }}>{f.type}</span>
                          </label>
                          <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "6px" }}>{f.description}</p>
                          <input
                            style={{ width: "100%", background: "#0a0c14", border: "1px solid #1e2235", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#d4d4d8", outline: "none", boxSizing: "border-box" }}
                            placeholder={`예: ${Object.values(exInput)[inputFields.indexOf(f)] ?? f.name}`}
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
                    style={{
                      marginTop: "20px", display: "flex", alignItems: "center", gap: "8px",
                      padding: "12px 28px", borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                      background: calling ? "#1e2235" : "#6366f1", color: calling ? "#4a5270" : "white",
                      border: "none", cursor: calling ? "not-allowed" : "pointer",
                    }}>
                    {calling
                      ? <><span style={{ width: "14px", height: "14px", border: "2px solid #4a5270", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> 실행 중...</>
                      : <><Play size={14} /> Run API</>}
                  </button>
                  {api.status !== "published" && (
                    <p style={{ fontSize: "12px", color: "#4a5270", marginTop: "8px" }}>이 API는 아직 공개되지 않았습니다.</p>
                  )}

                  {callError && (
                    <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "8px", background: "#4c0519", border: "1px solid #f43f5e40", fontSize: "13px", color: "#fb7185" }}>
                      ⚠ {callError}
                    </div>
                  )}
                </div>

                {/* Output panel */}
                <div style={{ width: "400px", flexShrink: 0, borderLeft: "1px solid #141726", background: "#090c17", padding: "24px", overflowY: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <FileJson size={15} style={{ color: "#4ade80" }} />
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>출력</h2>
                    {result && (
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", background: "#052e16", color: "#4ade80", border: "1px solid #4ade8030", marginLeft: "auto", fontWeight: 600 }}>
                        200 OK
                      </span>
                    )}
                    {result?.duration_ms && (
                      <span style={{ fontSize: "11px", color: "#4a5270", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={10} /> {result.duration_ms}ms
                      </span>
                    )}
                  </div>

                  {!result && !callError && (
                    <div style={{ padding: "48px 0", textAlign: "center" }}>
                      <Play size={28} style={{ color: "#1e2235", margin: "0 auto 12px" }} />
                      <p style={{ fontSize: "13px", color: "#4a5270" }}>Run API를 눌러 결과를 확인하세요</p>
                    </div>
                  )}

                  {result && (
                    <>
                      <CodePane code={JSON.stringify(result.output, null, 2)} />
                      {/* Rating */}
                      {!rated ? (
                        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #141726" }}>
                          <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "10px" }}>이 결과를 평가해 주세요</p>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {[1,2,3,4,5].map(s => (
                              <button key={s} onClick={() => { setUserRating(s); submitRating(s); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}>
                                <Star size={20}
                                  fill={s <= userRating ? "#f59e0b" : "none"}
                                  color={s <= userRating ? "#f59e0b" : "#2d3250"} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ marginTop: "16px", fontSize: "12px", color: "#4ade80", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Check size={13} /> 평가가 제출됐어요, 감사합니다!
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Documentation ── */}
            {tab === "docs" && (
              <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>

                <section style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "12px" }}>입력 스키마</h2>
                  <div style={{ borderRadius: "10px", border: "1px solid #1e2235", overflow: "hidden" }}>
                    <SchemaTable fields={inputFields} accentColor="#38bdf8" />
                  </div>
                </section>

                <section style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "12px" }}>출력 스키마</h2>
                  <div style={{ borderRadius: "10px", border: "1px solid #1e2235", overflow: "hidden" }}>
                    <SchemaTable fields={outputFields} accentColor="#4ade80" />
                  </div>
                </section>

                {(Object.keys(exInput).length > 0 || Object.keys(exOutput).length > 0) && (
                  <section style={{ marginBottom: "32px" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "12px" }}>예시</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                      {Object.keys(exInput).length > 0 && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "8px" }}>입력 예시</p>
                          <CodePane code={JSON.stringify({ input: exInput }, null, 2)} />
                        </div>
                      )}
                      {Object.keys(exOutput).length > 0 && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#4a5270", marginBottom: "8px" }}>출력 예시</p>
                          <CodePane code={JSON.stringify({ output: exOutput }, null, 2)} />
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {(api.recent_calls ?? []).length > 0 && (
                  <section>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Activity size={14} style={{ color: "#4a5270" }} /> 최근 호출
                    </h2>
                    <div style={{ borderRadius: "10px", border: "1px solid #1e2235", overflow: "hidden" }}>
                      {api.recent_calls.slice(0, 5).map((c: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < 4 ? "1px solid #141726" : "none", fontSize: "12px" }}>
                          <span style={{ color: c.status === "success" ? "#4ade80" : "#fb7185" }}>{c.status}</span>
                          <span style={{ color: "#4a5270", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={10} /> {c.duration_ms}ms
                          </span>
                          <span style={{ color: "#2d3250" }}>{c.created_at?.slice(0, 16)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Code Snippets ── */}
            {tab === "code" && (
              <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {LANGS.map(l => (
                    <button key={l} onClick={() => setLang(l)} style={{
                      padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                      background: lang === l ? "#6366f1" : "#1a1d2e",
                      color: lang === l ? "white" : "#8892a4",
                      border: `1px solid ${lang === l ? "#6366f1" : "#2d3250"}`,
                      cursor: "pointer",
                    }}>
                      {l}
                    </button>
                  ))}
                </div>

                <div style={{ maxWidth: "700px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <p style={{ fontSize: "12px", color: "#4a5270" }}>{lang} 호출 예시</p>
                    <CopyBtn text={codeStr} />
                  </div>
                  <CodePane code={codeStr} />
                </div>

                <div style={{ marginTop: "28px", maxWidth: "700px", borderRadius: "10px", border: "1px solid #1e2235", background: "#0f1117", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FileJson size={14} style={{ color: "#4a5270" }} /> OpenAPI Spec
                    </p>
                    <a href={`${API}/api-market/${id}/openapi`} target="_blank" rel="noreferrer"
                      style={{ fontSize: "12px", color: "#818cf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                      전체 스펙 보기 <ExternalLink size={11} />
                    </a>
                  </div>
                  <p style={{ fontSize: "13px", color: "#4a5270" }}>
                    OpenAPI 3.1 스펙을 Postman, Insomnia 등에 바로 임포트할 수 있습니다.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
