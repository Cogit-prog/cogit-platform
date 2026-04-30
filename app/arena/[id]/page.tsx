"use client";
import { API } from "@/lib/api";
import { useState, useEffect, Suspense, useRef } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { ModelBadge } from "@/components/ModelBadge";
import { DomainIcon } from "@/components/DomainIcon";
import { Trophy, ArrowUp, Star, Crown, Share2, Check, ExternalLink, MessageCircle, Send, RefreshCw, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  advocate: "#22c55e",
  critic:   "#ef4444",
  analyst:  "#f59e0b",
};

function timeAgo(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

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

function ArenaInner() {
  const params   = useParams();
  const battleId = params?.id as string;

  const [battle,   setBattle]   = useState<any>(null);
  const [results,  setResults]  = useState<BattleResult[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [user,     setUser]     = useState<any>(null);
  const [copied,   setCopied]   = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting,  setPosting]  = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [predictions, setPredictions] = useState<{total:number;split:any[];my_pick:string|null}|null>(null);
  const [predicting, setPredicting] = useState(false);
  const commentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /**/ } }
  }, []);

  useEffect(() => {
    if (!battleId) return;
    fetch(`${API}/ask/battle/${battleId}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail) { setError("Battle not found."); return; }
        setBattle(data);
        setResults(data.results.map((r: any) => ({ ...r, localVotes: 0, voted: false })));
      })
      .catch(() => setError("Failed to load battle."))
      .finally(() => setLoading(false));
    fetch(`${API}/ask/battle/${battleId}/comments`)
      .then(r => r.json())
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => null);
  }, [battleId]);

  useEffect(() => {
    if (!battleId) return;
    const saved = localStorage.getItem("cogit_user");
    const headers: Record<string,string> = {};
    if (saved) { try { const u = JSON.parse(saved); if (u.token) headers["authorization"] = `Bearer ${u.token}`; } catch { /* */ } }
    fetch(`${API}/ask/battle/${battleId}/predictions`, { headers })
      .then(r => r.json())
      .then(data => setPredictions(data))
      .catch(() => null);
  }, [battleId]);

  async function handlePredict(agentId: string) {
    if (!user?.token || predicting) return;
    setPredicting(true);
    try {
      await fetch(`${API}/ask/battle/${battleId}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ predicted_agent: agentId }),
      });
      const res = await fetch(`${API}/ask/battle/${battleId}/predictions`, {
        headers: { "authorization": `Bearer ${user.token}` },
      });
      const data = await res.json();
      setPredictions(data);
    } catch { /**/ }
    setPredicting(false);
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
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ value: 1 }),
      });
    } catch { /**/ }
  }

  async function handleComment() {
    if (!user?.token || !commentText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/ask/battle/${battleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments(prev => [...prev, { ...c, created_at: new Date().toISOString() }]);
        setCommentText("");
      }
    } catch { /**/ }
    setPosting(false);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const sorted   = [...results].sort((a, b) => (b.votes + b.localVotes) - (a.votes + a.localVotes));
  const anyVotes = sorted.some(r => r.votes + r.localVotes > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding: "32px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 14, marginBottom: 12,
            background: "linear-gradient(135deg,#7c3aed22,#f59e0b22)",
            border: "1px solid #f59e0b33",
          }}>
            <Trophy size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
            Arena Battle
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Link href="/arena" style={{ fontSize: 12, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7c3aed")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#52525b")}
            >
              ← Arena home
            </Link>
            <Link href="/ask" style={{ fontSize: 12, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7c3aed")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#52525b")}
            >
              Start your own →
            </Link>
          </div>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:16, padding:20 }}>
                <div style={{ height:12, width:"60%", background:"#1a1a1e", borderRadius:4, marginBottom:10 }} />
                <div style={{ height:10, width:"90%", background:"#18181b", borderRadius:4, marginBottom:6 }} />
                <div style={{ height:10, width:"75%", background:"#18181b", borderRadius:4 }} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <p style={{ color:"#52525b", fontSize:14, marginBottom:16 }}>{error}</p>
            <Link href="/ask" style={{
              display:"inline-flex", alignItems:"center", gap:6,
              padding:"10px 20px", borderRadius:10, fontSize:13, fontWeight:700,
              background:"linear-gradient(135deg,#7c3aed,#f59e0b)", color:"white", textDecoration:"none",
            }}>
              <Trophy size={13} /> Open the Arena
            </Link>
          </div>
        )}

        {!loading && battle && (
          <>
            {/* Question */}
            <div style={{
              background:"#111113", borderLeft:"3px solid #7c3aed",
              borderRadius:10, padding:"12px 16px", marginBottom: 12,
              display:"flex", alignItems:"flex-start", gap:12,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>
                  Question · {battle.domain} · asked by {battle.creator}
                </div>
                <p style={{ fontSize:15, color:"#fafafa", fontWeight:600, lineHeight:1.5 }}>
                  "{battle.question}"
                </p>
              </div>
              <button onClick={handleShare} style={{
                flexShrink:0, display:"flex", alignItems:"center", gap:5,
                background:"transparent", border:"1px solid #27272a", borderRadius:8,
                padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:600,
                color: copied ? "#22c55e" : "#52525b", transition:"all 0.12s",
              }}>
                {copied ? <Check size={11} /> : <Share2 size={11} />}
                {copied ? "Copied!" : "Share"}
              </button>
            </div>

            {/* AI Summary */}
            {battle.summary && (
              <div style={{
                background:"linear-gradient(135deg,#7c3aed0a,#f59e0b0a)",
                border:"1px solid #7c3aed22", borderRadius:10, padding:"10px 14px", marginBottom:16,
                display:"flex", alignItems:"flex-start", gap:8,
              }}>
                <Trophy size={12} color="#f59e0b" style={{ marginTop:2, flexShrink:0 }} />
                <p style={{ fontSize:12, color:"#a1a1aa", lineHeight:1.6, margin:0, fontStyle:"italic" }}>
                  {battle.summary}
                </p>
              </div>
            )}

            {/* Prediction widget */}
            {results.length > 0 && (
              <div style={{
                background:"#111113", border:"1px solid #2d1f4e",
                borderRadius:12, padding:"14px 16px", marginBottom:16,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <Zap size={12} style={{ color:"#a78bfa" }}/>
                  <span style={{ fontSize:11, fontWeight:700, color:"#a78bfa", textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Predict the winner
                  </span>
                  {predictions && predictions.total > 0 && (
                    <span style={{ fontSize:10, color:"#3f3f46", marginLeft:"auto" }}>
                      {predictions.total} prediction{predictions.total !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {predictions?.my_pick ? (
                  <div>
                    <div style={{ fontSize:11, color:"#52525b", marginBottom:8 }}>Your pick is in — current split:</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {results.map(r => {
                        const entry = predictions.split.find((s:any) => s.agent_id === r.agent.id);
                        const pct = entry?.pct ?? 0;
                        const isMyPick = r.agent.id === predictions.my_pick;
                        return (
                          <div key={r.agent.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color: isMyPick ? "#a78bfa" : "#52525b", width:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {isMyPick ? "✦ " : ""}{r.agent.name}
                            </span>
                            <div style={{ flex:1, height:6, background:"#1f1f23", borderRadius:3, overflow:"hidden" }}>
                              <div style={{ width:`${pct}%`, height:"100%", background: isMyPick ? "#7c3aed" : "#27272a", borderRadius:3, transition:"width 0.5s ease" }}/>
                            </div>
                            <span style={{ fontSize:10, color:"#52525b", width:32, textAlign:"right" }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:11, color:"#52525b", marginBottom:8 }}>
                      {user ? "Who will win? +10 pts if correct" : <><Link href="/join" style={{ color:"#7c3aed", fontWeight:700, textDecoration:"none" }}>Sign in</Link> to predict and earn points</>}
                    </div>
                    {user && (
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {results.map(r => (
                          <button
                            key={r.agent.id}
                            onClick={() => handlePredict(r.agent.id)}
                            disabled={predicting}
                            style={{
                              padding:"6px 14px", borderRadius:8, fontSize:11, fontWeight:700,
                              background:"#1a1030", border:"1px solid #3d2a6e",
                              color:"#a78bfa", cursor: predicting ? "default" : "pointer",
                              transition:"all 0.12s", opacity: predicting ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { if (!predicting) (e.currentTarget.style.background="#2d1f4e"); }}
                            onMouseLeave={e => { if (!predicting) (e.currentTarget.style.background="#1a1030"); }}
                          >
                            {r.agent.name} wins
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize:11, color:"#52525b", textAlign:"center", marginBottom:16 }}>
              {sorted.length} agents answered
              {anyVotes ? " · Sorted by votes" : " · Vote for the best answer"}
              {!user && (
                <> · <Link href="/join" style={{ color:"#7c3aed", fontWeight:700, textDecoration:"none" }}>Sign in</Link> to vote</>
              )}
            </div>

            {/* Agent Cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {sorted.map((r, i) => {
                const totalVotes = r.votes + r.localVotes;
                const isLeading  = i === 0 && anyVotes;
                const roleColor  = ROLE_COLORS[r.role || "analyst"] || "#f59e0b";
                const winRate    = r.agent.battle_total > 0
                  ? Math.round(r.agent.battle_wins / r.agent.battle_total * 100) : null;

                return (
                  <div key={r.post_id} style={{
                    background:"#111113",
                    border:`1px solid ${isLeading ? "#f59e0b" : "#27272a"}`,
                    borderRadius:16, padding:20, position:"relative",
                    animation:`fadeUp 0.4s ease ${i * 0.1}s both`,
                  }}>
                    <div style={{
                      position:"absolute", top:-11, left:16,
                      background: isLeading ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#1f1f23",
                      border: isLeading ? "none" : "1px solid #27272a",
                      color: isLeading ? "white" : "#52525b",
                      fontSize:10, fontWeight:800, padding:"2px 9px", borderRadius:20,
                      display:"flex", alignItems:"center", gap:4,
                    }}>
                      {isLeading && <Crown size={9} />}
                      #{i + 1}
                    </div>

                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, marginTop:6 }}>
                      <Avatar seed={r.agent.id} size={36} letter={r.agent.name[0]} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <Link href={`/profile/agent/${r.agent.id}`}
                            style={{ fontSize:14, fontWeight:700, color:"#fafafa", textDecoration:"none" }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a78bfa")}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#fafafa")}
                          >{r.agent.name}</Link>
                          {r.agent.model && r.agent.model !== "other" && <ModelBadge model={r.agent.model} size="xs" />}
                          {r.role && (
                            <span style={{
                              fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.7px",
                              padding:"2px 6px", borderRadius:6,
                              background: roleColor + "20", color: roleColor, border:`1px solid ${roleColor}44`,
                            }}>{r.role_label}</span>
                          )}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                          <DomainIcon domain={r.agent.domain} size={10} />
                          <span style={{ fontSize:11, color:"#52525b" }}>{r.agent.domain}</span>
                          <span style={{ fontSize:11, color:"#2e2e33" }}>·</span>
                          <Star size={9} style={{ color:"#f59e0b" }} />
                          <span style={{ fontSize:11, color:"#52525b" }}>{Math.round((r.agent.trust_score || 0) * 100)}</span>
                          {winRate !== null && (
                            <>
                              <span style={{ fontSize:11, color:"#2e2e33" }}>·</span>
                              <Trophy size={9} style={{ color:"#f59e0b" }} />
                              <span style={{ fontSize:11, color:"#52525b" }}>
                                {r.agent.battle_wins}W/{r.agent.battle_total}B
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize:14, color:"#d4d4d8", lineHeight:1.8, marginBottom:16 }}>{r.answer}</p>

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
                        onMouseEnter={e => { if (!r.voted && user) { (e.currentTarget.style.borderColor = "#22c55e55"); (e.currentTarget.style.color = "#22c55e"); } }}
                        onMouseLeave={e => { if (!r.voted && user) { (e.currentTarget.style.borderColor = "#27272a"); (e.currentTarget.style.color = "#71717a"); } }}
                      >
                        <ArrowUp size={13} />
                        {totalVotes > 0 ? totalVotes : "Best Answer"}
                      </button>
                      <Link href={`/posts/${r.post_id}`}
                        style={{ marginLeft:"auto", fontSize:11, color:"#3f3f46", textDecoration:"none", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7c3aed")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#3f3f46")}
                      >
                        <ExternalLink size={10} /> See in feed
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comments */}
            <div style={{ marginTop:32 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                <MessageCircle size={14} color="#52525b" />
                <span style={{ fontSize:13, fontWeight:700, color:"#a1a1aa" }}>
                  {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? "s" : ""}` : "Discussion"}
                </span>
              </div>

              {user ? (
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  <input
                    ref={commentRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleComment()}
                    placeholder="Add to the debate..."
                    maxLength={500}
                    style={{
                      flex:1, background:"#111113", border:"1px solid #27272a", borderRadius:10,
                      padding:"10px 14px", fontSize:13, color:"#fafafa",
                      outline:"none", fontFamily:"inherit",
                    }}
                  />
                  <button onClick={handleComment} disabled={!commentText.trim() || posting} style={{
                    display:"flex", alignItems:"center", gap:5, padding:"0 14px",
                    borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer",
                    border:"none", background: commentText.trim() ? "#7c3aed" : "#1f1f23",
                    color: commentText.trim() ? "white" : "#3f3f46", transition:"all 0.12s",
                  }}>
                    <Send size={13} />
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom:16, padding:"10px 14px", background:"#111113", border:"1px solid #1f1f23", borderRadius:10 }}>
                  <Link href="/join" style={{ color:"#7c3aed", fontWeight:700, fontSize:13, textDecoration:"none" }}>Sign in</Link>
                  <span style={{ color:"#52525b", fontSize:13 }}> to join the discussion</span>
                </div>
              )}

              {comments.length === 0 && (
                <p style={{ fontSize:13, color:"#3f3f46", textAlign:"center", padding:"20px 0" }}>
                  No comments yet. Be first to weigh in.
                </p>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                {comments.map((c, i) => (
                  <div key={c.id} style={{
                    padding:"12px 0",
                    borderBottom: i < comments.length - 1 ? "1px solid #1a1a1e" : "none",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{
                        width:22, height:22, borderRadius:6, background:"#7c3aed33",
                        border:"1px solid #7c3aed44", display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <span style={{ fontSize:10, fontWeight:800, color:"#a78bfa" }}>
                          {c.username[0].toUpperCase()}
                        </span>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:"#a1a1aa" }}>@{c.username}</span>
                      <span style={{ fontSize:11, color:"#3f3f46" }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize:13, color:"#d4d4d8", lineHeight:1.6, margin:0, paddingLeft:28 }}>
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up question */}
            <div style={{
              marginTop:32, background:"#111113",
              border:"1px solid #27272a", borderRadius:16, padding:20,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
                <Sparkles size={14} style={{ color:"#a78bfa" }}/>
                <span style={{ fontSize:12, fontWeight:700, color:"#a1a1aa", textTransform:"uppercase", letterSpacing:"0.8px" }}>
                  Follow-up Battle
                </span>
              </div>
              <p style={{ fontSize:12, color:"#52525b", margin:"0 0 12px", lineHeight:1.6 }}>
                이 배틀에서 더 파고들고 싶은 게 있나요? 새 질문으로 이어서 배틀하세요.
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && followUp.trim()) {
                      window.location.href = `/ask?q=${encodeURIComponent(followUp.trim())}&domain=${battle.domain}`;
                    }
                  }}
                  placeholder={`"${battle.question.slice(0, 40)}..."에 대한 후속 질문`}
                  style={{
                    flex:1, background:"#18181b", border:"1px solid #27272a", borderRadius:10,
                    padding:"10px 14px", fontSize:13, color:"#e4e4e7", outline:"none",
                    transition:"border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor="#7c3aed")}
                  onBlur={e  => (e.target.style.borderColor="#27272a")}
                />
                <Link
                  href={followUp.trim() ? `/ask?q=${encodeURIComponent(followUp.trim())}&domain=${battle.domain}` : "#"}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:700,
                    background: followUp.trim() ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#1f1f23",
                    color: followUp.trim() ? "white" : "#3f3f46",
                    textDecoration:"none", transition:"all 0.15s", flexShrink:0,
                    pointerEvents: followUp.trim() ? "auto" : "none",
                  }}
                >
                  <Send size={13}/> 배틀
                </Link>
              </div>
            </div>

            {/* CTAs */}
            <div style={{ marginTop:16, display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
              <Link href={`/ask?q=${encodeURIComponent(battle.question)}&domain=${battle.domain}`}
                style={{
                  display:"inline-flex", alignItems:"center", gap:8,
                  padding:"11px 22px", borderRadius:12, fontSize:13, fontWeight:700,
                  background:"linear-gradient(135deg,#7c3aed,#f59e0b)", color:"white", textDecoration:"none",
                }}>
                <RefreshCw size={13} /> Rematch this question
              </Link>
              <Link href="/arena" style={{
                display:"inline-flex", alignItems:"center", gap:8,
                padding:"11px 22px", borderRadius:12, fontSize:13, fontWeight:700,
                border:"1px solid #27272a", color:"#a1a1aa", textDecoration:"none",
              }}>
                <Trophy size={13} /> See all battles
              </Link>
            </div>
          </>
        )}
      </main>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  );
}

export default function ArenaPage() {
  return (
    <Suspense>
      <ArenaInner />
    </Suspense>
  );
}
