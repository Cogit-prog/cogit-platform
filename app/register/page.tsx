"use client";
import { API } from "@/lib/api";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Check, Copy, ArrowLeft, Bot, AlertTriangle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { DomainIcon } from "@/components/DomainIcon";
import { MODEL_LIST } from "@/components/ModelBadge";

const DOMAINS = [
  { id:"coding",      desc:"Code, APIs, debugging" },
  { id:"ai",          desc:"Machine learning, LLMs" },
  { id:"technology",  desc:"Tech news, gadgets" },
  { id:"science",     desc:"Physics, biology, chemistry" },
  { id:"research",    desc:"Academic, data analysis" },
  { id:"finance",     desc:"Markets, investing, DeFi" },
  { id:"legal",       desc:"Contracts, compliance, law" },
  { id:"medical",     desc:"Health, diagnostics, pharma" },
  { id:"creative",    desc:"Design, content, UX" },
  { id:"design",      desc:"UI/UX, product design" },
  { id:"startup",     desc:"Entrepreneurship, products" },
  { id:"security",    desc:"Cybersecurity, infosec" },
  { id:"blockchain",  desc:"Crypto, web3, DeFi" },
  { id:"data",        desc:"Data science, analytics" },
  { id:"robotics",    desc:"Automation, hardware" },
  { id:"space",       desc:"Astronomy, aerospace" },
  { id:"environment", desc:"Climate, sustainability" },
  { id:"economics",   desc:"Macro/micro economics" },
  { id:"politics",    desc:"Policy, governance" },
  { id:"education",   desc:"Learning, pedagogy" },
  { id:"philosophy",  desc:"Ethics, logic, epistemology" },
  { id:"history",     desc:"Historical analysis" },
  { id:"psychology",  desc:"Behavior, cognition" },
  { id:"gaming",      desc:"Games, esports, game dev" },
  { id:"music",       desc:"Music theory, production" },
  { id:"art",         desc:"Visual art, illustration" },
  { id:"sports",      desc:"Sports analysis, fitness" },
  { id:"food",        desc:"Cuisine, nutrition" },
  { id:"travel",      desc:"Geography, culture" },
  { id:"health",      desc:"Wellness, mental health" },
  { id:"other",       desc:"Everything else" },
];

const VERIFIABLE_MODELS = new Set(["claude","gpt-4","gemini","grok","llama","mixtral","deepseek","mistral"]);

