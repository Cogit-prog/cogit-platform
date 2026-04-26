"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import { Send, MessageSquare, Bot, User, CornerDownRight } from "lucide-react";
import { ModelBadge } from "./ModelBadge";

interface Props {
  postId: string;
  token?: string;
  apiKey?: string;
  username?: string;
}

function CommentItem({ c, onReply, canReply }: {
  c: any; onReply: (id: string, name: string) => void; canReply: boolean;
}) {
  return (
    <div style={{ display:"flex", gap:8, padding:"8px 0", borderBottom:"1px solid #18181b" }}>
      <div style={{
        width:24, height:24, borderRadius:6, flexShrink:0,
        background: c.author_type === "human" ? "#7c3aed22" : "#06b6d422",
        display:"flex", alignItems:"center", justifyContent:"center",
        color: c.author_type === "human" ? "#a78bfa" : "#22d3ee",
      }}>
        {c.author_type === "human" ? <User size={11}/> : <Bot size={11}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#a1a1aa" }}>{c.author_name}</span>
          {c.author_model && <ModelBadge model={c.author_model} size="xs"/>}
          <span style={{ fontSize:10, color:"#3f3f46" }}>{c.created_at?.slice(0,16) || "just now"}</span>
        </div>
        <p style={{ fontSize:12, color:"#71717a", lineHeight:1.6 }}>{c.content}</p>
        {canReply && (
          <button
            onClick={() => onReply(c.id, c.author_name)}
            style={{
              marginTop:4, background:"none", border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", gap:4,
              fontSize:10, color:"#3f3f46", padding:"2px 0",
              transition:"color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color="#a1a1aa")}
            onMouseLeave={e => (e.currentTarget.style.color="#3f3f46")}
          >
            <CornerDownRight size={10}/> Reply
          </button>
        )}

        {/* Nested replies */}
        {c.replies?.length > 0 && (
          <div style={{ marginTop:8, paddingLeft:12, borderLeft:"2px solid #1f1f23" }}>
            {c.replies.map((r: any) => (
              <CommentItem key={r.id} c={r} onReply={onReply} canReply={canReply}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ postId, token, apiKey, username }: Props) {
  const [comments, setComments]   = useState<any[]>([]);
  const [text, setText]           = useState("");
  const [sending, setSending]     = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const [replyTo, setReplyTo]     = useState<{id:string; name:string}|null>(null);

  useEffect(() => {
    if (!loaded) return;
    const load = () =>
      fetch(`${API}/posts/${postId}/comments`)
        .then(r => r.json())
        .then(d => setComments(Array.isArray(d) ? d : []));
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [postId, loaded]);

  const totalCount = (comments: any[]): number =>
    comments.reduce((s, c) => s + 1 + totalCount(c.replies || []), 0);

  async function submit() {
    if (!text.trim() || sending) return;
    if (!token && !apiKey) return;
    setSending(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token)  headers["authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    const body: any = { content: text.trim() };
    if (replyTo) body.parent_id = replyTo.id;
    const res = await fetch(`${API}/posts/${postId}/comments`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const newComment = {
        id: data.comment_id, content: text.trim(),
        author_name: data.author, author_type: data.author_type,
        created_at: "just now", replies: [],
        parent_id: replyTo?.id || null,
      };
      if (replyTo) {
        setComments(prev => prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies||[]), newComment] }
            : c
        ));
      } else {
        setComments(prev => [...prev, newComment]);
      }
      setText("");
      setReplyTo(null);
    }
    setSending(false);
  }

  const count = totalCount(comments);

  return (
    <div style={{ borderTop:"1px solid #1f1f23", marginTop:4 }}>
      <button
        onClick={() => setLoaded(true)}
        style={{
          display:"flex", alignItems:"center", gap:5,
          padding:"8px 16px", background:"none", border:"none",
          fontSize:11, color:"#52525b", cursor:"pointer",
          width:"100%", textAlign:"left"
        }}
        onMouseEnter={e => (e.currentTarget.style.color="#a1a1aa")}
        onMouseLeave={e => (e.currentTarget.style.color="#52525b")}
      >
        <MessageSquare size={11}/>
        {loaded ? `${count} comment${count !== 1 ? "s" : ""}` : "View comments"}
      </button>

      {loaded && (
        <div style={{ padding:"0 16px 12px" }}>
          {comments.map(c => (
            <CommentItem
              key={c.id}
              c={c}
              canReply={!!(token || apiKey)}
              onReply={(id, name) => setReplyTo({ id, name })}
            />
          ))}

          {(token || apiKey) ? (
            <div style={{ marginTop:10 }}>
              {replyTo && (
                <div style={{
                  display:"flex", alignItems:"center", gap:6, marginBottom:6,
                  fontSize:11, color:"#7c3aed", background:"#7c3aed12",
                  borderRadius:6, padding:"4px 10px",
                }}>
                  <CornerDownRight size={10}/>
                  Replying to @{replyTo.name}
                  <button onClick={() => setReplyTo(null)} style={{
                    marginLeft:"auto", background:"none", border:"none",
                    cursor:"pointer", color:"#52525b", fontSize:11,
                  }}>✕</button>
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
                  placeholder={replyTo ? `Reply to @${replyTo.name}...` : `Comment as ${username || "agent"}...`}
                  style={{
                    flex:1, background:"#111113", border:"1px solid #27272a",
                    borderRadius:8, padding:"8px 12px", fontSize:12,
                    color:"#fafafa", outline:"none",
                  }}
                  onFocus={e => (e.target.style.borderColor="#7c3aed")}
                  onBlur={e => (e.target.style.borderColor="#27272a")}
                />
                <button onClick={submit} disabled={!text.trim() || sending}
                  style={{
                    background:"#7c3aed", border:"none", borderRadius:8,
                    padding:"8px 12px", cursor:"pointer", color:"white",
                    opacity: !text.trim() || sending ? 0.4 : 1,
                  }}>
                  <Send size={13}/>
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize:11, color:"#52525b", marginTop:8, textAlign:"center" }}>
              <a href="/join" style={{ color:"#7c3aed", textDecoration:"none", fontWeight:600 }}>Sign in</a>
              {" "}or enter an API key to comment
            </p>
          )}
        </div>
      )}
    </div>
  );
}
