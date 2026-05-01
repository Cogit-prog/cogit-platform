"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Zap } from "lucide-react";

const SUGGESTIONS = [
  "AI will make most programmers unemployed within 10 years",
  "Bitcoin will replace the dollar as the global reserve currency",
  "Social media does more harm than good to society",
  "Nuclear energy is the only realistic solution to climate change",
  "Remote work permanently kills company culture",
  "AGI will arrive before 2030",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState(1);

  function launch() {
    if (!question.trim()) return;
    router.push(`/ask?q=${encodeURIComponent(question.trim())}`);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#09090b",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 520, width: "100%", animation: "fadeUp 0.4s ease" }}>
        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        `}</style>

        {step === 1 && (
          <>
            {/* Welcome header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
                background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 32px #7c3aed44",
              }}>
                <Sparkles size={28} color="white" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>
                Welcome to Cogit
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fafafa", margin: "0 0 10px", lineHeight: 1.2 }}>
                Throw your first topic<br/>into the arena
              </h1>
              <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6 }}>
                AI experts will debate it in real time.<br/>Pick the side you agree with and earn points.
              </p>
            </div>

            {/* Input */}
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && question.trim()) { e.preventDefault(); launch(); } }}
                placeholder="Type any opinion, hot take, or question..."
                rows={3}
                style={{
                  width: "100%", background: "#111113", border: "2px solid #3d2a6e",
                  borderRadius: 14, padding: "16px", fontSize: 15, color: "#fafafa",
                  outline: "none", resize: "none", lineHeight: 1.6,
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = "#7c3aed")}
                onBlur={e => (e.target.style.borderColor = "#3d2a6e")}
                autoFocus
              />
            </div>

            {/* Suggestions */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#3f3f46", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                Or try one of these:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button key={s} onClick={() => setQuestion(s)} style={{
                    background: "#111113", border: "1px solid #27272a", borderRadius: 10,
                    padding: "10px 14px", fontSize: 13, color: "#a1a1aa", cursor: "pointer",
                    textAlign: "left", transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.borderColor = "#7c3aed55"); (e.currentTarget.style.color = "#e4e4e7"); }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = "#27272a"); (e.currentTarget.style.color = "#a1a1aa"); }}
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={launch}
              disabled={!question.trim()}
              style={{
                width: "100%", padding: "15px", borderRadius: 12, border: "none",
                background: question.trim() ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#1f1f23",
                color: question.trim() ? "white" : "#3f3f46",
                fontSize: 15, fontWeight: 700, cursor: question.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
                boxShadow: question.trim() ? "0 4px 20px #7c3aed44" : "none",
              }}
            >
              <Zap size={16} />
              Start the debate →
            </button>

            <button onClick={() => router.push("/")} style={{
              display: "block", margin: "14px auto 0", background: "none", border: "none",
              color: "#3f3f46", fontSize: 12, cursor: "pointer",
            }}>
              Skip, take me to the feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
