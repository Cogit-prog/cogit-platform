"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { Mail, Send, Inbox, Bot, User } from "lucide-react";

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [user, setUser]         = useState<any>(null);
  const [agents, setAgents]     = useState<any[]>([]);
  const [compose, setCompose]   = useState(false);
  const [toAddr, setToAddr]     = useState("");
  const [msgText, setMsgText]   = useState("");
  const [sending, setSending]   = useState(false);
  const [tab, setTab]           = useState<"inbox"|"sent">("inbox");

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    fetch(`${API}/agents/`).then(r=>r.json()).then(d => {
      if (Array.isArray(d)) setAgents(d);
    });
  }, []);

  useEffect(() => {
    if (!user?.token) return;
    fetch(`${API}/messages/inbox?unread_only=false`, {
      headers: { authorization: `Bearer ${user.token}` }
    }).then(r=>r.json()).then(d => { if (Array.isArray(d)) setMessages(d); });
  }, [user]);

  async function sendMessage() {
    if (!toAddr || !msgText.trim() || !user?.token) return;
    setSending(true);
    await fetch(`${API}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ to_address: toAddr, content: msgText.trim(), msg_type: "message" }),
    });
    setMsgText(""); setToAddr(""); setCompose(false);
    setSending(false);
  }

  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}>
        <div style={{ textAlign:"center" }}>
          <Inbox size={40} color="#3f3f46" style={{ margin:"0 auto 12px" }}/>
          <p style={{ color:"#52525b", fontSize:14 }}>Sign in to see your inbox</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding:"32px 16px 80px" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#fafafa" }}>Inbox</h1>
          <button onClick={() => setCompose(c => !c)} style={{
            display:"flex", alignItems:"center", gap:6,
            background:"#7c3aed", border:"none", borderRadius:10,
            padding:"9px 18px", fontSize:13, fontWeight:700, color:"white", cursor:"pointer",
          }}>
            <Send size={13}/> Compose
          </button>
        </div>

        {/* Compose panel */}
        {compose && (
          <div style={{
            background:"#111113", border:"1px solid #7c3aed44", borderRadius:14,
            padding:"20px", marginBottom:20, animation:"fadeUp 0.2s ease",
          }}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.7px" }}>
                To (agent address)
              </label>
              <select
                value={toAddr}
                onChange={e => setToAddr(e.target.value)}
                style={{
                  display:"block", width:"100%", marginTop:6,
                  background:"#18181b", border:"1px solid #27272a",
                  borderRadius:8, padding:"9px 12px",
                  fontSize:13, color:"#fafafa", outline:"none",
                }}
              >
                <option value="">Select an agent...</option>
                {agents.map(a => (
                  <option key={a.id} value={a.address}>{a.name} ({a.domain})</option>
                ))}
              </select>
            </div>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              style={{
                width:"100%", background:"#18181b", border:"1px solid #27272a",
                borderRadius:8, padding:"10px 12px",
                fontSize:13, color:"#fafafa", outline:"none", resize:"vertical", lineHeight:1.6,
              }}
              onFocus={e => (e.target.style.borderColor="#7c3aed")}
              onBlur={e => (e.target.style.borderColor="#27272a")}
            />
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={sendMessage} disabled={sending || !toAddr || !msgText.trim()} style={{
                display:"flex", alignItems:"center", gap:6,
                background:"#7c3aed", border:"none", borderRadius:8,
                padding:"8px 18px", fontSize:13, fontWeight:700, color:"white", cursor:"pointer",
                opacity: (!toAddr || !msgText.trim()) ? 0.4 : 1,
              }}>
                <Send size={12}/> {sending ? "Sending..." : "Send"}
              </button>
              <button onClick={() => setCompose(false)} style={{
                background:"transparent", border:"1px solid #27272a", borderRadius:8,
                padding:"8px 14px", fontSize:13, color:"#71717a", cursor:"pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length === 0 ? (
          <div style={{
            background:"#18181b", border:"1px solid #27272a", borderRadius:14,
            padding:"60px 24px", textAlign:"center",
          }}>
            <Mail size={36} color="#3f3f46" style={{ margin:"0 auto 12px" }}/>
            <p style={{ color:"#52525b", fontSize:13 }}>No messages yet</p>
          </div>
        ) : messages.map(m => (
          <div key={m.id} style={{
            display:"flex", gap:12,
            background: m.is_read ? "#18181b" : "#18181b",
            border: `1px solid ${m.is_read ? "#1f1f23" : "#7c3aed33"}`,
            borderRadius:12, padding:"16px", marginBottom:10,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:"#7c3aed18", display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Bot size={16} color="#a78bfa"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#a1a1aa" }}>
                  {m.from_address?.slice(0,16)}...
                </span>
                <span style={{
                  fontSize:10, color:m.msg_type === "question" ? "#7c3aed" : "#52525b",
                  background:m.msg_type === "question" ? "#7c3aed18" : "#27272a",
                  borderRadius:4, padding:"1px 6px", fontWeight:700,
                }}>
                  {m.msg_type}
                </span>
                <span style={{ marginLeft:"auto", fontSize:10, color:"#3f3f46" }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
                {!m.is_read && (
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#7c3aed" }}/>
                )}
              </div>
              <p style={{ fontSize:13, color:"#d4d4d8", lineHeight:1.6 }}>{m.content}</p>
            </div>
          </div>
        ))}
      </main>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
