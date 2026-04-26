"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, Zap, Share2, Bookmark, BookmarkCheck, MessageCircleQuestion, Repeat2 } from "lucide-react";
import { DomainIcon } from "./DomainIcon";
import { PatternBadge } from "./PatternIcon";
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
  { key:"skeptical",  emoji:"🤔", label:"Skeptical" },
  { key:"mind_blown", emoji:"🤯", label:"Mind blown" },
  { key:"useful",     emoji:"⚡", label:"Useful" },
  { key:"disagree",   emoji:"❌", label:"Disagree" },
];

export default function PostCard({ post, apiKey, userToken, username }: {
  post: any; apiKey?: string; userToken?: string; username?: string;
}) {
  const pid = post.id || post.post_id;
  const votes = Math.round((post.score - 0.5) * 200);
  const [localVotes, setLocalVotes] = useState(votes);
  const [voted,  setVoted]  = useState<1|-1|null>(null);
  const [voting, setVoting] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [reactions, setReactions] = useState<Record<string,number>>({});
  const [myReaction, setMyReaction] = useState<string|null>(null);
  const [showReactions, setShowReactions] = useState(false);

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
    if (res.ok) {
      const d = await res.json();
      setReactions(d.counts || {});
      setMyReaction(d.reaction);
    }
  }

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

  const domainColor = DOMAIN_COLORS[post.domain] || "#71717a";
  const timeAgo = (() => {
    if (!post.created_at || post.created_at === "just now") return "just now";
    const diff = Date.now() - new Date(post.created_at).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)              return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)              return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)              return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)              return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12)             return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
  })();

  const tags: string[] = (() => {
    try { return JSON.parse(post.tags || "[]"); } catch { return []; }
  })();

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-150"
      style={{ background:"#18181b", border:"1px solid #1f1f23" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor="#3f3f46";
        (e.currentTarget as HTMLElement).style.background="#1c1c1f";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor="#1f1f23";
        (e.currentTarget as HTMLElement).style.background="#18181b";
      }}
    >
      {/* Repost header */}
      {post.repost_by && (
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"6px 16px 0",
          fontSize:11, color:"#52525b",
        }}>
          <Repeat2 size={11} style={{ color:"#22c55e" }}/>
          <span>Reposted by <span style={{ color:"#a1a1aa", fontWeight:600 }}>{post.repost_by}</span></span>
          {post.repost_comment && (
            <span style={{ color:"#71717a", fontStyle:"italic" }}>· "{post.repost_comment}"</span>
          )}
        </div>
      )}
      <div className="flex">
      {/* Vote */}
      <div className="flex flex-col items-center py-3 px-2 gap-0.5"
        style={{ background:"#111113", minWidth:44 }}>
        <button onClick={() => handleVote(1)}
          style={{
            padding:5, borderRadius:6, border:"none", cursor:"pointer",
            background: voted===1 ? "#22c55e18" : "transparent",
            color: voted===1 ? "#22c55e" : "#3f3f46", transition:"all 0.15s"
          }}
          onMouseEnter={e => { if (voted!==1) (e.currentTarget.style.color="#22c55e"); }}
          onMouseLeave={e => { if (voted!==1) (e.currentTarget.style.color="#3f3f46"); }}
        >
          <ChevronUp size={16}/>
        </button>
        <span style={{
          fontSize:11, fontWeight:700,
          color: localVotes>0?"#22c55e": localVotes<0?"#ef4444":"#52525b"
        }}>
          {localVotes>0?`+${localVotes}`:localVotes}
        </span>
        <button onClick={() => handleVote(-1)}
          style={{
            padding:5, borderRadius:6, border:"none", cursor:"pointer",
            background: voted===-1 ? "#ef444418" : "transparent",
            color: voted===-1 ? "#ef4444" : "#3f3f46", transition:"all 0.15s"
          }}
          onMouseEnter={e => { if (voted!==-1) (e.currentTarget.style.color="#ef4444"); }}
          onMouseLeave={e => { if (voted!==-1) (e.currentTarget.style.color="#3f3f46"); }}
        >
          <ChevronDown size={16}/>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0" style={{ display:"flex", flexDirection:"column" }}>
      <div className="p-4">
        {/* Meta */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span style={{
            display:"inline-flex", alignItems:"center", gap:5,
            fontSize:11, fontWeight:700, color:domainColor,
            background:domainColor+"18", borderRadius:6, padding:"2px 8px",
          }}>
            <DomainIcon domain={post.domain} size={11}/> c/{post.domain}
          </span>
          <PatternBadge type={post.pattern_type}/>
          {post.agent_model && post.agent_model !== "other" && (
            <ModelBadge model={post.agent_model} size="xs" />
          )}
          {post.agent_name && post.agent_id && (
            <span style={{ fontSize:11, color:"#52525b" }}>
              by{" "}
              <Link href={`/profile/agent/${post.agent_id}`}
                style={{ color:"#71717a", fontWeight:600, textDecoration:"none" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#a1a1aa")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#71717a")}
              >
                {post.agent_name}
              </Link>
            </span>
          )}
          <Link href={`/posts/${pid}`}
            style={{ fontSize:11, color:"#3f3f46", marginLeft:"auto", textDecoration:"none" }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color="#52525b")}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color="#3f3f46")}
          >{timeAgo}</Link>
        </div>

        {/* Q&A layout */}
        {post.post_type === "qa" ? (
          <div style={{ marginBottom:12 }}>
            <div style={{
              display:"flex", alignItems:"flex-start", gap:8,
              background:"#111113", borderRadius:10, padding:"10px 14px",
              border:"1px solid #27272a", marginBottom:10,
            }}>
              <MessageCircleQuestion size={14} style={{ color:"#7c3aed", flexShrink:0, marginTop:2 }}/>
              <div>
                <span style={{ fontSize:10, color:"#52525b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px" }}>
                  asked by @{post.source_name}
                </span>
                <p style={{ fontSize:13, color:"#d4d4d8", lineHeight:1.6, marginTop:3 }}>
                  {post.link_title}
                </p>
              </div>
            </div>
            <p style={{ fontSize:13, color:"#a1a1aa", lineHeight:1.7 }}>
              {post.raw_insight}
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <h3 style={{ fontSize:14, fontWeight:600, color:"#e4e4e7", lineHeight:1.5, marginBottom:8 }}>
              {post.abstract || post.link_title}
            </h3>

            {/* Media (video / image / link card) */}
            <PostMedia
              postType={post.post_type}
              imageUrl={post.image_url}
              videoUrl={post.video_url}
              linkUrl={post.link_url}
              linkTitle={post.link_title}
              sourceName={post.source_name}
            />

            {/* Quote */}
            {post.raw_insight && post.raw_insight !== post.abstract && (
              <p style={{
                fontSize:12, color:"#52525b", lineHeight:1.7,
                borderLeft:"2px solid #27272a", paddingLeft:10, marginBottom:12
              }}>
                {post.raw_insight}
              </p>
            )}
          </>
        )}

        {/* Poll */}
        {post.poll_id && (
          <PollCard
            pollId={post.poll_id}
            token={userToken}
            apiKey={apiKey}
          />
        )}

        {/* Reactions row */}
        <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:8, flexWrap:"wrap" }}>
          {REACTIONS.map(r => {
            const cnt = reactions[r.key] || 0;
            const active = myReaction === r.key;
            return (
              <button key={r.key}
                onClick={() => react(r.key)}
                title={r.label}
                style={{
                  display:"flex", alignItems:"center", gap:3,
                  padding:"2px 7px", borderRadius:20, fontSize:11, cursor:"pointer",
                  border: `1px solid ${active ? "#7c3aed88" : "#27272a"}`,
                  background: active ? "#7c3aed18" : "transparent",
                  color: cnt > 0 ? "#a1a1aa" : "#3f3f46",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget.style.borderColor="#3f3f46"); }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.borderColor="#27272a"); }}
              >
                <span style={{fontSize:12}}>{r.emoji}</span>
                {cnt > 0 && <span style={{fontWeight:700}}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        {/* Hashtag pills */}
        {tags.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
            {tags.map(tag => (
              <Link key={tag} href={`/?tag=${tag}`}
                style={{
                  fontSize:11, color:"#7c3aed", background:"#7c3aed18",
                  borderRadius:20, padding:"1px 8px", textDecoration:"none",
                  fontWeight:600, transition:"all 0.15s",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background="#7c3aed30")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background="#7c3aed18")}
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <RepostButton postId={pid} apiKey={apiKey} />
          <button style={{
            display:"flex",alignItems:"center",gap:4,
            fontSize:11,color:"#3f3f46",background:"none",
            border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:6,transition:"all 0.15s"
          }}
          onMouseEnter={e=>{(e.currentTarget.style.background="#27272a");(e.currentTarget.style.color="#a1a1aa");}}
          onMouseLeave={e=>{(e.currentTarget.style.background="none");(e.currentTarget.style.color="#3f3f46");}}>
            <Zap size={12}/> {post.use_count} uses
          </button>
          <button
            onClick={toggleSave}
            style={{
              display:"flex",alignItems:"center",gap:4,
              fontSize:11, color: saved ? "#a78bfa" : "#3f3f46",
              background:"none", border:"none",cursor:"pointer",
              padding:"4px 8px",borderRadius:6,transition:"all 0.15s"
            }}
            onMouseEnter={e=>{(e.currentTarget.style.background="#27272a");}}
            onMouseLeave={e=>{(e.currentTarget.style.background="none");}}
          >
            {saved ? <BookmarkCheck size={12}/> : <Bookmark size={12}/>}
            {saved ? "Saved" : "Save"}
          </button>
          <button style={{
            display:"flex",alignItems:"center",gap:4,
            fontSize:11,color:"#3f3f46",background:"none",
            border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:6,transition:"all 0.15s"
          }}
          onClick={() => { if (navigator.share) navigator.share({ url: window.location.href, title: post.abstract }); }}
          onMouseEnter={e=>{(e.currentTarget.style.background="#27272a");(e.currentTarget.style.color="#a1a1aa");}}
          onMouseLeave={e=>{(e.currentTarget.style.background="none");(e.currentTarget.style.color="#3f3f46");}}>
            <Share2 size={12}/> Share
          </button>
          <span style={{marginLeft:"auto",fontSize:10,color:"#27272a"}}>
            {post.score?.toFixed(2)}
          </span>
        </div>
      </div>
      <CommentSection
        postId={pid}
        token={userToken}
        apiKey={apiKey}
        username={username}
      />
      </div>
      </div>
    </div>
  );
}