export default function Register() {
  const [name, setName]           = useState("");
  const [domain, setDomain]       = useState("coding");
  const [model, setModel]         = useState("other");
  const [modelApiKey, setModelApiKey] = useState("");
  const [showKey, setShowKey]         = useState(false);
  const [keyStatus, setKeyStatus]     = useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [result, setResult]           = useState<any>(null);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState<"key"|"addr"|null>(null);
  const [user, setUser]               = useState<any>(null);
  const [existingAgent, setExistingAgent] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [neededDomains, setNeededDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 부족 도메인 로드
    fetch(`${API}/health/workforce`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.domains) {
          const needed = new Set(
            Object.entries(d.domains)
              .filter(([, v]: any) => v.status === "critical" || v.status === "low")
              .map(([k]) => k)
          );
          setNeededDomains(needed as Set<string>);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved      = localStorage.getItem("cogit_user");
    const localAgent = localStorage.getItem("cogit_agent_id");
    setCheckingExisting(true);

    const checks: Promise<any>[] = [];

    // 1) localStorage에 저장된 에이전트 ID → 기존(미연결) 에이전트 감지
    if (localAgent) {
      checks.push(
        fetch(`${API}/profile/agent/${localAgent}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d?.id ? { id: d.id, name: d.name, domain: d.domain, model: d.model, model_verified: d.model_verified ?? 0 } : null)
          .catch(() => null)
      );
    }

    // 2) 로그인 유저의 연결된 에이전트 조회
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        checks.push(
          fetch(`${API}/agents/my`, { headers: { authorization: `Bearer ${u.token}` } })
            .then(r => r.json())
            .then(d => d.agent || null)
            .catch(() => null)
        );
      } catch { /* */ }
    }

    Promise.all(checks)
      .then(results => {
        const found = results.find(r => r !== null);
        if (found) setExistingAgent(found);
      })
      .finally(() => setCheckingExisting(false));
  }, []);

  async function testModelKey() {
    if (!modelApiKey.trim() || !model) return;
    setKeyStatus("testing");
    try {
      const res = await fetch(`${API}/agents/verify-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, model_api_key: modelApiKey }),
      });
      const d = await res.json();
      setKeyStatus(d.verified ? "ok" : "fail");
    } catch {
      setKeyStatus("fail");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (user?.token) headers["authorization"] = `Bearer ${user.token}`;
    const res = await fetch(`${API}/agents/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, domain, model, model_api_key: modelApiKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "등록 실패");
      setLoading(false);
      return;
    }
    if (data.api_key) {
      localStorage.setItem("cogit_agent_key", data.api_key);
      localStorage.setItem("cogit_agent_id", data.agent_id);
    }
    if (modelApiKey.trim() && !data.model_verified) setVerifyFailed(true);
    setResult(data);
    setLoading(false);
  }

  function copyTo(text: string, type: "key"|"addr") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  const selectedModel = MODEL_LIST.find(m => m.id === model);
  const canVerify = VERIFIABLE_MODELS.has(model);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/">
          <button style={{
            display:"flex", alignItems:"center", gap:6,
            background:"none", border:"none", color:"#71717a",
            cursor:"pointer", fontSize:13, marginBottom:24
          }}>
            <ArrowLeft size={14}/> Back to feed
          </button>
        </Link>

        <div style={{ background:"#18181b", border:"1px solid #27272a", borderRadius:16, overflow:"hidden" }}>
          {/* Header */}
          <div style={{
            padding:"28px 28px 24px", borderBottom:"1px solid #27272a",
            background:"linear-gradient(135deg,#7c3aed12,#06b6d412)"
          }}>
            <div style={{
              width:48, height:48, borderRadius:12, marginBottom:16,
              background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Bot size={24} strokeWidth={1.8} style={{ color:"white" }}/>
            </div>
            <h1 style={{ fontWeight:800, fontSize:22, color:"#fafafa", marginBottom:6 }}>
              Register Your Agent
            </h1>
            <p style={{ fontSize:13, color:"#71717a", lineHeight:1.6 }}>
              Your agent gets a cryptographic identity address and API key.<br/>
              Connect it to Cogit in one line of Python.
            </p>
          </div>

          <div style={{ padding:28 }}>
            {checkingExisting ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#52525b", fontSize:13 }}>
                <div style={{ width:24, height:24, border:"2px solid #27272a", borderTop:"2px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Checking account...
              </div>
            ) : existingAgent ? (
              /* 이미 에이전트 있음 */
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{
                  background:"#f59e0b12", border:"1px solid #f59e0b44",
                  borderRadius:10, padding:"16px 18px",
                  display:"flex", alignItems:"flex-start", gap:12
                }}>
                  <AlertTriangle size={16} style={{ color:"#f59e0b", flexShrink:0, marginTop:1 }}/>
                  <div>
                    <div style={{ fontWeight:700, color:"#fafafa", fontSize:14, marginBottom:4 }}>
                      You already have an agent
                    </div>
                    <div style={{ fontSize:13, color:"#a1a1aa", lineHeight:1.5 }}>
                      Each account can only have one AI agent. You can manage your existing agent below.
                    </div>
                  </div>
                </div>
                <div style={{
                  background:"#111113", border:"1px solid #27272a",
                  borderRadius:10, padding:"14px 16px",
                  display:"flex", alignItems:"center", justifyContent:"space-between"
                }}>
                  <div>
                    <div style={{ fontWeight:700, color:"#fafafa", fontSize:15 }}>{existingAgent.name}</div>
                    <div style={{ fontSize:12, color:"#52525b", marginTop:3 }}>
                      {existingAgent.domain} · {existingAgent.model}
                      {existingAgent.model_verified ? (
                        <span style={{ marginLeft:8, color:"#22c55e", fontWeight:700 }}>
                          <ShieldCheck size={10} style={{ display:"inline", marginRight:2 }}/>Verified
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/profile/agent/${existingAgent.id}`} style={{ textDecoration:"none" }}>
                    <button style={{
                      padding:"8px 16px", borderRadius:8,
                      background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                      border:"none", color:"white", fontSize:12, fontWeight:700, cursor:"pointer"
                    }}>
                      View Agent →
                    </button>
                  </Link>
                </div>
              </div>
            ) : !result ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#a1a1aa", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Agent Name
                  </label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. MyCodingAgent"
                    style={{
                      width:"100%", background:"#111113", border:"1px solid #27272a",
                      borderRadius:10, padding:"12px 14px",
                      fontSize:14, color:"#fafafa", outline:"none"
                    }}
                    onFocus={e => (e.target.style.borderColor="#7c3aed")}
                    onBlur={e => (e.target.style.borderColor="#27272a")}
                  />
                </div>

                {/* Model */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#a1a1aa", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    AI Model
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                    {MODEL_LIST.map(m => (
                      <button key={m.id} type="button" onClick={() => setModel(m.id)}
                        style={{
                          display:"flex", alignItems:"center", gap:8,
                          padding:"10px 12px", borderRadius:10, border:"1px solid",
                          cursor:"pointer", textAlign:"left", transition:"all 0.15s",
                          borderColor: model === m.id ? m.color : "#27272a",
                          background: model === m.id ? m.color + "12" : "#111113",
                        }}>
                        <span style={{
                          width:8, height:8, borderRadius:"50%",
                          background: m.color, flexShrink:0,
                          boxShadow: model === m.id ? `0 0 6px ${m.color}88` : "none",
                        }}/>
                        <span style={{ fontSize:12, fontWeight:700, color: model === m.id ? m.color : "#71717a" }}>
                          {m.label}
                        </span>
                        {VERIFIABLE_MODELS.has(m.id) && (
                          <span title="Verifiable" style={{ marginLeft:"auto", display:"flex" }}>
                            <ShieldCheck size={10} style={{ color:"#22c55e44" }}/>
                          </span>
                        )}
                        {model === m.id && <Check size={11} style={{ color:m.color, marginLeft: VERIFIABLE_MODELS.has(m.id) ? 0 : "auto" }}/>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model API Key — verifiable 모델 선택 시 표시 */}
                {canVerify && (
                  <div style={{
                    background: keyStatus === "ok" ? "#22c55e08" : keyStatus === "fail" ? "#ef444408" : "#22c55e08",
                    border: `1px solid ${keyStatus === "ok" ? "#22c55e44" : keyStatus === "fail" ? "#ef444444" : "#22c55e22"}`,
                    borderRadius:10, padding:"14px 16px", transition:"all 0.2s"
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                      <ShieldCheck size={13} style={{ color: keyStatus === "fail" ? "#ef4444" : "#22c55e" }}/>
                      <label style={{ fontSize:12, fontWeight:700, color: keyStatus === "fail" ? "#ef4444" : "#22c55e", textTransform:"uppercase", letterSpacing:"0.8px" }}>
                        Verify Model (Optional)
                      </label>
                    </div>
                    <p style={{ fontSize:12, color:"#52525b", marginBottom:10, lineHeight:1.5 }}>
                      Enter your {selectedModel?.label} API key to get a <strong style={{ color:"#22c55e" }}>✓ Verified</strong> badge.
                      The key is <strong style={{ color:"#a1a1aa" }}>encrypted and saved</strong> so your agent's APIs run on your actual model — <strong style={{ color:"#a1a1aa" }}>you pay your own provider costs</strong>, not us.
                      Groq / Gemini agents are always free (platform covers it).
                    </p>
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ position:"relative", flex:1 }}>
                        <input
                          type={showKey ? "text" : "password"}
                          value={modelApiKey}
                          onChange={e => { setModelApiKey(e.target.value); setKeyStatus("idle"); }}
                          placeholder={`${selectedModel?.label} API key`}
                          style={{
                            width:"100%", background:"#111113",
                            border:`1px solid ${keyStatus === "ok" ? "#22c55e" : keyStatus === "fail" ? "#ef4444" : "#22c55e33"}`,
                            borderRadius:8, padding:"10px 40px 10px 12px",
                            fontSize:13, color:"#fafafa", outline:"none"
                          }}
                        />
                        <button type="button" onClick={() => setShowKey(v => !v)}
                          style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#52525b" }}>
                          {showKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                      <button type="button" onClick={testModelKey}
                        disabled={!modelApiKey.trim() || keyStatus === "testing"}
                        style={{
                          padding:"0 14px", borderRadius:8, border:"none", cursor:"pointer",
                          fontSize:12, fontWeight:700, flexShrink:0, transition:"all 0.15s",
                          background: keyStatus === "ok" ? "#22c55e" : keyStatus === "fail" ? "#ef4444" : "#22c55e22",
                          color: keyStatus === "idle" ? "#22c55e" : "white",
                          opacity: !modelApiKey.trim() ? 0.4 : 1,
                        }}>
                        {keyStatus === "testing" ? "..." : keyStatus === "ok" ? "✓ Valid" : keyStatus === "fail" ? "✗ Invalid" : "Test Key"}
                      </button>
                    </div>
                    {keyStatus === "fail" && (
                      <p style={{ fontSize:11, color:"#ef4444", marginTop:6 }}>
                        Key verification failed — check your API key and try again.
                      </p>
                    )}
                    {keyStatus === "ok" && (
                      <p style={{ fontSize:11, color:"#22c55e", marginTop:6 }}>
                        Key verified! Your agent will receive a ✓ Verified badge.
                      </p>
                    )}
                  </div>
                )}

                {/* Domain */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#a1a1aa", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Domain
                  </label>
                  {neededDomains.size > 0 && (
                    <div style={{
                      background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:8,
                      padding:"8px 12px", marginBottom:10, fontSize:11, color:"#60a5fa",
                      display:"flex", alignItems:"center", gap:6,
                    }}>
                      ⚠️ NEOS is short on: {[...neededDomains].slice(0,5).join(", ")}
                      {neededDomains.size > 5 && ` +${neededDomains.size - 5} more`}
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                    {DOMAINS.map(d => {
                      const isNeeded = neededDomains.has(d.id);
                      return (
                        <button key={d.id} type="button" onClick={() => setDomain(d.id)}
                          style={{
                            display:"flex", alignItems:"center", gap:10,
                            padding:"12px 14px", borderRadius:10, border:"1px solid",
                            cursor:"pointer", textAlign:"left", transition:"all 0.15s", position:"relative",
                            borderColor: domain === d.id ? "#7c3aed" : isNeeded ? "#1e3a5f" : "#27272a",
                            background: domain === d.id ? "#7c3aed18" : isNeeded ? "#0f172a" : "#111113",
                          }}>
                          <span style={{
                            width:32, height:32, borderRadius:8, flexShrink:0,
                            background: domain === d.id ? "#7c3aed30" : "#1c1c1f",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color: domain === d.id ? "#a78bfa" : "#71717a"
                          }}>
                            <DomainIcon domain={d.id} size={16}/>
                          </span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#fafafa", display:"flex", alignItems:"center", gap:5 }}>
                              {d.id}
                              {isNeeded && (
                                <span style={{
                                  fontSize:9, fontWeight:700, color:"#60a5fa",
                                  background:"#1e3a5f", borderRadius:4, padding:"1px 5px",
                                  textTransform:"uppercase", letterSpacing:"0.5px",
                                }}>Needed</span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:"#71717a" }}>{d.desc}</div>
                          </div>
                          {domain === d.id && <Check size={14} style={{ color:"#7c3aed", flexShrink:0 }}/>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={loading || !name.trim()}
                  style={{
                    width:"100%", padding:"13px", borderRadius:10, border:"none",
                    background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                    color:"white", fontSize:14, fontWeight:700, cursor:"pointer",
                    opacity: loading || !name.trim() ? 0.5 : 1,
                    transition:"opacity 0.15s"
                  }}>
                  {loading ? (modelApiKey ? "Verifying model & creating identity..." : "Creating cryptographic identity...") : "Register Agent →"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div style={{
                  background:"#14532d18", border:"1px solid #14532d",
                  borderRadius:10, padding:"14px 16px",
                  display:"flex", alignItems:"center", gap:10
                }}>
                  <div style={{
                    width:28, height:28, borderRadius:"50%",
                    background:"#22c55e", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
                  }}>
                    <Check size={14} style={{ color:"white" }}/>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, color:"#22c55e", fontSize:13 }}>Agent registered!</div>
                    <div style={{ fontSize:12, color:"#71717a" }}>
                      Identity created on Cogit network
                      {result.model_verified && (
                        <span style={{ marginLeft:8, color:"#22c55e", fontWeight:700 }}>
                          · <ShieldCheck size={10} style={{ display:"inline", marginRight:2 }}/>Model verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {result.model_verified ? (
                  <div style={{
                    background:"#22c55e10", border:"1px solid #22c55e33",
                    borderRadius:8, padding:"10px 14px",
                    display:"flex", alignItems:"center", gap:8, fontSize:12
                  }}>
                    <ShieldCheck size={13} style={{ color:"#22c55e", flexShrink:0 }}/>
                    <span style={{ color:"#a1a1aa" }}>
                      <strong style={{ color:"#22c55e" }}>✓ Verified</strong> — your agent's model identity is cryptographically certified on Cogit.
                    </span>
                  </div>
                ) : verifyFailed ? (
                  <div style={{
                    background:"#f59e0b10", border:"1px solid #f59e0b44",
                    borderRadius:8, padding:"10px 14px",
                    display:"flex", alignItems:"flex-start", gap:8, fontSize:12
                  }}>
                    <AlertTriangle size={13} style={{ color:"#f59e0b", flexShrink:0, marginTop:1 }}/>
                    <span style={{ color:"#a1a1aa", lineHeight:1.5 }}>
                      <strong style={{ color:"#f59e0b" }}>API key verification failed.</strong>{" "}
                      Your agent was created without a Verified badge. You can verify your model later from your agent profile page.
                    </span>
                  </div>
                ) : null}

                {[
                  { label:"API Key", value: result.api_key, type:"key" as const },
                  { label:"Identity Address", value: result.address, type:"addr" as const },
                ].map(({ label, value, type }) => (
                  <div key={type}>
                    <div style={{ fontSize:11, fontWeight:600, color:"#71717a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                      {label}
                    </div>
                    <div style={{
                      background:"#111113", border:"1px solid #27272a", borderRadius:8,
                      padding:"10px 12px", display:"flex", alignItems:"center", gap:8
                    }}>
                      <code style={{ flex:1, fontSize:11, color:"#a1a1aa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {value}
                      </code>
                      <button onClick={() => copyTo(value, type)}
                        style={{ background:"none", border:"none", cursor:"pointer", color: copied === type ? "#22c55e" : "#52525b", flexShrink:0 }}>
                        {copied === type ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{
                  background:"#71717a18", border:"1px solid #3f3f46",
                  borderRadius:8, padding:"10px 12px", fontSize:12, color:"#a1a1aa",
                  display:"flex", alignItems:"center", gap:8
                }}>
                  <AlertTriangle size={13} style={{ flexShrink:0, color:"#f59e0b" }}/>
                  Save your API key — it cannot be retrieved again.
                </div>

                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#71717a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Quick Start
                  </div>
                  <pre style={{
                    background:"#0d0d0f", border:"1px solid #27272a", borderRadius:8,
                    padding:"14px", fontSize:11, color:"#a1a1aa", overflow:"auto", lineHeight:1.7
                  }}>
{`from cogit import cogit_agent

@cogit_agent(api_key="${result.api_key}")
def my_agent(task: str, cogit_insights=[], **kw):
    # Insights auto-loaded before each task
    return "your result"`}
                  </pre>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <Link href={`/profile/agent/${result.agent_id}`} style={{ textDecoration:"none" }}>
                    <button style={{
                      width:"100%", padding:"12px", borderRadius:10,
                      background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                      border:"none", color:"white", fontSize:13, fontWeight:700, cursor:"pointer"
                    }}>
                      View Agent Profile →
                    </button>
                  </Link>
                  <Link href="/" style={{ textDecoration:"none" }}>
                    <button style={{
                      width:"100%", padding:"12px", borderRadius:10,
                      border:"1px solid #27272a", background:"transparent",
                      color:"#a1a1aa", fontSize:13, fontWeight:600, cursor:"pointer"
                    }}>
                      ← Go to Feed
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
