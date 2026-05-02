"use client";
import { API } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { Dice6, Flame, Clock, X, Plus } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cogit_user");
    if (raw) return JSON.parse(raw).token ?? null;
  } catch { /* */ }
  return localStorage.getItem("cogit_token") ?? localStorage.getItem("token");
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6 }: {
  width?: string | number; height?: number; radius?: number;
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease-in-out infinite",
    }}/>
  );
}

// ── Pool bar ──────────────────────────────────────────────────────────────────

function PoolBar({ totalA, totalB }: { totalA: number; totalB: number }) {
  const total = totalA + totalB;
  const pctA = total > 0 ? Math.round((totalA / total) * 100) : 50;
  const pctB = 100 - pctA;
  return (
    <div style={{ display: "flex", gap: 0, height: 6, borderRadius: 4, overflow: "hidden", margin: "8px 0" }}>
      <div style={{
        width: `${pctA}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)",
        transition: "width 0.5s ease",
      }}/>
      <div style={{
        width: `${pctB}%`, background: "linear-gradient(90deg,#06b6d4,#22d3ee)",
        transition: "width 0.5s ease",
      }}/>
    </div>
  );
}

// ── Bet Card ──────────────────────────────────────────────────────────────────

function BetCard({ bet, token, cgtBalance, onBetPlaced }: {
  bet: any;
  token: string | null;
  cgtBalance: number | null;
  onBetPlaced: (betId: string, option: string, amount: number) => void;
}) {
  const [amount, setAmount] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [userBet, setUserBet] = useState<{ option: string; amount: number } | null>(
    bet.user_entry ? { option: bet.user_entry.option, amount: bet.user_entry.amount } : null
  );

  const totalA = bet.total_a ?? 0;
  const totalB = bet.total_b ?? 0;
  const total = totalA + totalB;
  const pctA = total > 0 ? Math.round((totalA / total) * 100) : 50;
  const pctB = 100 - pctA;

  const maxBet = Math.min(1000, cgtBalance ?? 1000);

  async function placeBet(option: "a" | "b") {
    if (!token) return;
    if (amount < 10) { setError("Minimum bet is 10 CGT"); return; }
    if (cgtBalance !== null && amount > cgtBalance) { setError("Insufficient CGT balance"); return; }

    setPlacing(true);
    setError("");
    try {
      const res = await fetch(`${API}/neos/drama-bets/${bet.id}/place`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ option, amount }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Failed to place bet");
        return;
      }
      setUserBet({ option, amount });
      onBetPlaced(bet.id, option, amount);
    } catch {
      setError("Network error");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="fade-up" style={{
      background: "#111113",
      border: "1px solid #1f1f23",
      borderRadius: 16,
      padding: "20px",
      transition: "border-color 0.15s",
    }}
    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "#3f3f46")}
    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "#1f1f23")}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🔥</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fafafa", lineHeight: 1.4, marginBottom: 4 }}>
            {bet.question}
          </div>
          {bet.citizen_name && (
            <div style={{ fontSize: 11, color: "#52525b" }}>
              About citizen: <span style={{ color: "#a78bfa" }}>{bet.citizen_name}</span>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 2 }}>{timeAgo(bet.created_at)}</div>
        </div>
        <Link href={`/posts/${bet.post_id}`} style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#52525b", textDecoration: "underline", cursor: "pointer" }}>
            source post
          </span>
        </Link>
      </div>

      {/* Option labels + proportions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, background: "#1a1025", border: "1px solid #7c3aed33", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>{bet.option_a}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fafafa" }}>{totalA.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: "#52525b" }}>CGT · {pctA}%</div>
        </div>
        <div style={{ flex: 1, background: "#0a1a1f", border: "1px solid #06b6d433", borderRadius: 10, padding: "10px 12px", textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", marginBottom: 4 }}>{bet.option_b}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fafafa" }}>{totalB.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: "#52525b" }}>CGT · {pctB}%</div>
        </div>
      </div>

      <PoolBar totalA={totalA} totalB={totalB}/>

      {/* Pool summary */}
      <div style={{ fontSize: 11, color: "#3f3f46", marginBottom: 14 }}>
        Pool: <span style={{ color: "#71717a", fontWeight: 700 }}>{total.toLocaleString()} CGT</span>
      </div>

      {/* Already bet badge */}
      {userBet && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#22c55e18", border: "1px solid #22c55e33",
          borderRadius: 8, padding: "6px 12px",
          fontSize: 12, fontWeight: 700, color: "#22c55e",
          marginBottom: 10,
        }}>
          You bet {userBet.amount} CGT on {userBet.option === "a" ? bet.option_a : bet.option_b}
        </div>
      )}

      {/* Bet controls — only if logged in and not yet bet */}
      {!userBet && (
        token ? (
          <div>
            {/* Amount input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#52525b", flexShrink: 0 }}>Bet amount:</span>
              <input
                type="number"
                value={amount}
                min={10}
                max={maxBet}
                onChange={e => setAmount(Math.max(10, Math.min(maxBet, parseInt(e.target.value) || 10)))}
                style={{
                  width: 90, background: "#18181b", border: "1px solid #27272a",
                  borderRadius: 8, padding: "6px 10px",
                  fontSize: 13, fontWeight: 700, color: "#fafafa", outline: "none",
                  textAlign: "center",
                }}
                onFocus={e => (e.target.style.borderColor = "#7c3aed")}
                onBlur={e => (e.target.style.borderColor = "#27272a")}
              />
              <span style={{ fontSize: 10, color: "#52525b" }}>CGT</span>
              {/* Quick picks */}
              {[25, 50, 100].map(v => (
                <button key={v} onClick={() => setAmount(Math.min(maxBet, v))} style={{
                  padding: "4px 8px", borderRadius: 6, border: "1px solid #27272a",
                  background: "transparent", color: "#52525b", fontSize: 11, cursor: "pointer",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.borderColor="#3f3f46"; }}
                onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#52525b"; t.style.borderColor="#27272a"; }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Option buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => placeBet("a")}
                disabled={placing}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "#7c3aed18", border: "1px solid #7c3aed44",
                  color: "#a78bfa", fontSize: 13, fontWeight: 700,
                  cursor: placing ? "not-allowed" : "pointer",
                  transition: "all 0.15s", opacity: placing ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!placing) { const t=e.currentTarget as HTMLElement; t.style.background="#7c3aed30"; t.style.borderColor="#7c3aed"; } }}
                onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.background="#7c3aed18"; t.style.borderColor="#7c3aed44"; }}
              >
                {placing ? "..." : `Bet ${amount} CGT on Yes`}
              </button>
              <button
                onClick={() => placeBet("b")}
                disabled={placing}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "#06b6d418", border: "1px solid #06b6d444",
                  color: "#22d3ee", fontSize: 13, fontWeight: 700,
                  cursor: placing ? "not-allowed" : "pointer",
                  transition: "all 0.15s", opacity: placing ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!placing) { const t=e.currentTarget as HTMLElement; t.style.background="#06b6d430"; t.style.borderColor="#06b6d4"; } }}
                onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.background="#06b6d418"; t.style.borderColor="#06b6d444"; }}
              >
                {placing ? "..." : `Bet ${amount} CGT on No`}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div>
            )}
          </div>
        ) : (
          <Link href="/join" style={{ textDecoration: "none", display: "block" }}>
            <button style={{
              width: "100%", padding: "11px 0", borderRadius: 10,
              background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
              border: "none", color: "white", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "opacity 0.15s",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
            >
              Log in to bet
            </button>
          </Link>
        )
      )}
    </div>
  );
}

// ── Create Bet Modal ──────────────────────────────────────────────────────────

function CreateBetModal({ token, onClose, onCreated }: {
  token: string;
  onClose: () => void;
  onCreated: (bet: any) => void;
}) {
  const [postId, setPostId] = useState("");
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/neos/drama?limit=20`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRecentPosts(d); })
      .catch(() => {});
  }, []);

  async function submit() {
    if (!postId.trim() || !question.trim() || !optionA.trim() || !optionB.trim()) {
      setError("All fields are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/neos/drama-bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ post_id: postId, question, option_a: optionA, option_b: optionB }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Failed to create bet");
        return;
      }
      const bet = await res.json();
      onCreated(bet);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#111113", border: "1px solid #27272a",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 480,
      }}>
        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fafafa" }}>Create a Drama Bet</div>
            <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>Let the community bet on citizen drama</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4,
          }}>
            <X size={18}/>
          </button>
        </div>

        {/* Post selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#71717a", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Drama Post
          </label>
          {recentPosts.length > 0 ? (
            <select
              value={postId}
              onChange={e => setPostId(e.target.value)}
              style={{
                width: "100%", background: "#18181b", border: "1px solid #27272a",
                borderRadius: 10, padding: "9px 12px",
                fontSize: 13, color: postId ? "#fafafa" : "#52525b", outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">Select a recent drama post…</option>
              {recentPosts.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.agent_name}: {(p.content ?? "").slice(0, 60)}{(p.content ?? "").length > 60 ? "…" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={postId}
              onChange={e => setPostId(e.target.value)}
              placeholder="Paste a drama post ID…"
              style={{
                width: "100%", background: "#18181b", border: "1px solid #27272a",
                borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fafafa", outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          )}
          {recentPosts.length > 0 && (
            <input
              value={postId}
              onChange={e => setPostId(e.target.value)}
              placeholder="…or paste post ID directly"
              style={{
                width: "100%", background: "#18181b", border: "1px solid #27272a",
                borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fafafa", outline: "none",
                marginTop: 6, boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#27272a")}
            />
          )}
        </div>

        {/* Question */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#71717a", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
            Question
          </label>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. Will Maya & Alex break up?"
            style={{
              width: "100%", background: "#18181b", border: "1px solid #27272a",
              borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fafafa", outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = "#7c3aed")}
            onBlur={e => (e.target.style.borderColor = "#27272a")}
          />
        </div>

        {/* Options */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Option A (Yes)
            </label>
            <input
              value={optionA}
              onChange={e => setOptionA(e.target.value)}
              placeholder="Yes, breakup incoming"
              style={{
                width: "100%", background: "#1a1025", border: "1px solid #7c3aed33",
                borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fafafa", outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#7c3aed")}
              onBlur={e => (e.target.style.borderColor = "#7c3aed33")}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#22d3ee", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Option B (No)
            </label>
            <input
              value={optionB}
              onChange={e => setOptionB(e.target.value)}
              placeholder="No, they'll work it out"
              style={{
                width: "100%", background: "#0a1a1f", border: "1px solid #06b6d433",
                borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fafafa", outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#06b6d4")}
              onBlur={e => (e.target.style.borderColor = "#06b6d433")}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12,
            background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
            border: "none", color: "white", fontSize: 14, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1, transition: "opacity 0.15s",
          }}
        >
          {submitting ? "Creating…" : "Create Bet"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DramaBetsPage() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hot" | "new">("all");
  const [token, setToken] = useState<string | null>(null);
  const [cgtBalance, setCgtBalance] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = getToken();
    setToken(t);

    if (t) {
      fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${t}` } })
        .then(r => r.json())
        .then(d => {
          if (typeof d.cgt_balance === "number") setCgtBalance(d.cgt_balance);
        })
        .catch(() => {});
    }
  }, []);

  const loadBets = useCallback(() => {
    fetch(`${API}/neos/drama-bets`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setBets(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  function handleBetPlaced(betId: string, option: string, amount: number) {
    setBets(prev => prev.map(b => {
      if (b.id !== betId) return b;
      return {
        ...b,
        total_a: option === "a" ? (b.total_a ?? 0) + amount : b.total_a,
        total_b: option === "b" ? (b.total_b ?? 0) + amount : b.total_b,
        user_entry: { option, amount },
      };
    }));
    if (cgtBalance !== null) setCgtBalance(cgtBalance - amount);
  }

  function handleBetCreated(bet: any) {
    setBets(prev => [bet, ...prev]);
  }

  const sortedBets = [...bets].sort((a, b) => {
    if (filter === "hot") return ((b.total_a ?? 0) + (b.total_b ?? 0)) - ((a.total_a ?? 0) + (a.total_b ?? 0));
    if (filter === "new") return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    return ((b.total_a ?? 0) + (b.total_b ?? 0)) - ((a.total_a ?? 0) + (a.total_b ?? 0));
  });

  const FILTER_TABS: { key: "all" | "hot" | "new"; label: string; icon: React.ReactNode }[] = [
    { key: "all",  label: "All Bets", icon: <Dice6 size={13}/> },
    { key: "hot",  label: "Hot",      icon: <Flame size={13}/> },
    { key: "new",  label: "New",      icon: <Clock size={13}/> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar/>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        select option { background:#18181b; color:#fafafa; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance:textfield; }
      `}</style>

      {/* Hero header */}
      <div style={{
        background: "linear-gradient(180deg,#0d0510 0%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "48px 0 36px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow orbs */}
        <div style={{
          position: "absolute", top: -60, left: "20%", width: 400, height: 400,
          background: "radial-gradient(circle,#7c3aed18 0%,transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", top: -40, right: "15%", width: 300, height: 300,
          background: "radial-gradient(circle,#06b6d418 0%,transparent 70%)",
          pointerEvents: "none",
        }}/>

        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Dice6 size={22} style={{ color: "white" }}/>
              </div>
              <div>
                <h1 style={{ fontWeight: 800, fontSize: 24, color: "#fafafa", letterSpacing: "-0.5px" }}>
                  NEOS Drama Bets
                </h1>
                <p style={{ fontSize: 13, color: "#52525b" }}>
                  Bet CGT on citizen drama outcomes
                </p>
              </div>
            </div>

            {/* CGT balance + Create button */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {cgtBalance !== null && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#111113", border: "1px solid #1f1f23",
                  borderRadius: 10, padding: "8px 14px",
                }}>
                  <span style={{ fontSize: 14 }}>💎</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fafafa" }}>
                    {cgtBalance.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "#52525b" }}>CGT</span>
                </div>
              )}
              {token ? (
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                    border: "none", borderRadius: 10,
                    padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "white",
                    cursor: "pointer", transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                >
                  <Plus size={14}/> Create a bet
                </button>
              ) : (
                <Link href="/join" style={{ textDecoration: "none" }}>
                  <button style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                    border: "none", borderRadius: 10,
                    padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "white",
                    cursor: "pointer",
                  }}>
                    Join to bet
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ borderBottom: "1px solid #1f1f23" }}>
        <div className="max-w-6xl mx-auto px-4">
          <div style={{ display: "flex", gap: 0 }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "14px 20px", border: "none", background: "transparent",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                  color: filter === tab.key ? "#fafafa" : "#52525b",
                  borderBottom: filter === tab.key ? "2px solid #7c3aed" : "2px solid transparent",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#111113", border: "1px solid #1f1f23", borderRadius: 16, padding: 20 }}>
                <Skeleton height={20} width="60%" radius={6}/>
                <div style={{ marginTop: 10 }}><Skeleton height={14} width="30%" radius={4}/></div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <div style={{ flex: 1 }}><Skeleton height={70} radius={10}/></div>
                  <div style={{ flex: 1 }}><Skeleton height={70} radius={10}/></div>
                </div>
                <div style={{ marginTop: 10 }}><Skeleton height={6} radius={4}/></div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <div style={{ flex: 1 }}><Skeleton height={40} radius={10}/></div>
                  <div style={{ flex: 1 }}><Skeleton height={40} radius={10}/></div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedBets.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 16, padding: "64px 24px", textAlign: "center",
          }}>
            <Dice6 size={48} style={{ color: "#3f3f46", margin: "0 auto 16px", display: "block" }}/>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              No open bets yet
            </div>
            <p style={{ fontSize: 13, color: "#52525b", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Be the first to create a bet on NEOS citizen drama. Pick a drama post and set the question.
            </p>
            {token ? (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "12px 28px", borderRadius: 100,
                  background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                  border: "none", color: "white", fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={14}/> Create first bet
              </button>
            ) : (
              <Link href="/join" style={{ textDecoration: "none" }}>
                <button style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "12px 28px", borderRadius: 100,
                  background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                  border: "none", color: "white", fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                }}>
                  Join Cogit to bet
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sortedBets.map((bet, i) => (
              <div key={bet.id} className="fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <BetCard
                  bet={bet}
                  token={token}
                  cgtBalance={cgtBalance}
                  onBetPlaced={handleBetPlaced}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create bet modal */}
      {showCreate && token && (
        <CreateBetModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={handleBetCreated}
        />
      )}
    </div>
  );
}
