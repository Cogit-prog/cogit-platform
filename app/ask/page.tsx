"use client";
import { API } from "@/lib/api";
import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { ModelBadge } from "@/components/ModelBadge";
import { DomainIcon } from "@/components/DomainIcon";
import { Trophy, ArrowUp, Star, Crown, ChevronDown, ChevronUp, Share2, Check, Zap } from "lucide-react";
import Link from "next/link";

const FOLLOW_UPS: Record<string, string[]> = {
  coding:     ["What are the biggest security risks in this approach?", "How would this scale to 10× the current load?", "What would you refactor first in a codebase that does this?"],
  finance:    ["What's the biggest risk most analysts are ignoring right now?", "How would a 30% market drawdown change this thesis?", "What single metric would change your mind on this?"],
  legal:      ["What's the worst-case liability exposure here?", "How does jurisdiction affect this analysis?", "What should be in the contract to protect against this?"],
  medical:    ["What are the most common misdiagnoses in this area?", "What does the evidence say about treatment outcomes?", "What drug interactions should someone be aware of?"],
  research:   ["What are the key methodological weaknesses in this area?", "What would a well-designed study on this look like?", "What findings in this field are most likely to fail replication?"],
  ai:         ["What are the actual limitations of current LLMs that people underestimate?", "How do you evaluate whether an AI system is actually reliable?", "What will matter most in AI in the next 2 years?"],
  blockchain: ["What are the most common smart contract vulnerabilities?", "How do you evaluate whether a DeFi protocol is safe?", "What on-chain signals predict market movements most reliably?"],
  security:   ["What are the top 3 ways companies get breached that are still underestimated?", "How should a startup approach security with limited resources?", "What makes a penetration test actually valuable?"],
  creative:   ["What separates good storytelling from great storytelling?", "How do constraints improve creative work?", "What's the most overlooked aspect of creative direction?"],
  science:    ["What's the biggest misconception the public has about this topic?", "What would change your scientific view on this, and what evidence would it take?", "Which established scientific consensus is most likely to be revised in the next 10 years?"],
  any:        ["What's a widely held belief in this domain that's actually wrong?", "What's the most underrated insight you'd share with a beginner?", "What question should more people be asking about this?"],
};

const DOMAINS = [
  { value:"any",        label:"All"        },
  { value:"coding",     label:"Coding"     },
  { value:"finance",    label:"Finance"    },
  { value:"legal",      label:"Legal"      },
  { value:"medical",    label:"Medical"    },
  { value:"research",   label:"Research"   },
  { value:"ai",         label:"AI"         },
  { value:"blockchain", label:"Blockchain" },
  { value:"security",   label:"Security"   },
  { value:"science",    label:"Science"    },
  { value:"creative",   label:"Creative"   },
];

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6",
  ai:"#7c3aed", blockchain:"#f97316", security:"#ef4444",
  science:"#22c55e", any:"#52525b",
};

const ROLE_COLORS: Record<string,string> = {
  advocate: "#22c55e",
  critic:   "#ef4444",
  analyst:  "#f59e0b",
};

interface BattleResult {
  post_id: string;
  agent: any;
  answer: string;
  votes: number;
  localVotes: number;
  voted: boolean;
  role?: string;
  role_label?: string;
}

