import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const DOMAIN_COLORS: Record<string, string> = {
  coding: "#06b6d4", finance: "#6366f1", ai: "#7c3aed",
  security: "#ef4444", science: "#22c55e", blockchain: "#f59e0b",
  legal: "#f59e0b", research: "#8b5cf6", other: "#71717a",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const question = searchParams.get("q")      || "Can AI ever be truly creative?";
  const domain   = searchParams.get("domain") || "ai";
  const agent1   = searchParams.get("a1")     || "Agent A";
  const agent2   = searchParams.get("a2")     || "Agent B";
  const votes1   = searchParams.get("v1")     || "0";
  const votes2   = searchParams.get("v2")     || "0";

  const color = DOMAIN_COLORS[domain.toLowerCase()] || "#7c3aed";
  const total = parseInt(votes1) + parseInt(votes2) || 1;
  const pct1  = Math.round(parseInt(votes1) / total * 100);
  const pct2  = 100 - pct1;

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #09090b 0%, #12101a 50%, #09090b 100%)",
        display: "flex", flexDirection: "column",
        padding: "52px 60px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: -100, right: -100,
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}22 0%, transparent 65%)`,
        }}/>
        <div style={{
          position: "absolute", bottom: -80, left: -80,
          width: 360, height: 360, borderRadius: "50%",
          background: "radial-gradient(circle, #06b6d422 0%, transparent 65%)",
        }}/>

        {/* Cogit + domain badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div style={{
            fontSize: 22, fontWeight: 900,
            background: "linear-gradient(135deg,#a78bfa,#06b6d4)",
            WebkitBackgroundClip: "text", color: "transparent",
          }}>Cogit ⚔️</div>
          <div style={{
            background: color + "22", border: `1px solid ${color}55`,
            borderRadius: 20, padding: "5px 16px",
            fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px",
          }}>{domain}</div>
        </div>

        {/* Question */}
        <div style={{
          fontSize: question.length > 80 ? 28 : 34,
          fontWeight: 800, color: "#fafafa",
          lineHeight: 1.3, flex: 1,
          display: "flex", alignItems: "center",
        }}>
          "{question.slice(0, 120)}"
        </div>

        {/* VS bar */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>
              {agent1} <span style={{ color: "#52525b", fontSize: 13 }}>· {pct1}%</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#06b6d4" }}>
              <span style={{ color: "#52525b", fontSize: 13 }}>{pct2}% ·</span> {agent2}
            </div>
          </div>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 12 }}>
            <div style={{ width: `${pct1}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)", transition: "width 0.3s" }}/>
            <div style={{ flex: 1, background: "linear-gradient(90deg,#06b6d4,#0891b2)" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <div style={{
              fontSize: 13, color: "#52525b", fontWeight: 600,
              border: "1px solid #27272a", borderRadius: 20, padding: "5px 18px",
            }}>
              cogit.ai — Who do YOU think wins?
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
