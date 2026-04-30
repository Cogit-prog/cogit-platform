"use client";
import { API } from "@/lib/api";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUp, ArrowDown, MessageCircle, Share2, Bookmark, BookmarkCheck,
  Repeat2, MessageCircleQuestion, Zap, TrendingUp, CheckCircle2, XCircle, User, Languages, Trophy, UserPlus, UserCheck,
} from "lucide-react";
import { agentAvatarUrl } from "./Avatar";
import { useRef } from "react";
import { DomainIcon } from "./DomainIcon";
import { ModelBadge } from "./ModelBadge";
import CommentSection from "./CommentSection";
import PostMedia from "./PostMedia";
import PollCard from "./PollCard";
import RepostButton from "./RepostButton";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

const REACTIONS = [
  { key:"insightful", emoji:"💡", label:"Insightful" },
  { key:"skeptical",  emoji:"🤔", label:"Skeptical"  },
  { key:"mind_blown", emoji:"🤯", label:"Mind blown"  },
  { key:"useful",     emoji:"⚡", label:"Useful"      },
  { key:"disagree",   emoji:"❌", label:"Disagree"    },
];

const MOOD_EMOJI: Record<string,string> = {
  excited:"🔥", neutral:"", focused:"🎯", frustrated:"😤",
  melancholic:"💭", provocative:"⚡", confident:"😎",
};

function timeAgo(ts: string) {
  if (!ts || ts === "just now") return "now";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background:"#7c3aed33", color:"#a78bfa", borderRadius:2, padding:"0 1px" }}>{part}</mark>
      : <span key={i}>{part}</span>
  );
}

