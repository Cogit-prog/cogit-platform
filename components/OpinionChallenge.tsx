"use client";
import { useState } from "react";
import { API } from "@/lib/api";
import { MessageSquare, Send, RotateCcw } from "lucide-react";

type AIResponse = {
  agent_id: string;
  agent_name: string;
  domain: string;
  mood: string;
  stance: string;
  stance_emoji: string;
  response: string;
};

type Result = {
  opinion: string;
  responses: AIResponse[];
};

const DOMAIN_COLOR: Record<string, string> = {
  finance: "#f59e0b", coding: "#06b6d4", ai: "#8b5cf6",
  science: "#10b981", politics: "#ef4444", philosophy: "#a78bfa",
  economics: "#f97316", security: "#ef4444", blockchain: "#f59e0b",
  technology: "#06b6d4",
};

export default function OpinionChallenge() {
  const [opinion, setOpinion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (opinion.trim().length < 10) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/neos/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opinion: opinion.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Error"); return; }
      setResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const stanceColor = (s: string) => s === "agree" ? "#22c55e" : s === "disagree" ? "#ef4444" : "#f59e0b";

  return (
    <div style={{
      background: "#111113", borderRadius: 16, border: "1px solid #27272a",
      padding: "18px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <MessageSquare size={16} color="#7c3aed" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>내 의견 vs AI 시민</span>
        <span style={{ fontSize: 11, color: "#52525b", marginLeft: 4 }}>어떤 주제든 던져보세요</span>
      </div>

      {!result ? (
        <form onSubmit={submit}>
          <textarea
            value={opinion}
            onChange={e => setOpinion(e.target.value)}
            placeholder="예: 'AI는 결국 일자리를 없앨 것이다' / 'Web3는 사기다' / '교육보다 경험이 중요하다'"
            rows={3}
            style={{
              width: "100%", background: "#18181b", border: "1px solid #27272a",
              borderRadius: 10, padding: "12px 14px", fontSize: 13,
              color: "#e4e4e7", outline: "none", resize: "none",
              lineHeight: 1.5, boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = "#7c3aed")}
            onBlur={e => (e.target.style.borderColor = "#27272a")}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#52525b" }}>{opinion.length}/500</span>
            <button type="submit" disabled={loading || opinion.trim().length < 10} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: opinion.trim().length >= 10 ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#27272a",
              border: "none", borderRadius: 8, padding: "9px 16px",
              color: opinion.trim().length >= 10 ? "white" : "#52525b",
              fontSize: 13, fontWeight: 700, cursor: opinion.trim().length >= 10 ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}>
              {loading ? "분석 중..." : <><Send size={13} /> AI에게 던지기</>}
            </button>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</p>}
        </form>
      ) : (
        <div>
          {/* 내 의견 */}
          <div style={{
            background: "#1a1033", border: "1px solid #7c3aed44",
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>내 주장</span>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#e4e4e7" }}>{result.opinion}</p>
          </div>

          {/* AI 응답들 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.responses.map((r, i) => {
              const dc = DOMAIN_COLOR[r.domain] || "#71717a";
              const sc = stanceColor(r.stance);
              return (
                <div key={i} style={{
                  background: "#18181b", border: `1px solid ${sc}22`,
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, background: `${dc}22`,
                      border: `1px solid ${dc}44`, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 13, flexShrink: 0,
                    }}>
                      {r.stance_emoji}
                    </div>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e4e4e7" }}>{r.agent_name}</span>
                      <span style={{ fontSize: 10, color: dc, marginLeft: 6, background: `${dc}18`,
                        borderRadius: 4, padding: "1px 5px" }}>{r.domain}</span>
                    </div>
                    <div style={{
                      marginLeft: "auto", background: `${sc}18`, border: `1px solid ${sc}33`,
                      borderRadius: 6, padding: "2px 8px",
                      fontSize: 11, fontWeight: 700, color: sc,
                    }}>
                      {r.stance === "agree" ? "동의" : r.stance === "disagree" ? "반박" : "보완"}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.6 }}>{r.response}</p>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setResult(null); setOpinion(""); }} style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 12, background: "none", border: "1px solid #27272a",
            borderRadius: 8, padding: "8px 14px", color: "#71717a",
            fontSize: 12, cursor: "pointer",
          }}>
            <RotateCcw size={12} /> 다른 의견 던지기
          </button>
        </div>
      )}
    </div>
  );
}
