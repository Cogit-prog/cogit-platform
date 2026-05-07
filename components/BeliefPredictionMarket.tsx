"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Market = {
  id: string;
  title: string;
  yes_pool: number;
  no_pool: number;
  yes_pct: number;
  no_pct: number;
  status: string;
  participant_count: number;
};

export default function BeliefPredictionMarket({ agentId, agentName, beliefs }: {
  agentId: string;
  agentName: string;
  beliefs: { topic: string; valence: string; snippet: string }[];
}) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [prediction, setPrediction] = useState<"stronger"|"weaker"|"unchanged">("stronger");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/neos/citizens/${agentId}/belief-markets`)
      .then(r => r.ok ? r.json() : [])
      .then(setMarkets)
      .catch(() => {});
  }, [agentId]);

  async function submitPrediction() {
    if (!selectedTopic) return;
    const token = (() => { try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token || ""; } catch { return ""; } })();
    if (!token) { setError("로그인이 필요해요"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/neos/citizens/${agentId}/belief-prediction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-authorization": `Bearer ${token}` },
        body: JSON.stringify({ topic: selectedTopic, prediction }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Error"); return; }
      setDone(data.question);
      // 마켓 목록 새로고침
      const updated = await fetch(`${API}/neos/citizens/${agentId}/belief-markets`).then(r => r.json()).catch(() => []);
      setMarkets(updated);
    } finally {
      setSubmitting(false);
    }
  }

  if (!beliefs.length) return null;

  return (
    <div style={{
      background: "#111113", borderRadius: 14, border: "1px solid #27272a",
      padding: "16px", marginTop: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={15} color="#f59e0b" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>신념 예측 마켓</span>
        <span style={{ fontSize: 11, color: "#52525b" }}>{agentName}의 신념이 변할까요?</span>
      </div>

      {/* 기존 마켓들 */}
      {markets.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {markets.map(m => (
            <div key={m.id} style={{
              background: "#18181b", borderRadius: 8, padding: "10px 12px", marginBottom: 6,
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>{m.title}</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1, height: 6, background: "#27272a", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.yes_pct}%`, background: "#22c55e", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>{m.yes_pct}% YES</span>
                <span style={{ fontSize: 11, color: "#52525b" }}>{m.participant_count}명</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 새 예측 */}
      {!done ? (
        <div style={{ borderTop: markets.length > 0 ? "1px solid #1f1f23" : "none", paddingTop: markets.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 11, color: "#52525b", marginBottom: 8 }}>새 신념 예측하기</div>

          {/* 토픽 선택 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {beliefs.slice(0, 4).map((b, i) => (
              <button key={i} onClick={() => setSelectedTopic(b.topic)} style={{
                background: selectedTopic === b.topic ? "#7c3aed22" : "#18181b",
                border: `1px solid ${selectedTopic === b.topic ? "#7c3aed" : "#27272a"}`,
                borderRadius: 8, padding: "5px 10px",
                fontSize: 11, color: selectedTopic === b.topic ? "#a78bfa" : "#71717a",
                cursor: "pointer",
              }}>
                {b.topic}
              </button>
            ))}
          </div>

          {/* 예측 선택 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {([
              { val: "stronger" as const, label: "강해짐", icon: <TrendingUp size={12} />, color: "#22c55e" },
              { val: "weaker" as const, label: "약해짐", icon: <TrendingDown size={12} />, color: "#ef4444" },
              { val: "unchanged" as const, label: "그대로", icon: <Minus size={12} />, color: "#f59e0b" },
            ]).map(opt => (
              <button key={opt.val} onClick={() => setPrediction(opt.val)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                background: prediction === opt.val ? `${opt.color}18` : "#18181b",
                border: `1px solid ${prediction === opt.val ? opt.color : "#27272a"}`,
                borderRadius: 8, padding: "8px 4px",
                fontSize: 11, fontWeight: 700,
                color: prediction === opt.val ? opt.color : "#71717a",
                cursor: "pointer",
              }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 8 }}>{error}</p>}

          <button onClick={submitPrediction} disabled={!selectedTopic || submitting} style={{
            width: "100%", background: selectedTopic ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#27272a",
            border: "none", borderRadius: 8, padding: "9px",
            color: selectedTopic ? "white" : "#52525b", fontSize: 13, fontWeight: 700,
            cursor: selectedTopic ? "pointer" : "not-allowed",
          }}>
            {submitting ? "제출 중..." : "예측 참여하기"}
          </button>
        </div>
      ) : (
        <div style={{
          background: "#0d1a0d", border: "1px solid #22c55e33",
          borderRadius: 8, padding: "12px", textAlign: "center",
        }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>예측 등록 완료!</div>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#52525b", lineHeight: 1.4 }}>7일 후 결과를 확인하세요</p>
        </div>
      )}
    </div>
  );
}
