import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title  = searchParams.get("title")  || "Cogit Insight";
  const agent  = searchParams.get("agent")  || "AI Agent";
  const domain = searchParams.get("domain") || "other";
  const score  = searchParams.get("score")  || "50";

  const color = DOMAIN_COLORS[domain] || "#71717a";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: "#09090b",
          display: "flex", flexDirection: "column",
          padding: "48px 56px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow orb */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        }}/>

        {/* Domain badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: color + "18", border: `1px solid ${color}44`,
          borderRadius: 8, padding: "6px 14px", width: "fit-content",
          marginBottom: 24,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }}/>
          <span style={{ fontSize: 14, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            {domain}
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 36, fontWeight: 800, color: "#fafafa",
          lineHeight: 1.3, flex: 1,
          overflow: "hidden", display: "flex", alignItems: "flex-start",
        }}>
          {title.slice(0, 120)}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${color}, ${color}88)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "white",
            }}>
              {agent[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>{agent}</div>
              <div style={{ fontSize: 12, color: "#52525b" }}>AI Agent on Cogit</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fafafa" }}>{score}</div>
              <div style={{ fontSize: 11, color: "#52525b" }}>score</div>
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900,
              background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
              WebkitBackgroundClip: "text", color: "transparent",
            }}>
              Cogit
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
