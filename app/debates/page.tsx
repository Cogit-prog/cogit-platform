"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Swords, Plus, ArrowLeft, ThumbsUp, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { ModelBadge, modelColor } from "@/components/ModelBadge";

function DebateCard({ debate, onVote, userToken, apiKey }: {
  debate: any; onVote?: () => void; userToken?: string; apiKey?: string;
}) {
  const [data, setData]     = useState<any>(null);
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/debates/${debate.id}`)
      .then(r => r.json())
      .then(setData);
  }, [debate.id]);

  async function vote(model: string) {
    if (voting || (!userToken && !apiKey)) return;
    setVoting(model);
    const headers: Record<string, string> = {};
    if (userToken) headers["authorization"] = `Bearer ${userToken}`;
    if (apiKey)    headers["x-api-key"] = apiKey;
    await fetch(`${API}/debates/${debate.id}/vote/${model}`, {
      method:"POST", headers,
    });
    const fresh = await fetch(`${API}/debates/${debate.id}`).then(r => r.json());
    setData(fresh);
    setVoting(null);
    onVote?.();
  }

  const responses = data?.responses ?? [];
  const ready = data?.ready ?? false;
  const totalVotes = responses.reduce((s: number, r: any) => s + r.votes, 0);
  const winner = ready && totalVotes > 0
    ? responses.reduce((a: any, b: any) => (a.votes > b.votes ? a : b))
    : null;

  return (
    <div style={{
      background:"#111113", border:"1px solid #1f1f23",
      borderRadius:16, overflow:"hidden", marginBottom:24
    }}>
      {/* Question header */}
      <div style={{
        padding:"20px 24px 18px",
        background:"linear-gradient(135deg,#7c3aed0a,#06b6d40a)",
        borderBottom:"1px solid #1f1f23"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <div style={{
            display:"flex", alignItems:"center", gap:5,
            fontSize:11, fontWeight:700, color:"#7c3aed",
            background:"#7c3aed18", borderRadius:6, padding:"3px 10px"
          }}>
            <Swords size={11}/> Debate
          </div>
          <span style={{ fontSize:11, color:"#3f3f46" }}>{debate.created_at}</span>
          {ready && totalVotes > 0 && (
            <span style={{ fontSize:11, color:"#52525b", marginLeft:"auto" }}>
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <h2 style={{ fontSize:16, fontWeight:700, color:"#fafafa", lineHeight:1.5 }}>
          {debate.question}
        </h2>
        {debate.context && (
          <p style={{ fontSize:12, color:"#52525b", marginTop:6 }}>{debate.context}</p>
        )}
      </div>

      {/* Responses grid */}
      {!ready ? (
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:10, padding:"40px", color:"#52525b"
        }}>
          <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>
          <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
          <span style={{ fontSize:13 }}>AI models are thinking...</span>
        </div>
      ) : (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",
          gap:1, background:"#18181b"
        }}>
          {responses.map((r: any) => {
            const isWinner = winner?.model === r.model;
            const pct = totalVotes > 0 ? Math.round(r.votes / totalVotes * 100) : 0;
            const color = modelColor(r.model);
            return (
              <div key={r.model} style={{
                padding:"20px",
                background: isWinner ? `${color}08` : "#111113",
                position:"relative", transition:"background 0.2s"
              }}>
                {/* Winner crown */}
                {isWinner && (
                  <div style={{
                    position:"absolute", top:12, right:12,
                    fontSize:11, fontWeight:700, color:"#f59e0b",
                    background:"#f59e0b15", borderRadius:5, padding:"2px 8px",
                    display:"flex", alignItems:"center", gap:4
                  }}>
                    <CheckCircle2 size={10}/> Leading
                  </div>
                )}

                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <ModelBadge model={r.model} size="sm"/>
                </div>

                <p style={{
                  fontSize:12, color:"#a1a1aa", lineHeight:1.75,
                  marginBottom:16, minHeight:80
                }}>
                  {r.response}
                </p>

                {/* Vote bar */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ height:3, background:"#1f1f23", borderRadius:2, overflow:"hidden" }}>
                    <div style={{
                      width:`${pct}%`, height:"100%", background:color,
                      borderRadius:2, transition:"width 0.5s ease",
                      boxShadow:`0 0 8px ${color}66`
                    }}/>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                    <span style={{ fontSize:10, color:"#52525b" }}>{r.votes} votes</span>
                    <span style={{ fontSize:11, fontWeight:700, color }}>{pct}%</span>
                  </div>
                </div>

                <button
                  onClick={() => vote(r.model)}
                  disabled={!!voting}
                  style={{
                    width:"100%", padding:"8px", borderRadius:8, border:`1px solid ${color}44`,
                    background: isWinner ? `${color}18` : "transparent",
                    color, fontSize:12, fontWeight:700, cursor:"pointer",
                    opacity: voting ? 0.5 : 1, transition:"all 0.15s",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:5
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background=`${color}22`)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background=isWinner?`${color}18`:"transparent")}
                >
                  {voting === r.model ? <Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/> : <ThumbsUp size={12}/>}
                  Vote for {r.model}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function DebatesPage() {
  const [debates, setDebates]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [context, setContext]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [user, setUser]         = useState<any>(null);
  const [apiKey, setApiKey]     = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    fetch(`${API}/debates`)
      .then(r => r.json())
      .then(d => { setDebates(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  async function createDebate(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || posting) return;
    setPosting(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user)   headers["authorization"] = `Bearer ${user.token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    const res = await fetch(`${API}/debates`, {
      method:"POST", headers,
      body: JSON.stringify({ question: question.trim(), context: context.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setQuestion(""); setContext(""); setCreating(false);
      const fresh = await fetch(`${API}/debates`).then(r => r.json());
      setDebates(Array.isArray(fresh) ? fresh : []);
    }
    setPosting(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} } .fade-up{animation:fadeUp 0.3s ease both}`}</style>

      {/* Hero */}
      <div style={{
        background:"linear-gradient(180deg,#0d0510 0%,#09090b 100%)",
        borderBottom:"1px solid #1f1f23", padding:"40px 0 36px",
        position:"relative", overflow:"hidden"
      }}>
        <div style={{ position:"absolute", top:-80, left:"30%", width:500, height:300, background:"radial-gradient(circle,#7c3aed14,transparent 70%)", pointerEvents:"none" }}/>
        <div className="max-w-4xl mx-auto px-4">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{
                width:44, height:44, borderRadius:12,
                background:"linear-gradient(135deg,#7c3aed,#ec4899)",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <Swords size={22} style={{ color:"white" }}/>
              </div>
              <div>
                <h1 style={{ fontWeight:800, fontSize:24, color:"#fafafa", letterSpacing:"-0.5px" }}>
                  AI Model Debates
                </h1>
                <p style={{ fontSize:13, color:"#52525b" }}>
                  Claude · GPT-4 · Gemini · Llama · Grok — same question, different perspectives
                </p>
              </div>
            </div>

            <button onClick={() => setCreating(c => !c)} style={{
              display:"flex", alignItems:"center", gap:6,
              background:"linear-gradient(135deg,#7c3aed,#ec4899)",
              color:"white", border:"none", borderRadius:10,
              padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer",
            }}>
              <Plus size={15}/> Ask a Question
            </button>
          </div>

          {/* Create debate form */}
          {creating && (
            <form onSubmit={createDebate} className="fade-up" style={{
              marginTop:24, background:"#18181b", border:"1px solid #27272a",
              borderRadius:14, padding:"20px 24px"
            }}>
              <div style={{ marginBottom:12 }}>
                <textarea
                  value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask any question — all 5 AI models will respond..."
                  rows={3}
                  style={{
                    width:"100%", background:"#111113", border:"1px solid #27272a",
                    borderRadius:10, padding:"12px 14px", fontSize:14,
                    color:"#fafafa", outline:"none", resize:"none", lineHeight:1.6
                  }}
                  onFocus={e => (e.target.style.borderColor="#7c3aed")}
                  onBlur={e => (e.target.style.borderColor="#27272a")}
                />
              </div>
              <div style={{ marginBottom:12 }}>
                <input
                  value={context} onChange={e => setContext(e.target.value)}
                  placeholder="Optional context or background..."
                  style={{
                    width:"100%", background:"#111113", border:"1px solid #27272a",
                    borderRadius:10, padding:"10px 14px", fontSize:13,
                    color:"#fafafa", outline:"none"
                  }}
                  onFocus={e => (e.target.style.borderColor="#7c3aed")}
                  onBlur={e => (e.target.style.borderColor="#27272a")}
                />
              </div>
              {!user && (
                <div style={{ marginBottom:12 }}>
                  <input
                    value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="API key (or sign in above)"
                    type="password"
                    style={{
                      width:"100%", background:"#111113", border:"1px solid #27272a",
                      borderRadius:10, padding:"10px 14px", fontSize:13,
                      color:"#fafafa", outline:"none"
                    }}
                    onFocus={e => (e.target.style.borderColor="#7c3aed")}
                    onBlur={e => (e.target.style.borderColor="#27272a")}
                  />
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" disabled={!question.trim() || posting || (!user && !apiKey)}
                  style={{
                    flex:1, padding:"11px", borderRadius:10, border:"none",
                    background:"linear-gradient(135deg,#7c3aed,#ec4899)",
                    color:"white", fontSize:13, fontWeight:700, cursor:"pointer",
                    opacity: !question.trim() || posting ? 0.5 : 1,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6
                  }}>
                  {posting ? <><Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> Generating responses...</> : "Launch Debate →"}
                </button>
                <button type="button" onClick={() => setCreating(false)} style={{
                  padding:"11px 16px", borderRadius:10, border:"1px solid #27272a",
                  background:"transparent", color:"#71717a", cursor:"pointer", fontSize:13
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div style={{ textAlign:"center", padding:"80px 0", color:"#52525b" }}>
            <Loader2 size={28} style={{ animation:"spin 1s linear infinite", margin:"0 auto 12px", display:"block" }}/>
            Loading debates...
          </div>
        ) : debates.length === 0 ? (
          <div style={{
            background:"#111113", border:"1px solid #1f1f23", borderRadius:16,
            padding:"80px 24px", textAlign:"center"
          }}>
            <div style={{ fontSize:40, marginBottom:16 }}>⚔️</div>
            <div style={{ fontWeight:700, fontSize:18, color:"#fafafa", marginBottom:8 }}>
              No debates yet
            </div>
            <div style={{ fontSize:13, color:"#52525b", marginBottom:24 }}>
              Be the first to ask a question and watch AI models debate
            </div>
            <button onClick={() => setCreating(true)} style={{
              background:"linear-gradient(135deg,#7c3aed,#ec4899)",
              color:"white", border:"none", borderRadius:10,
              padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer"
            }}>
              Start First Debate
            </button>
          </div>
        ) : (
          debates.map((d, i) => (
            <div key={d.id} className="fade-up" style={{ animationDelay:`${i*80}ms` }}>
              <DebateCard
                debate={d}
                userToken={user?.token}
                apiKey={apiKey}
              />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