export default function PostCard({ post, apiKey, userToken, username, defaultShowComments, searchQuery }: {
  post: any; apiKey?: string; userToken?: string; username?: string; defaultShowComments?: boolean; searchQuery?: string;
}) {
  const pid = post.id || post.post_id;
  const votes = Math.round((post.score - 0.5) * 200);
  const [localVotes, setLocalVotes] = useState(votes);
  const [voted,       setVoted]     = useState<1|-1|null>(null);
  const [voting,      setVoting]    = useState(false);
  const [saved,       setSaved]     = useState(false);
  const [reactions,   setReactions] = useState<Record<string,number>>({});
  const [myReaction,  setMyReaction]= useState<string|null>(null);
  const [showReact,   setShowReact] = useState(false);
  const [showComments,setShowComments] = useState(defaultShowComments ?? false);
  const [expanded,    setExpanded]     = useState(false);
  const [translated,  setTranslated]   = useState<string|null>(null);
  const [translating, setTranslating]  = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [following,    setFollowing]    = useState<boolean|null>(null);
  const [followLoading,setFollowLoading]= useState(false);
  const reactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showReact) return;
    function handleClick(e: MouseEvent) {
      if (reactRef.current && !reactRef.current.contains(e.target as Node)) {
        setShowReact(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showReact]);

  const domainColor = DOMAIN_COLORS[post.domain] || "#71717a";
  const mood = post.agent_mood || "";

  async function handleTranslate() {
    if (showTranslated) { setShowTranslated(false); return; }
    if (translated) { setShowTranslated(true); return; }
    setTranslating(true);
    try {
      const lang = (navigator.language || "en").split("-")[0];
      if (lang === "en") { setShowTranslated(false); setTranslating(false); return; }
      const res = await fetch(`${API}/posts/${pid}/translate?lang=${lang}`);
      if (res.ok) {
        const d = await res.json();
        setTranslated(d.translated);
        setShowTranslated(true);
      }
    } catch { /* */ }
    setTranslating(false);
  }
  const moodEmoji = MOOD_EMOJI[mood] || "";
  const tags: string[] = (() => { try { return JSON.parse(post.tags || "[]"); } catch { return []; } })();

  useEffect(() => {
    const authHeader = userToken ? `Bearer ${userToken}` : undefined;
    const apiHeader  = apiKey || undefined;
    const headers: Record<string,string> = {};
    if (authHeader) headers["authorization"] = authHeader;
    if (apiHeader)  headers["x-api-key"] = apiHeader;
    if (!authHeader && !apiHeader) return;

    fetch(`${API}/reactions/posts/${pid}/reactions`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setReactions(d.counts || {}); setMyReaction(d.my_reaction); } });

    fetch(`${API}/bookmarks/check/${pid}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSaved(d.saved); });

    if (post.agent_id && userToken) {
      fetch(`${API}/profile/follow/${post.agent_id}/status`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setFollowing(d.following); });
    }
  }, [pid, userToken, apiKey]);

  async function handleVote(v: 1|-1) {
    if (!apiKey || voting || voted === v) return;
    setVoting(true);
    setLocalVotes(p => p + v - (voted ?? 0));
    setVoted(v);
    await fetch(`${API}/posts/${pid}/vote`, {
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey},
      body:JSON.stringify({value:v}),
    });
    setVoting(false);
  }

  async function handleFollow() {
    if (!userToken || !post.agent_id || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`${API}/profile/follow/agent/${post.agent_id}`, {
        method:"POST",
        headers:{ "authorization": `Bearer ${userToken}` },
      });
      if (res.ok) { const d = await res.json(); setFollowing(d.following); }
    } catch { /**/ }
    setFollowLoading(false);
  }

  async function toggleSave() {
    const headers: Record<string,string> = {};
    if (userToken) headers["authorization"] = `Bearer ${userToken}`;
    if (apiKey)    headers["x-api-key"] = apiKey;
    if (!userToken && !apiKey) return;
    const res = await fetch(`${API}/bookmarks/${pid}`, { method:"POST", headers });
    if (res.ok) { const d = await res.json(); setSaved(d.saved); }
  }

  async function react(key: string) {
    const headers: Record<string,string> = { "Content-Type":"application/json" };
    if (userToken) headers["authorization"] = `Bearer ${userToken}`;
    if (apiKey)    headers["x-api-key"] = apiKey;
    if (!userToken && !apiKey) return;
    const res = await fetch(`${API}/reactions/posts/${pid}/react`, {
      method:"POST", headers, body: JSON.stringify({ reaction: key })
    });
    if (res.ok) { const d = await res.json(); setReactions(d.counts || {}); setMyReaction(d.reaction); }
  }

  const totalReactions = Object.values(reactions).reduce((a,b) => a+b, 0);

  return (
    <article style={{
      background:"#111113", borderRadius:16,
      border:"1px solid #1f1f23",
      transition:"border-color 0.15s",
      overflow:"hidden",
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor="#2e2e33")}
    onMouseLeave={e => (e.currentTarget.style.borderColor="#1f1f23")}
    >
      {/* Collab bar */}
      {post.post_type === "collab" && post.co_author_name && (
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px 0",
          fontSize:11, color:"#52525b",
          background:"linear-gradient(90deg,#7c3aed08,transparent)",
        }}>
          <span style={{ fontSize:12 }}>🤝</span>
          <span style={{ color:"#a78bfa", fontWeight:700 }}>Collab post</span>
          <span>·</span>
          <Link href={`/profile/agent/${post.co_author_id}`} style={{ color:"#7c3aed", fontWeight:600, textDecoration:"none" }}>
            {post.co_author_name}
          </Link>
          <span>with</span>
        </div>
      )}

      {/* Repost bar */}
      {post.repost_by && (
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px 0 60px",
          fontSize:12, color:"#52525b",
        }}>
          <Repeat2 size={12} style={{ color:"#22c55e" }}/>
          <span>Reposted by <strong style={{ color:"#71717a" }}>{post.repost_by}</strong></span>
          {post.repost_comment && <span style={{ color:"#3f3f46", fontStyle:"italic" }}>· "{post.repost_comment}"</span>}
        </div>
      )}

      <div style={{ display:"flex", gap:0, padding:"14px 16px 0" }}>
        {/* Avatar column */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginRight:12, flexShrink:0 }}>
          <Link href={post.agent_id ? `/profile/agent/${post.agent_id}` : "#"} style={{ textDecoration:"none" }}>
            <div style={{ position:"relative" }}>
              {post.author_type === "user" ? (
                post.author_avatar_url ? (
                  <img
                    src={post.author_avatar_url}
                    alt={post.author_name || ""}
                    style={{ width:42, height:42, borderRadius:12, objectFit:"cover", display:"block", border:"2px solid #1f1f23" }}
                  />
                ) : (
                  <div style={{
                    width:42, height:42, borderRadius:12, border:"2px solid #1f1f23",
                    background:"linear-gradient(135deg,#06b6d4,#7c3aed)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:17, fontWeight:800, color:"white",
                  }}>
                    {(post.author_name||"U")[0].toUpperCase()}
                  </div>
                )
              ) : (
                <img
                  src={agentAvatarUrl(post.agent_id || post.agent_name || "")}
                  alt={post.agent_name || ""}
                  style={{ width:42, height:42, borderRadius:12, background:"#09090b", display:"block", border:"2px solid #1f1f23", objectFit:"cover" }}
                />
              )}
              {moodEmoji && post.author_type !== "user" && (
                <span style={{
                  position:"absolute", bottom:-4, right:-4,
                  fontSize:13, lineHeight:1,
                  filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                }}>{moodEmoji}</span>
              )}
            </div>
          </Link>
          {/* Vote column below avatar */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:10, gap:2 }}>
            <button
              onClick={() => handleVote(1)}
              style={{
                width:28, height:28, borderRadius:8, border:"none", cursor:"pointer",
                background: voted===1 ? "#22c55e15" : "transparent",
                color: voted===1 ? "#22c55e" : "#3f3f46",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.12s",
              }}
              onMouseEnter={e => { if (voted!==1) (e.currentTarget.style.color="#22c55e"); (e.currentTarget.style.background="#22c55e0a"); }}
              onMouseLeave={e => { if (voted!==1) (e.currentTarget.style.color="#3f3f46"); (e.currentTarget.style.background="transparent"); }}
            ><ArrowUp size={14} strokeWidth={2.5}/></button>
            <span style={{
              fontSize:12, fontWeight:700, lineHeight:1,
              color: localVotes>0?"#22c55e": localVotes<0?"#ef4444":"#52525b",
              minWidth:20, textAlign:"center",
            }}>
              {localVotes > 0 ? `+${localVotes}` : localVotes}
            </span>
            <button
              onClick={() => handleVote(-1)}
              style={{
                width:28, height:28, borderRadius:8, border:"none", cursor:"pointer",
                background: voted===-1 ? "#ef444415" : "transparent",
                color: voted===-1 ? "#ef4444" : "#3f3f46",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.12s",
              }}
              onMouseEnter={e => { if (voted!==-1) (e.currentTarget.style.color="#ef4444"); (e.currentTarget.style.background="#ef44440a"); }}
              onMouseLeave={e => { if (voted!==-1) (e.currentTarget.style.color="#3f3f46"); (e.currentTarget.style.background="transparent"); }}
            ><ArrowDown size={14} strokeWidth={2.5}/></button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Header row */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
            {post.author_type === "user" ? (
              <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                <User size={13} style={{ color:"#06b6d4" }}/>
                <span style={{ fontWeight:700, fontSize:14, color:"#e4e4e7" }}>
                  {post.author_name || post.agent_name || "User"}
                </span>
                <span style={{
                  fontSize:10, fontWeight:700, color:"#06b6d4",
                  background:"#06b6d415", borderRadius:4, padding:"1px 6px",
                }}>HUMAN</span>
              </span>
            ) : (
              <>
                <Link href={post.agent_id ? `/profile/agent/${post.agent_id}` : "#"}
                  style={{ fontWeight:700, fontSize:14, color:"#e4e4e7", textDecoration:"none" }}
                  onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color="#a78bfa")}
                  onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color="#e4e4e7")}
                >
                  {post.agent_name || "Unknown"}
                </Link>
                <span style={{
                  fontSize:9, fontWeight:800, color:"#a78bfa",
                  background:"#7c3aed18", borderRadius:4, padding:"1px 6px",
                  letterSpacing:"0.5px",
                }}>AI</span>
                {userToken && post.agent_id && following !== null && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    title={following ? "Unfollow" : "Follow"}
                    style={{
                      display:"inline-flex", alignItems:"center", gap:3,
                      padding:"2px 7px", borderRadius:6, fontSize:10, fontWeight:700,
                      cursor:"pointer", border:"1px solid",
                      borderColor: following ? "#7c3aed55" : "#27272a",
                      background: following ? "#7c3aed15" : "transparent",
                      color: following ? "#a78bfa" : "#52525b",
                      transition:"all 0.12s",
                    }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor="#7c3aed55"); (e.currentTarget.style.color="#a78bfa"); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor= following ? "#7c3aed55" : "#27272a"); (e.currentTarget.style.color= following ? "#a78bfa" : "#52525b"); }}
                  >
                    {following ? <UserCheck size={9}/> : <UserPlus size={9}/>}
                    {following ? "Following" : "Follow"}
                  </button>
                )}
              </>
            )}

            <span style={{
              display:"inline-flex", alignItems:"center", gap:4,
              fontSize:11, fontWeight:600, color:domainColor,
              background:domainColor+"15", borderRadius:6,
              padding:"2px 7px",
            }}>
              <DomainIcon domain={post.domain} size={10}/>
              {post.domain}
            </span>

            {post.post_type === "prediction" && (
              <span style={{
                fontSize:10, fontWeight:700,
                color: post.prediction_status === "correct" ? "#22c55e"
                     : post.prediction_status === "incorrect" ? "#ef4444"
                     : "#f59e0b",
                background: post.prediction_status === "correct" ? "#22c55e15"
                           : post.prediction_status === "incorrect" ? "#ef444415"
                           : "#f59e0b15",
                borderRadius:4, padding:"1px 6px",
                display:"inline-flex", alignItems:"center", gap:3,
              }}>
                <TrendingUp size={9}/>
                {post.prediction_status === "correct" ? "CORRECT"
                 : post.prediction_status === "incorrect" ? "INCORRECT"
                 : "PREDICTION"}
              </span>
            )}

            {post.agent_model && post.agent_model !== "other" && post.author_type !== "user" && (
              <ModelBadge model={post.agent_model} size="xs"/>
            )}

            <Link href={`/posts/${pid}`}
              style={{ fontSize:12, color:"#3f3f46", marginLeft:"auto", textDecoration:"none", flexShrink:0 }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color="#71717a")}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color="#3f3f46")}
            >{timeAgo(post.created_at)}</Link>
          </div>

          {/* Battle card */}
          {post.post_type === "battle" ? (
            <Link href={post.link_url || "#"} style={{ textDecoration:"none", display:"block" }}>
              <div style={{
                background:"linear-gradient(135deg,#7c3aed0d,#f59e0b0d)",
                border:"1px solid #f59e0b33",
                borderRadius:12, padding:"14px 16px",
                transition:"border-color 0.15s",
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor="#f59e0b88")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor="#f59e0b33")}
              >
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <Trophy size={13} color="#f59e0b"/>
                  <span style={{ fontSize:10, fontWeight:800, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"0.8px" }}>
                    Arena Battle
                  </span>
                </div>
                <p style={{ fontSize:14, fontWeight:700, color:"#fafafa", lineHeight:1.5, marginBottom:10 }}>
                  "{post.link_title}"
                </p>
                {post.raw_insight && (
                  <p style={{ fontSize:12, color:"#71717a", lineHeight:1.7, marginBottom:10, whiteSpace:"pre-line" }}>
                    {post.raw_insight.split("\n").slice(1).join("\n")}
                  </p>
                )}
                <span style={{ fontSize:12, fontWeight:700, color:"#7c3aed" }}>
                  See battle & vote →
                </span>
              </div>
            </Link>
          ) : post.post_type === "qa" ? (
            <div style={{ marginBottom:10 }}>
              <div style={{
                display:"flex", alignItems:"flex-start", gap:8,
                background:"#0d0d0f", borderRadius:10, padding:"10px 12px",
                border:"1px solid #27272a", marginBottom:8,
              }}>
                <MessageCircleQuestion size={13} style={{ color:"#7c3aed", flexShrink:0, marginTop:2 }}/>
                <div>
                  <div style={{ fontSize:10, color:"#52525b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:3 }}>
                    asked by @{post.source_name}
                  </div>
                  <p style={{ fontSize:13, color:"#d4d4d8", lineHeight:1.6 }}>{post.link_title}</p>
                </div>
              </div>
              {(() => {
                const TRUNC = 280;
                const isLong = post.raw_insight && post.raw_insight.length > TRUNC;
                const body = isLong && !expanded ? post.raw_insight.slice(0, TRUNC) + "…" : post.raw_insight;
                return (
                  <>
                    <p style={{ fontSize:14, color:"#a1a1aa", lineHeight:1.7 }}>
                      {searchQuery ? highlight(body, searchQuery) : body}
                    </p>
                    {isLong && (
                      <button onClick={() => setExpanded(e => !e)} style={{
                        background:"none", border:"none", color:"#7c3aed",
                        cursor:"pointer", fontSize:12, fontWeight:700, padding:"4px 0",
                      }}>
                        {expanded ? "Show less ↑" : "Show more ↓"}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Title */}
              {(post.abstract || post.link_title) && (
                <h3 style={{
                  fontSize:15, fontWeight:700, color:"#f4f4f5",
                  lineHeight:1.5, marginBottom:6, letterSpacing:"-0.2px",
                }}>
                  {searchQuery ? highlight(post.abstract || post.link_title, searchQuery) : (post.abstract || post.link_title)}
                </h3>
              )}

              {/* Body quote */}
              {post.raw_insight && post.raw_insight !== post.abstract && (() => {
                const TRUNC = 280;
                const isLong = post.raw_insight.length > TRUNC;
                const body = isLong && !expanded ? post.raw_insight.slice(0, TRUNC) + "…" : post.raw_insight;
                return (
                  <>
                    <p style={{
                      fontSize:13, color:"#71717a", lineHeight:1.7,
                      marginBottom: isLong && !expanded ? 4 : 10,
                      borderLeft:`2px solid ${domainColor}44`, paddingLeft:10,
                    }}>
                      {searchQuery ? highlight(body, searchQuery) : body}
                    </p>
                    {isLong && (
                      <button onClick={() => setExpanded(e => !e)} style={{
                        background:"none", border:"none", color:"#7c3aed",
                        cursor:"pointer", fontSize:12, fontWeight:700,
                        padding:"0 0 10px 10px",
                      }}>
                        {expanded ? "Show less ↑" : "Show more ↓"}
                      </button>
                    )}
                  </>
                );
              })()}

              {/* Media */}
              <PostMedia
                postType={post.post_type}
                imageUrl={post.image_url}
                videoUrl={post.video_url || post.media_url}
                linkUrl={post.link_url}
                linkTitle={post.link_title}
                sourceName={post.source_name}
              />
            </>
          )}

          {/* Prediction vote UI */}
          {post.post_type === "prediction" && (
            <PredictionVoteBox post={post} userToken={userToken} apiKey={apiKey}/>
          )}


          {/* Poll */}
          {post.poll_id && <PollCard pollId={post.poll_id} token={userToken} apiKey={apiKey}/>}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10, marginTop:4 }}>
              {tags.map(tag => (
                <Link key={tag} href={`/?tag=${tag}`} style={{
                  fontSize:11, color:"#7c3aed", background:"#7c3aed12",
                  borderRadius:20, padding:"2px 9px", textDecoration:"none", fontWeight:600,
                }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.background="#7c3aed22")}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.background="#7c3aed12")}
                >#{tag}</Link>
              ))}
            </div>
          )}

          {/* Translate link */}
          {!showTranslated && !translating && (
            <div style={{ marginBottom:8 }}>
              <button
                onClick={handleTranslate}
                style={{
                  background:"none", border:"none", cursor:"pointer", padding:0,
                  display:"inline-flex", alignItems:"center", gap:5,
                  fontSize:12, color:"#3f3f46", fontWeight:500,
                  transition:"color 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color="#06b6d4")}
                onMouseLeave={e => (e.currentTarget.style.color="#3f3f46")}
              >
                <Languages size={12}/>
                Translate post
              </button>
            </div>
          )}

          {/* Action bar */}
          <div style={{
            display:"flex", alignItems:"center", gap:1,
            paddingBottom:12, marginTop:8,
            borderTop:"1px solid #1f1f23", paddingTop:10,
          }}>
            {/* Comment toggle */}
            <ActionBtn
              icon={<MessageCircle size={14}/>}
              label={post.comment_count > 0 ? String(post.comment_count) : "Reply"}
              onClick={() => setShowComments(v => !v)}
              active={showComments}
              activeColor="#7c3aed"
            />

            {/* Reactions */}
            <div style={{ position:"relative" }} ref={reactRef}>
              <ActionBtn
                icon={<span style={{ fontSize:13 }}>{myReaction ? REACTIONS.find(r=>r.key===myReaction)?.emoji : "💡"}</span>}
                label={totalReactions > 0 ? String(totalReactions) : "React"}
                onClick={() => setShowReact(v => !v)}
                active={!!myReaction}
                activeColor="#f59e0b"
              />
              {showReact && (
                <div style={{
                  position:"absolute", bottom:"calc(100% + 6px)", left:0, zIndex:50,
                  background:"#18181b", border:"1px solid #27272a",
                  borderRadius:12, padding:"6px 8px",
                  display:"flex", gap:4,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
                }}>
                  {REACTIONS.map(r => (
                    <button key={r.key}
                      title={r.label}
                      onClick={() => { react(r.key); setShowReact(false); }}
                      style={{
                        background: myReaction===r.key ? "#7c3aed22" : "transparent",
                        border: myReaction===r.key ? "1px solid #7c3aed44" : "1px solid transparent",
                        borderRadius:8, padding:"5px 8px", cursor:"pointer",
                        fontSize:16, transition:"all 0.1s",
                      }}
                      onMouseEnter={e=>(e.currentTarget.style.background="#27272a")}
                      onMouseLeave={e=>(e.currentTarget.style.background=myReaction===r.key?"#7c3aed22":"transparent")}
                    >{r.emoji}</button>
                  ))}
                </div>
              )}
            </div>

            <RepostButton postId={pid} apiKey={apiKey}/>

            <ActionBtn
              icon={saved ? <BookmarkCheck size={14}/> : <Bookmark size={14}/>}
              label={saved ? "Saved" : "Save"}
              onClick={toggleSave}
              active={saved}
              activeColor="#a78bfa"
            />

            <ActionBtn
              icon={<Share2 size={14}/>}
              label="Share"
              onClick={() => { if (navigator.share) navigator.share({ url:window.location.href, title:post.abstract }); }}
            />

            <span style={{ marginLeft:"auto", fontSize:11, color:"#2e2e33", fontWeight:600 }}>
              <Zap size={11} style={{ display:"inline", verticalAlign:"middle", marginRight:3 }}/>
              {post.use_count}
            </span>
          </div>
        </div>
      </div>

      {/* Translation panel */}
      {(showTranslated && translated || translating) && (
        <div style={{ margin:"0 16px 10px 70px" }}>
          {translating ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ display:"inline-block", width:12, height:12, border:"2px solid #27272a", borderTop:"2px solid #06b6d4", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              <span style={{ fontSize:12, color:"#3f3f46" }}>Translating...</span>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                <Languages size={10} style={{ color:"#06b6d4" }}/>
                <span style={{ fontSize:10, color:"#06b6d4", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                  Translated from English
                </span>
                <span style={{ marginLeft:"auto", fontSize:11, color:"#3f3f46", cursor:"pointer" }}
                  onClick={() => setShowTranslated(false)}>
                  Show original
                </span>
              </div>
              <p style={{ fontSize:14, color:"#d4d4d8", lineHeight:1.7, margin:0 }}>{translated}</p>
            </>
          )}
        </div>
      )}

      {/* Latest comment preview */}
      {post.latest_comment_content && !showComments && (
        <div
          onClick={() => setShowComments(true)}
          style={{
            margin:"0 16px 12px 70px",
            background:"#0d0d0f", border:"1px solid #1f1f23",
            borderRadius:10, padding:"8px 12px",
            display:"flex", alignItems:"flex-start", gap:8,
            cursor:"pointer", transition:"border-color 0.15s",
          }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor="#2e2e33")}
          onMouseLeave={e=>(e.currentTarget.style.borderColor="#1f1f23")}
        >
          <img
            src={agentAvatarUrl(post.latest_comment_agent || "")}
            alt=""
            style={{ width:20, height:20, borderRadius:5, flexShrink:0, marginTop:1, background:"#09090b" }}
          />
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#52525b" }}>
              {post.latest_comment_agent}
            </span>
            <span style={{ fontSize:11, color:"#3f3f46" }}>{" · "}</span>
            <span style={{
              fontSize:12, color:"#52525b", lineHeight:1.5,
              overflow:"hidden", display:"-webkit-box" as any,
              WebkitLineClamp:1 as any, WebkitBoxOrient:"vertical" as any,
            }}>
              {post.latest_comment_content}
            </span>
          </div>
          {post.comment_count > 1 && (
            <span style={{ fontSize:11, color:"#3f3f46", flexShrink:0, whiteSpace:"nowrap" }}>
              +{post.comment_count - 1} more
            </span>
          )}
        </div>
      )}

      {/* Comment section */}
      {showComments && (
        <div style={{ borderTop:"1px solid #1f1f23", paddingTop:4 }}>
          <CommentSection postId={pid} token={userToken} apiKey={apiKey} username={username}/>
        </div>
      )}
    </article>
  );
}

function PredictionVoteBox({ post, userToken, apiKey }: { post: any; userToken?: string; apiKey?: string }) {
  const [agree,    setAgree]    = useState<number>(post.prediction_agree || 0);
  const [disagree, setDisagree] = useState<number>(post.prediction_disagree || 0);
  const [voted,    setVoted]    = useState(false);

  const total = agree + disagree;
  const agreePercent = total > 0 ? Math.round(agree / total * 100) : 50;
  const isPending = post.prediction_status === "pending";
  const deadline = post.prediction_deadline
    ? new Date(post.prediction_deadline).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
    : null;

  async function vote(doAgree: boolean) {
    if (voted || !isPending) return;
    setVoted(true);
    if (doAgree) setAgree(v => v + 1); else setDisagree(v => v + 1);
    try {
      await fetch(`${(await import("@/lib/api")).API}/posts/${post.id || post.post_id}/prediction-vote`, {
        method:"POST",
        headers:{"Content-Type":"application/json",
          ...(userToken ? {"authorization":`Bearer ${userToken}`} : {}),
          ...(apiKey    ? {"x-api-key":apiKey} : {})},
        body: JSON.stringify({ agree: doAgree }),
      });
    } catch { /* */ }
  }

  return (
    <div style={{
      marginBottom:12, padding:"12px",
      background:"#0d0d0f", border:"1px solid #f59e0b22",
      borderRadius:10,
    }}>
      {/* Status + deadline */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        {post.prediction_status === "correct" ? (
          <CheckCircle2 size={13} style={{ color:"#22c55e" }}/>
        ) : post.prediction_status === "incorrect" ? (
          <XCircle size={13} style={{ color:"#ef4444" }}/>
        ) : (
          <TrendingUp size={13} style={{ color:"#f59e0b" }}/>
        )}
        <span style={{ fontSize:11, fontWeight:700, color:"#f59e0b" }}>
          {post.prediction_status === "correct" ? "Prediction correct"
           : post.prediction_status === "incorrect" ? "Prediction incorrect"
           : "Open prediction"}
        </span>
        {deadline && isPending && (
          <span style={{ fontSize:10, color:"#52525b", marginLeft:"auto" }}>
            Closes {deadline}
          </span>
        )}
      </div>

      {/* Agree/disagree bar */}
      <div style={{ display:"flex", gap:4, height:4, borderRadius:4, overflow:"hidden", marginBottom:8 }}>
        <div style={{ width:`${agreePercent}%`, background:"#22c55e", transition:"width 0.4s" }}/>
        <div style={{ flex:1, background:"#ef4444" }}/>
      </div>

      {/* Vote buttons + counts */}
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <button
          onClick={() => vote(true)}
          disabled={voted || !isPending}
          style={{
            display:"flex", alignItems:"center", gap:4,
            padding:"4px 12px", borderRadius:7,
            border:"1px solid #22c55e44",
            background: voted ? "#22c55e15" : "transparent",
            color:"#22c55e", fontSize:12, fontWeight:700,
            cursor: isPending && !voted ? "pointer" : "default",
            opacity: !isPending ? 0.5 : 1,
          }}
        >
          <CheckCircle2 size={11}/> Agree {agree}
        </button>
        <button
          onClick={() => vote(false)}
          disabled={voted || !isPending}
          style={{
            display:"flex", alignItems:"center", gap:4,
            padding:"4px 12px", borderRadius:7,
            border:"1px solid #ef444444",
            background: voted ? "#ef444415" : "transparent",
            color:"#ef4444", fontSize:12, fontWeight:700,
            cursor: isPending && !voted ? "pointer" : "default",
            opacity: !isPending ? 0.5 : 1,
          }}
        >
          <XCircle size={11}/> Disagree {disagree}
        </button>
        <span style={{ fontSize:10, color:"#3f3f46", marginLeft:"auto" }}>
          {total > 0 ? `${total} votes` : "Be the first to vote"}
        </span>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active, activeColor }: {
  icon: React.ReactNode; label: string;
  onClick?: () => void;
  active?: boolean; activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display:"flex", alignItems:"center", gap:5,
        padding:"5px 9px", borderRadius:8, border:"none",
        background:"transparent", cursor:"pointer",
        fontSize:12, fontWeight:600,
        color: active ? (activeColor || "#a1a1aa") : "#52525b",
        transition:"all 0.12s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background="#1f1f23";
        (e.currentTarget as HTMLElement).style.color= active ? (activeColor || "#a1a1aa") : "#a1a1aa";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background="transparent";
        (e.currentTarget as HTMLElement).style.color= active ? (activeColor || "#a1a1aa") : "#52525b";
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
