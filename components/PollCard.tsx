"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import { BarChart2 } from "lucide-react";

interface Props {
  pollId: string;
  token?: string;
  apiKey?: string;
}

export default function PollCard({ pollId, token, apiKey }: Props) {
  const [poll, setPoll] = useState<any>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    const headers: Record<string, string> = {};
    if (token)  headers["authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    fetch(`${API}/polls/${pollId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPoll(d); });
  }, [pollId, token, apiKey]);

  async function vote(idx: number) {
    if (!token && !apiKey) return;
    setVoting(true);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token)  headers["authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    const res = await fetch(`${API}/polls/${pollId}/vote`, {
      method: "POST", headers,
      body: JSON.stringify({ option_index: idx }),
    });
    if (res.ok) setPoll(await res.json());
    setVoting(false);
  }

  if (!poll) return null;

  const ended = poll.ends_at && new Date(poll.ends_at) < new Date();
  const winner = poll.vote_counts
    ? poll.vote_counts.indexOf(Math.max(...poll.vote_counts))
    : -1;

  return (
    <div style={{
      background: "#111113", border: "1px solid #27272a", borderRadius: 12,
      padding: "14px 16px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <BarChart2 size={13} color="#7c3aed" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa" }}>{poll.question}</span>
        {ended && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#52525b", fontWeight: 700 }}>CLOSED</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {poll.options?.map((opt: string, i: number) => {
          const pct = poll.percentages?.[i] ?? 0;
          const count = poll.vote_counts?.[i] ?? 0;
          const isMyVote = poll.my_vote === i;
          const isWinner = ended && i === winner;

          return (
            <button
              key={i}
              onClick={() => !ended && !voting && vote(i)}
              disabled={ended || voting}
              style={{
                position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderRadius: 8, cursor: ended ? "default" : "pointer",
                border: `1px solid ${isMyVote ? "#7c3aed88" : isWinner ? "#22c55e44" : "#27272a"}`,
                background: "transparent", transition: "border-color 0.15s",
                textAlign: "left",
              }}
              onMouseEnter={e => { if (!ended) (e.currentTarget.style.borderColor = "#3f3f46"); }}
              onMouseLeave={e => { if (!ended) (e.currentTarget.style.borderColor = isMyVote ? "#7c3aed88" : "#27272a"); }}
            >
              {/* Progress bar */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: isMyVote ? "#7c3aed18" : isWinner ? "#22c55e12" : "#27272a44",
                transition: "width 0.4s ease",
              }} />
              <span style={{
                position: "relative", fontSize: 12,
                color: isMyVote ? "#a78bfa" : isWinner ? "#22c55e" : "#a1a1aa",
                fontWeight: isMyVote || isWinner ? 700 : 400,
              }}>
                {isWinner && "🏆 "}{opt}
              </span>
              <span style={{
                position: "relative", fontSize: 11, fontWeight: 700,
                color: isMyVote ? "#7c3aed" : "#52525b",
              }}>
                {pct}% ({count})
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "#3f3f46", display: "flex", gap: 12 }}>
        <span>{poll.total_votes} vote{poll.total_votes !== 1 ? "s" : ""}</span>
        {poll.ends_at && !ended && (
          <span>Ends {new Date(poll.ends_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
