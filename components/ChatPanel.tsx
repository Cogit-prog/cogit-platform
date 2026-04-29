"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle } from "lucide-react";

interface Props {
  domain: string;
  user: any;
  onClose: () => void;
}

export default function ChatPanel({ domain, user, onClose }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input,    setInput]    = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef      = useRef<WebSocket | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load history
    fetch(`${API}/chat/${domain}/history?limit=40`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d); })
      .catch(() => {});

    // Connect WebSocket
    const ws = new WebSocket(`${WS_API}/chat/ws/${domain}`);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setMessages(prev => [...prev.slice(-99), msg]);
      } catch {}
    };
    return () => ws.close();
  }, [domain]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  function send() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;
    const author = user?.username || "visitor";
    wsRef.current.send(JSON.stringify({
      content: input.trim(),
      author,
      author_type: user ? "user" : "guest",
    }));
    setInput("");
  }

  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:100,
      width:340, height:480, borderRadius:18,
      background:"#111113", border:"1px solid #27272a",
      boxShadow:"0 16px 60px #00000099",
      display:"flex", flexDirection:"column",
      animation:"slideUp 0.2s ease both",
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"12px 16px", borderBottom:"1px solid #1f1f23",
        background:"#18181b", borderRadius:"18px 18px 0 0",
      }}>
        <MessageCircle size={14} style={{ color:"#7c3aed" }}/>
        <span style={{ flex:1, fontSize:13, fontWeight:700, color:"#fafafa" }}>
          #{domain} chat
        </span>
        <span style={{
          width:7, height:7, borderRadius:"50%",
          background: connected ? "#22c55e" : "#3f3f46",
          boxShadow: connected ? "0 0 6px #22c55e88" : "none",
        }}/>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#52525b", padding:2 }}>
          <X size={14}/>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign:"center", color:"#3f3f46", fontSize:12, marginTop:40 }}>
            No messages yet. Be the first to say something!
          </div>
        ) : messages.map((m, i) => {
          const isAgent = m.author_type === "agent";
          return (
            <div key={m.id || i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{
                width:24, height:24, borderRadius:7, flexShrink:0,
                background: isAgent ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#27272a",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:800, color:"white",
              }}>
                {(m.author || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, color: isAgent ? "#a78bfa" : "#e4e4e7" }}>
                    {m.author}
                  </span>
                  <span style={{ fontSize:10, color:"#3f3f46" }}>{m.created_at === "just now" ? "just now" : ""}</span>
                </div>
                <div style={{
                  fontSize:12, color:"#a1a1aa", lineHeight:1.5,
                  background:"#18181b", borderRadius:"4px 12px 12px 12px",
                  padding:"7px 10px", display:"inline-block", maxWidth:"100%", wordBreak:"break-word",
                }}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{
        padding:"10px 12px", borderTop:"1px solid #1f1f23",
        display:"flex", gap:8, alignItems:"center",
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={user ? "Type a message..." : "Chat as visitor..."}
          maxLength={300}
          style={{
            flex:1, background:"#18181b", border:"1px solid #27272a",
            borderRadius:8, padding:"8px 12px", fontSize:12,
            color:"#fafafa", outline:"none",
          }}
          onFocus={e => (e.target.style.borderColor="#7c3aed")}
          onBlur={e  => (e.target.style.borderColor="#27272a")}
        />
        <button onClick={send} style={{
          width:34, height:34, borderRadius:8, border:"none",
          background:"#7c3aed", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0,
        }}>
          <Send size={13} color="white"/>
        </button>
      </div>
    </div>
  );
}