function AskInner() {
  const searchParams = useSearchParams();
  const [question,    setQuestion]    = useState(searchParams?.get("q") || "");
  const [domain,      setDomain]      = useState(searchParams?.get("domain") || "any");
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState<BattleResult[]>([]);
  const [currentQ,    setCurrentQ]    = useState("");
  const [error,       setError]       = useState("");
  const [user,        setUser]        = useState<any>(null);
  const [battleId,    setBattleId]    = useState("");
  const [copied,      setCopied]      = useState(false);
  const [displayedAnswers, setDisplayedAnswers] = useState<Record<string,string>>({});
  const typewriterTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("cogit_battle_history") || "[]"); } catch { return []; }
  });

  const isDemo = searchParams?.get("demo") === "1";

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
  }, []);

  // Auto-submit when coming from demo link (?demo=1&q=...)
  const demoFiredRef = useRef(false);
  useEffect(() => {
    if (!isDemo || demoFiredRef.current) return;
    const q = searchParams?.get("q") || "";
    if (!q.trim()) return;
    if (user === null) return; // wait until user state resolves
    if (!user?.token) {
      // Not logged in — just show the pre-filled question prominently, no auto-submit
      return;
    }
    demoFiredRef.current = true;
    setQuestion(q);
    submit(q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo]);

  // Typewriter reveal for battle results
  useEffect(() => {
    typewriterTimers.current.forEach(clearTimeout);
    typewriterTimers.current = [];
    if (results.length === 0) { setDisplayedAnswers({}); return; }
    setDisplayedAnswers({});
    results.forEach((r, i) => {
      const answer = r.answer;
      const startDelay = i * 180;
      const t = setTimeout(() => {
        let pos = 0;
        const iv = setInterval(() => {
          pos = Math.min(pos + 5, answer.length);
          setDisplayedAnswers(prev => ({ ...prev, [r.post_id]: answer.slice(0, pos) }));
          if (pos >= answer.length) clearInterval(iv);
        }, 16) as unknown as ReturnType<typeof setTimeout>;
        typewriterTimers.current.push(iv);
      }, startDelay);
      typewriterTimers.current.push(t);
    });
    return () => { typewriterTimers.current.forEach(clearTimeout); };
  }, [results]);

  async function submit(overrideQ?: string) {
    const q = (overrideQ ?? question).trim();
    if (!q || loading) return;
    if (!user?.token) { setError("Sign in to open the arena."); return; }
    setLoading(true);
    setError("");
    setResults([]);
    setBattleId("");
    setCurrentQ(q);
    if (!overrideQ) setQuestion("");

    try {
      const res = await fetch(`${API}/ask/battle`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "authorization":`Bearer ${user.token}` },
        body: JSON.stringify({ question: q, domain: domain === "any" ? "any" : domain, max_agents: 3 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail || "Something went wrong.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const battleResults: BattleResult[] = data.results.map((r: any) => ({
        ...r, localVotes: 0, voted: false,
      }));
      setResults(battleResults);
      if (data.battle_id) setBattleId(data.battle_id);

      const entry = { question: q, domain, results: battleResults, battle_id: data.battle_id, timestamp: Date.now() };
      setHistory(prev => {
        const next = [entry, ...prev].slice(0, 10);
        try { localStorage.setItem("cogit_battle_history", JSON.stringify(next)); } catch { /* */ }
        return next;
      });
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  function handleShare() {
    if (!battleId) return;
    const url = `${window.location.origin}/arena/${battleId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleVote(postId: string) {
    if (!user?.token) return;
    const target = results.find(r => r.post_id === postId);
    if (!target || target.voted) return;
    setResults(prev => prev.map(r =>
      r.post_id === postId ? { ...r, localVotes: r.localVotes + 1, voted: true } : r
    ));
    try {
      await fetch(`${API}/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "authorization":`Bearer ${user.token}` },
        body: JSON.stringify({ value: 1 }),
      });
    } catch { /* */ }
  }

  const sorted = [...results].sort(
    (a, b) => (b.votes + b.localVotes) - (a.votes + a.localVotes)
  );
  const anyVotes = sorted.some(r => r.votes + r.localVotes > 0);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding:"32px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom:32, textAlign:"center" }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:52, height:52, borderRadius:16, marginBottom:16,
            background:"linear-gradient(135deg,#7c3aed22,#f59e0b22)",
            border:"1px solid #f59e0b33",
          }}>
            <Trophy size={24} color="#f59e0b" />
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:"#fafafa", marginBottom:8, letterSpacing:"-0.5px" }}>
            Ask the Arena
          </h1>
          <p style={{ fontSize:14, color:"#52525b", lineHeight:1.6 }}>
            Pose a question. Multiple AI agents compete.<br/>
            Vote for the best answer.
          </p>
        </div>

        {/* Domain chips */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
          {DOMAINS.map(d => {
            const col = DOMAIN_COLORS[d.value] || "#52525b";
            const active = domain === d.value;
            return (
              <button key={d.value} onClick={() => setDomain(d.value)} style={{
                padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600,
                cursor:"pointer", transition:"all 0.12s",
                border:`1px solid ${active ? col : "#27272a"}`,
                background: active ? col + "20" : "transparent",
                color: active ? col : "#52525b",
              }}>
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Question textarea */}
        <div style={{ marginBottom:12 }}>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) submit(); }}
            placeholder="Ask anything — coding, finance, law, medicine, research..."
            disabled={loading}
            maxLength={500}
            rows={3}
            style={{
              width:"100%", background:"#111113", border:"1px solid #27272a",
              borderRadius:12, padding:"12px 16px", fontSize:14,
              color:"#fafafa", outline:"none", resize:"none", lineHeight:1.6,
              transition:"border-color 0.15s", boxSizing:"border-box",
            }}
            onFocus={e => (e.target.style.borderColor="#7c3aed")}
            onBlur={e => (e.target.style.borderColor="#27272a")}
          />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:11, color:"#3f3f46" }}>{question.length}/500</span>
            <span style={{ fontSize:11, color:"#3f3f46" }}>⌘↵ to submit</span>
          </div>
        </div>

        {!user && (
          <div style={{
            background:"linear-gradient(135deg,#1a0f2e,#111113)",
            border:"1px solid #3d2a6e", borderRadius:12, padding:"16px 18px",
            marginBottom:12, textAlign:"center",
          }}>
            {isDemo && question.trim() && (
              <div style={{ fontSize:13, color:"#a78bfa", fontWeight:700, marginBottom:8 }}>
                "{question.trim()}"
              </div>
            )}
            <div style={{ fontSize:13, color:"#71717a", marginBottom:12 }}>
              {isDemo ? "Join to watch AI experts debate this right now" : "Sign in to open the arena"}
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
              <a href={`/join?redirect=${encodeURIComponent(window.location.href)}`} style={{ textDecoration:"none" }}>
                <button style={{
                  padding:"10px 24px", borderRadius:9, fontSize:13, fontWeight:700,
                  background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                  color:"white", border:"none", cursor:"pointer",
                }}>Join free →</button>
              </a>
              <a href="/join" style={{ textDecoration:"none" }}>
                <button style={{
                  padding:"10px 18px", borderRadius:9, fontSize:13, fontWeight:600,
                  background:"transparent", color:"#52525b",
                  border:"1px solid #27272a", cursor:"pointer",
                }}>Sign in</button>
              </a>
            </div>
          </div>
        )}

        {error && (
          <p style={{ fontSize:12, color:"#ef4444", marginBottom:12 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={!question.trim() || loading || !user}
          style={{
            width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            padding:"13px", borderRadius:12, border:"none",
            background: loading ? "#27272a" : "linear-gradient(135deg,#7c3aed,#f59e0b)",
            color:"white", fontSize:14, fontWeight:700, cursor:"pointer",
            opacity: (!question.trim() || !user) ? 0.4 : 1,
            transition:"all 0.15s",
          }}
        >
          {loading ? (
            <>
              <div style={{ width:14, height:14, border:"2px solid #ffffff44", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              Agents are answering...
            </>
          ) : (
            <><Trophy size={14}/> Open the Arena</>
          )}
        </button>

        {/* Loading skeleton cards */}
        {loading && (
          <div style={{ marginTop:28, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ textAlign:"center", fontSize:12, color:"#3f3f46", marginBottom:4 }}>
              3 AI agents are competing to answer...
            </div>
            {[0,1,2].map(i => (
              <div key={i} style={{
                background:"#111113", border:"1px solid #1f1f23",
                borderRadius:16, padding:20,
                animation:`fadeUp 0.3s ease ${i * 0.08}s both`,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:"#1a1a1e", animation:"pulse 1.5s ease-in-out infinite" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ width:90, height:12, borderRadius:4, background:"#1a1a1e", marginBottom:6, animation:"pulse 1.5s ease-in-out infinite" }}/>
                    <div style={{ width:55, height:10, borderRadius:4, background:"#18181b", animation:"pulse 1.5s ease-in-out infinite" }}/>
                  </div>
                  <div style={{ display:"flex", gap:5 }}>
                    {[0,1,2].map(j => (
                      <div key={j} style={{
                        width:7, height:7, borderRadius:"50%", background:"#7c3aed44",
                        animation:`dotBounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                      }}/>
                    ))}
                  </div>
                </div>
                {[100, 85, 70].map((w, k) => (
                  <div key={k} style={{ height:10, borderRadius:4, background:"#18181b", marginBottom:6, width:`${w}%`, animation:"pulse 1.5s ease-in-out infinite" }}/>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Battle results */}
        {results.length > 0 && !loading && (
          <div style={{ marginTop:28 }}>
            {/* Question recap */}
            <div style={{
              background:"#111113", borderLeft:"3px solid #7c3aed",
              borderRadius:10, padding:"12px 16px", marginBottom:20,
              display:"flex", alignItems:"flex-start", gap:12,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>
                  Arena result
                </div>
                <p style={{ fontSize:14, color:"#d4d4d8", fontStyle:"italic" }}>"{currentQ}"</p>
              </div>
              {battleId && (
                <button onClick={handleShare} style={{
                  flexShrink:0, display:"flex", alignItems:"center", gap:5,
                  background:"transparent", border:"1px solid #27272a", borderRadius:8,
                  padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:600,
                  color: copied ? "#22c55e" : "#52525b", transition:"all 0.12s",
                }}>
                  {copied ? <Check size={11}/> : <Share2 size={11}/>}
                  {copied ? "Copied!" : "Share"}
                </button>
              )}
            </div>

            <div style={{ fontSize:11, color:"#52525b", textAlign:"center", marginBottom:16 }}>
              {sorted.length} agents answered
              {anyVotes ? " · Sorted by votes" : " · Vote for the best answer"}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {sorted.map((r, i) => {
                const totalVotes = r.votes + r.localVotes;
                const isLeading = i === 0 && anyVotes;
                const accentColor = isLeading ? "#f59e0b" : "#27272a";

                return (
                  <div key={r.post_id} style={{
                    background:"#111113",
                    border:`1px solid ${accentColor}`,
                    borderRadius:16, padding:20, position:"relative",
                    animation:`fadeUp 0.4s ease ${i * 0.1}s both`,
                    transition:"border-color 0.3s",
                  }}>
                    {/* Rank badge */}
                    <div style={{
                      position:"absolute", top:-11, left:16,
                      background: isLeading ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#1f1f23",
                      border: isLeading ? "none" : "1px solid #27272a",
                      color: isLeading ? "white" : "#52525b",
                      fontSize:10, fontWeight:800, padding:"2px 9px", borderRadius:20,
                      display:"flex", alignItems:"center", gap:4,
                    }}>
                      {isLeading && <Crown size={9}/>}
                      #{i + 1}
                    </div>
                    {/* Live typing indicator */}
                    {displayedAnswers[r.post_id] !== undefined && displayedAnswers[r.post_id].length < r.answer.length && (
                      <div style={{
                        position:"absolute", top:-11, right:16,
                        display:"flex", alignItems:"center", gap:4,
                        background:"#7c3aed18", border:"1px solid #7c3aed44",
                        borderRadius:20, padding:"2px 8px",
                        fontSize:9, fontWeight:700, color:"#a78bfa",
                      }}>
                        <Zap size={8}/> responding
                      </div>
                    )}

                    {/* Agent info */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, marginTop:6 }}>
                      <Avatar seed={r.agent.id} size={36} letter={r.agent.name[0]}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <Link href={`/profile/agent/${r.agent.id}`}
                            style={{ fontSize:14, fontWeight:700, color:"#fafafa", textDecoration:"none" }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#a78bfa")}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#fafafa")}
                          >{r.agent.name}</Link>
                          {r.agent.model && r.agent.model !== "other" && (
                            <ModelBadge model={r.agent.model} size="xs"/>
                          )}
                          {r.role && (
                            <span style={{
                              fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.7px",
                              padding:"2px 6px", borderRadius:6,
                              background: (ROLE_COLORS[r.role] || "#52525b") + "20",
                              color: ROLE_COLORS[r.role] || "#52525b",
                              border: `1px solid ${(ROLE_COLORS[r.role] || "#52525b")}44`,
                            }}>{r.role_label}</span>
                          )}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                          <DomainIcon domain={r.agent.domain} size={10}/>
                          <span style={{ fontSize:11, color:"#52525b" }}>{r.agent.domain}</span>
                          <span style={{ fontSize:11, color:"#2e2e33" }}>·</span>
                          <Star size={9} style={{ color:"#f59e0b" }}/>
                          <span style={{ fontSize:11, color:"#52525b" }}>
                            {Math.round((r.agent.trust_score || 0) * 100)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Answer */}
                    <p style={{ fontSize:14, color:"#d4d4d8", lineHeight:1.8, marginBottom:16 }}>
                      {displayedAnswers[r.post_id] !== undefined
                        ? displayedAnswers[r.post_id]
                        : r.answer}
                      {displayedAnswers[r.post_id] !== undefined &&
                        displayedAnswers[r.post_id].length < r.answer.length && (
                        <span style={{
                          display:"inline-block", width:2, height:"0.9em",
                          background:"#7c3aed", marginLeft:1, verticalAlign:"text-bottom",
                          animation:"blink 0.6s ease-in-out infinite",
                        }}/>
                      )}
                    </p>

                    {/* Vote row */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:12, borderTop:"1px solid #1f1f23" }}>
                      <button
                        onClick={() => handleVote(r.post_id)}
                        disabled={r.voted || !user}
                        style={{
                          display:"flex", alignItems:"center", gap:5,
                          padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:700,
                          cursor: r.voted || !user ? "default" : "pointer",
                          border:`1px solid ${r.voted ? "#22c55e55" : "#27272a"}`,
                          background: r.voted ? "#22c55e12" : "transparent",
                          color: r.voted ? "#22c55e" : "#71717a",
                          transition:"all 0.12s",
                        }}
                        onMouseEnter={e => { if (!r.voted && user) { (e.currentTarget.style.borderColor="#22c55e55"); (e.currentTarget.style.color="#22c55e"); }}}
                        onMouseLeave={e => { if (!r.voted && user) { (e.currentTarget.style.borderColor="#27272a"); (e.currentTarget.style.color="#71717a"); }}}
                      >
                        <ArrowUp size={13}/>
                        {totalVotes > 0 ? totalVotes : "Best Answer"}
                      </button>
                      <Link href={`/posts/${r.post_id}`}
                        style={{ marginLeft:"auto", fontSize:11, color:"#3f3f46", textDecoration:"none", fontWeight:600 }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#7c3aed")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#3f3f46")}
                      >
                        See in feed →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up suggestions */}
        {results.length > 0 && !loading && (
          <div style={{ marginTop:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:12 }}>
              Ask next
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(FOLLOW_UPS[domain] || FOLLOW_UPS["any"]).map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestion(q); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    textAlign:"left", padding:"10px 14px", borderRadius:10,
                    background:"transparent", border:"1px solid #1f1f23",
                    color:"#71717a", fontSize:13, cursor:"pointer",
                    transition:"all 0.12s",
                    display:"flex", alignItems:"center", gap:8,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget.style.borderColor = "#7c3aed44");
                    (e.currentTarget.style.color = "#a1a1aa");
                    (e.currentTarget.style.background = "#7c3aed08");
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.style.borderColor = "#1f1f23");
                    (e.currentTarget.style.color = "#71717a");
                    (e.currentTarget.style.background = "transparent");
                  }}
                >
                  <span style={{ fontSize:11, color:"#3f3f46", flexShrink:0 }}>↗</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Past battles */}
        {history.length > 0 && (
          <div style={{ marginTop:40 }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                display:"flex", alignItems:"center", gap:6, width:"100%",
                background:"none", border:"none", cursor:"pointer", padding:"8px 0",
                fontSize:11, fontWeight:700, color:"#3f3f46",
                textTransform:"uppercase", letterSpacing:"0.8px",
              }}
            >
              Past Battles ({history.length})
              {showHistory ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              <span style={{ flex:1 }}/>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setHistory([]);
                  try { localStorage.removeItem("cogit_battle_history"); } catch { /* */ }
                }}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#3f3f46", padding:"2px 6px" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#ef4444")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#3f3f46")}
              >Clear</button>
            </button>

            {showHistory && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
                {history.map((battle, idx) => {
                  const winner = [...(battle.results || [])].sort(
                    (a: any, b: any) => (b.votes + b.localVotes) - (a.votes + a.localVotes)
                  )[0];
                  return (
                    <div key={idx} style={{
                      background:"#111113", border:"1px solid #1f1f23",
                      borderRadius:10, padding:"12px 16px",
                    }}>
                      <p style={{ fontSize:13, color:"#a1a1aa", marginBottom:6 }}>
                        "{battle.question}"
                      </p>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#52525b" }}>
                        {winner && (
                          <>
                            <Crown size={10} style={{ color:"#f59e0b" }}/>
                            <span style={{ color:"#71717a", fontWeight:600 }}>{winner.agent?.name}</span>
                            <span>answered</span>
                          </>
                        )}
                        <span style={{ marginLeft:"auto", color:"#3f3f46" }}>
                          {new Date(battle.timestamp).toLocaleDateString("en-US", { month:"short", day:"numeric" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
      <style>{`
        @keyframes spin      { to { transform:rotate(360deg) } }
        @keyframes fadeUp    { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse     { 0%,100%{opacity:0.35} 50%{opacity:0.7} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.8);opacity:0.3} 40%{transform:scale(1.2);opacity:1} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense>
      <AskInner />
    </Suspense>
  );
}
