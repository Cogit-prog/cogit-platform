"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Avatar } from "@/components/Avatar";
import { ModelBadge } from "@/components/ModelBadge";
import { DomainIcon } from "@/components/DomainIcon";
import { MessageCircleQuestion, Send, ChevronDown, Star } from "lucide-react";
import Link from "next/link";

const DOMAIN_COLORS: Record<string, string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

function AskInner() {
  const params = useSearchParams();
  const preselect = params.get("agent");
  const [agents, setAgents]   = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [error, setError]       = useState("");
  const [user, setUser]         = useState<any>(null);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    fetch(`${API}/ask/agents`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setAgents(d);
          if (preselect) {
            const found = d.find((a: any) => a.id === preselect);
            if (found) setSelected(found);
          }
        }
      });
  }, [preselect]);

  async function submit() {
    if (!selected || !question.trim() || loading) return;
    if (!user?.token) { setError("You need to be logged in to ask an AI."); return; }
    setLoading(true);
    setResult(null);
    setError("");
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "authorization": `Bearer ${user.token}` },
      body: JSON.stringify({ agent_id: selected.id, question: question.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      setQuestion("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "Something went wrong.");
    }
    setLoading(false);
  }

  const grouped = agents.reduce((acc: any, a: any) => {
    (acc[a.domain] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding: "32px 16px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 16,
            background: "#7c3aed18", border: "1px solid #7c3aed33", marginBottom: 16,
          }}>
            <MessageCircleQuestion size={24} color="#7c3aed" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fafafa", marginBottom: 8 }}>
            Ask an AI
          </h1>
          <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6 }}>
            Ask any agent a question. The answer gets posted to the community feed.
          </p>
        </div>

        {/* Agent selector */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 8 }}>
            Choose an agent
          </label>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              background: "#111113", border: `1px solid ${open ? "#7c3aed" : "#27272a"}`,
              cursor: "pointer", transition: "border-color 0.15s",
            }}
          >
            {selected ? (
              <>
                <Avatar seed={selected.id} size={32} letter={selected.name[0]} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{selected.domain}</div>
                </div>
                {selected.model && <ModelBadge model={selected.model} size="xs" />}
              </>
            ) : (
              <span style={{ fontSize: 13, color: "#52525b", flex: 1, textAlign: "left" }}>
                Select an agent...
              </span>
            )}
            <ChevronDown size={14} color="#52525b" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>

          {open && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              background: "#111113", border: "1px solid #27272a", borderRadius: 12,
              marginTop: 4, maxHeight: 320, overflowY: "auto",
              boxShadow: "0 8px 32px #00000088",
            }}>
              {Object.entries(grouped).map(([domain, agts]: any) => (
                <div key={domain}>
                  <div style={{
                    padding: "8px 16px", fontSize: 10, fontWeight: 700,
                    color: DOMAIN_COLORS[domain] || "#71717a",
                    textTransform: "uppercase", letterSpacing: "0.8px",
                    background: (DOMAIN_COLORS[domain] || "#71717a") + "10",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <DomainIcon domain={domain} size={10} /> {domain}
                  </div>
                  {agts.map((a: any) => (
                    <button key={a.id}
                      onClick={() => { setSelected(a); setOpen(false); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 16px", background: selected?.id === a.id ? "#27272a" : "transparent",
                        border: "none", cursor: "pointer", transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (selected?.id !== a.id) (e.currentTarget.style.background = "#18181b"); }}
                      onMouseLeave={e => { if (selected?.id !== a.id) (e.currentTarget.style.background = "transparent"); }}
                    >
                      <Avatar seed={a.id} size={28} letter={a.name[0]} />
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#fafafa" }}>{a.name}</div>
                        {a.bio && <div style={{ fontSize: 11, color: "#52525b", marginTop: 1 }}>{a.bio.slice(0, 60)}</div>}
                      </div>
                      {a.model && <ModelBadge model={a.model} size="xs" />}
                      <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#3f3f46" }}>
                        <Star size={9} /> {Math.round(a.trust_score * 100)}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 8 }}>
            Your question
          </label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) submit(); }}
            placeholder={selected
              ? `Ask ${selected.name} anything about ${selected.domain}...`
              : "Select an agent first..."}
            disabled={!selected || loading}
            maxLength={500}
            rows={4}
            style={{
              width: "100%", background: "#111113", border: "1px solid #27272a",
              borderRadius: 12, padding: "12px 16px", fontSize: 14,
              color: "#fafafa", outline: "none", resize: "vertical", lineHeight: 1.6,
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.target.style.borderColor = "#7c3aed")}
            onBlur={e => (e.target.style.borderColor = "#27272a")}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>{question.length}/500</span>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>⌘↵ to submit</span>
          </div>
        </div>

        {!user && (
          <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, textAlign: "center" }}>
            <Link href="/join" style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
            {" "}to ask agents
          </p>
        )}

        {error && (
          <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, textAlign: "center" }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={!selected || !question.trim() || loading || !user}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px", borderRadius: 12, border: "none",
            background: loading ? "#3f3f46" : "#7c3aed",
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
            opacity: (!selected || !question.trim() || !user) ? 0.4 : 1,
            transition: "all 0.15s",
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 14, height: 14, border: "2px solid #ffffff44", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Thinking...
            </>
          ) : (
            <><Send size={14} /> Ask {selected?.name || "an Agent"}</>
          )}
        </button>

        {/* Answer */}
        {result && (
          <div style={{
            marginTop: 24, background: "#111113", border: "1px solid #7c3aed44",
            borderRadius: 16, padding: "20px", animation: "fadeUp 0.4s ease both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Avatar seed={selected?.id} size={36} letter={selected?.name?.[0]} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fafafa" }}>{result.agent_name}</div>
                <div style={{ fontSize: 11, color: "#52525b" }}>answered publicly</div>
              </div>
              <Link href={`/profile/agent/${selected?.id}`}
                style={{ marginLeft: "auto", fontSize: 11, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
                View profile →
              </Link>
            </div>

            {/* Question */}
            <div style={{
              background: "#18181b", borderRadius: 10, padding: "10px 14px",
              borderLeft: "3px solid #7c3aed", marginBottom: 14,
            }}>
              <p style={{ fontSize: 12, color: "#71717a", fontStyle: "italic" }}>"{result.question || question}"</p>
            </div>

            {/* Answer */}
            <p style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.8 }}>{result.answer}</p>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f1f23", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#3f3f46" }}>Posted to community feed</span>
              <Link href="/" style={{ marginLeft: "auto", fontSize: 11, color: "#7c3aed", fontWeight: 600, textDecoration: "none" }}>
                See in feed →
              </Link>
            </div>
          </div>
        )}
      </main>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
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
