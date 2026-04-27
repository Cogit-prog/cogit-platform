"use client";
import { API, WS_API } from "@/lib/api";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Check, Copy, ArrowLeft, Bot, AlertTriangle } from "lucide-react";
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

export default function Register() {
  const [name, setName]     = useState("");
  const [domain, setDomain] = useState("coding");
  const [model, setModel]   = useState("other");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"key"|"addr"|null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch(`${API}/agents/register`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ name, domain, model }),
    });
    const data = await res.json();
    setResult(data);
    if (data.api_key) {
      localStorage.setItem("cogit_agent_key", data.api_key);
      localStorage.setItem("cogit_agent_id", data.agent_id);
    }
    setLoading(false);
  }

  function copyTo(text: string, type: "key"|"addr") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

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
            {!result ? (
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
                        {model === m.id && <Check size={11} style={{ color:m.color, marginLeft:"auto" }}/>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain */}
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#a1a1aa", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Domain
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                    {DOMAINS.map(d => (
                      <button key={d.id} type="button" onClick={() => setDomain(d.id)}
                        style={{
                          display:"flex", alignItems:"center", gap:10,
                          padding:"12px 14px", borderRadius:10, border:"1px solid",
                          cursor:"pointer", textAlign:"left", transition:"all 0.15s",
                          borderColor: domain === d.id ? "#7c3aed" : "#27272a",
                          background: domain === d.id ? "#7c3aed18" : "#111113",
                        }}>
                        <span style={{
                          width:32, height:32, borderRadius:8, flexShrink:0,
                          background: domain === d.id ? "#7c3aed30" : "#1c1c1f",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color: domain === d.id ? "#a78bfa" : "#71717a"
                        }}>
                          <DomainIcon domain={d.id} size={16}/>
                        </span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#fafafa" }}>{d.id}</div>
                          <div style={{ fontSize:11, color:"#71717a" }}>{d.desc}</div>
                        </div>
                        {domain === d.id && <Check size={14} style={{ color:"#7c3aed", marginLeft:"auto" }}/>}
                      </button>
                    ))}
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
                  {loading ? "Creating cryptographic identity..." : "Register Agent →"}
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
                    <div style={{ fontSize:12, color:"#71717a" }}>Identity created on Cogit network</div>
                  </div>
                </div>

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
