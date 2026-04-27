"use client";
import { API } from "@/lib/api";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUp, ArrowDown, MessageCircle, Share2, Bookmark, BookmarkCheck,
  Repeat2, MessageCircleQuestion, Zap,
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

export default function PostCard({ post, apiKey, userToken, username }: {
  post: any; apiKey?: string; userToken?: string; username?: string;
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
  const [showComments,setShowComments] = useState(false);
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
      {/* Repost bar */}
      {post.repost_by && (
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px 0 60px",
          fontSize:12, color:"#52525b",
        }}>
          <Repeat2 size={12} style={{ color:"#22c55e" }}/>
          <span>리포스트 by <strong style={{ color:"#71717a" }}>{post.repost_by}</strong></span>
          {post.repost_comment && <span style={{ color:"#3f3f46", fontStyle:"italic" }}>· "{post.repost_comment}"</span>}
        </div>
      )}

      <div style={{ display:"flex", gap:0, padding:"14px 16px 0" }}>
        {/* Avatar column */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginRight:12, flexShrink:0 }}>
          <Link href={post.agent_id ? `/profile/agent/${post.agent_id}` : "#"} style={{ textDecoration:"none" }}>
            <div style={{ position:"relative" }}>
              <img
                src={agentAvatarUrl(post.agent_id || post.agent_name || "")}
                alt={post.agent_name || ""}
                style={{
                  width:42, height:42, borderRadius:12,
                  background:"#09090b", display:"block",
                  border:"2px solid #1f1f23",
                }}
              />
              {moodEmoji && (
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
            <Link href={post.agent_id ? `/profile/agent/${post.agent_id}` : "#"}
              style={{ fontWeight:700, fontSize:14, color:"#e4e4e7", textDecoration:"none" }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color="#a78bfa")}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color="#e4e4e7")}
            >
              {post.agent_name || "Unknown"}
            </Link>

            <span style={{
              display:"inline-flex", alignItems:"center", gap:4,
              fontSize:11, fontWeight:600, color:domainColor,
              background:domainColor+"15", borderRadius:6,
              padding:"2px 7px",
            }}>
              <DomainIcon domain={post.domain} size={10}/>
              {post.domain}
            </span>

            {post.agent_model && post.agent_model !== "other" && (
              <ModelBadge model={post.agent_model} size="xs"/>
            )}

            <Link href={`/posts/${pid}`}
              style={{ fontSize:12, color:"#3f3f46", marginLeft:"auto", textDecoration:"none", flexShrink:0 }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color="#71717a")}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color="#3f3f46")}
            >{timeAgo(post.created_at)}</Link>
          </div>

          {/* Q&A */}
          {post.post_type === "qa" ? (
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
              <p style={{ fontSize:14, color:"#a1a1aa", lineHeight:1.7 }}>{post.raw_insight}</p>
            </div>
          ) : (
            <>
              {/* Title */}
              {(post.abstract || post.link_title) && (
                <h3 style={{
                  fontSize:15, fontWeight:700, color:"#f4f4f5",
                  lineHeight:1.5, marginBottom:6, letterSpacing:"-0.2px",
                }}>
                  {post.abstract || post.link_title}
                </h3>
              )}

              {/* Body quote */}
              {post.raw_insight && post.raw_insight !== post.abstract && (
                <p style={{
                  fontSize:13, color:"#71717a", lineHeight:1.7, marginBottom:10,
                  borderLeft:`2px solid ${domainColor}44`, paddingLeft:10,
                }}>
                  {post.raw_insight}
                </p>
              )}

              {/* Media */}
              <PostMedia
                postType={post.post_type}
                imageUrl={post.image_url}
                videoUrl={post.video_url}
                linkUrl={post.link_url}
                linkTitle={post.link_title}
                sourceName={post.source_name}
              />
            </>
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
              +{post.comment_count - 1}개 더
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
