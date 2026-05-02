"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { TrendingUp, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://web-production-6e86d.up.railway.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCGT(n: number) { return Math.round(n).toLocaleString(); }
function fmtPnl(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString()}`;
}
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cogit_token") ||
    localStorage.getItem("token") ||
    (() => { try { return JSON.parse(localStorage.getItem("cogit_user") || "{}").token; } catch { return null; } })()
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg,#1f1f23 25%,#27272a 50%,#1f1f23 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadPortfolio = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);
    try {
      const res = await fetch(`${API}/markets/portfolio/me`, {
        headers: {
          "authorization": `Bearer ${token}`,
          "x-authorization": `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPositions(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // Portfolio totals
  const totalValue = positions.reduce((sum, p) => sum + (p.current_value_yes ?? 0) + (p.current_value_no ?? 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + (p.cost_basis_yes ?? 0) + (p.cost_basis_no ?? 0), 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.profit_loss ?? 0), 0);
  const pnlPositive = totalPnl >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg,#0d0512 0%,#09090b 100%)",
        borderBottom: "1px solid #1f1f23",
        padding: "40px 0 32px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, left: "20%", width: 400, height: 400, background: "radial-gradient(circle,#7c3aed12 0%,transparent 70%)", pointerEvents: "none" }} />
        <div className="max-w-6xl mx-auto px-4">
          <button
            onClick={() => router.push("/markets")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: "#52525b",
              fontSize: 13, cursor: "pointer", padding: 0,
              marginBottom: 20, transition: "color 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#a1a1aa")}
            onMouseLeave={e => (e.currentTarget.style.color = "#52525b")}
          >
            <ArrowLeft size={14} /> Back to Markets
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px #7c3aed44",
            }}>
              <TrendingUp size={22} style={{ color: "white" }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fafafa", letterSpacing: "-0.5px" }}>My Portfolio</h1>
              <p style={{ fontSize: 13, color: "#52525b" }}>Your open prediction market positions</p>
            </div>
          </div>

          {/* Portfolio stats */}
          {!loading && isLoggedIn && positions.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Total Value", value: `${fmtCGT(totalValue)} CGT`, color: "#7c3aed" },
                { label: "Total Cost", value: `${fmtCGT(totalCost)} CGT`, color: "#06b6d4" },
                {
                  label: "Total P&L",
                  value: `${fmtPnl(totalPnl)} CGT`,
                  color: pnlPositive ? "#22c55e" : "#ef4444",
                },
                { label: "Positions", value: positions.length, color: "#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#111113", border: "1px solid #1f1f23",
                  borderRadius: 10, padding: "12px 18px", flexShrink: 0,
                }}>
                  <div style={{ fontSize: 11, color: "#52525b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isLoggedIn ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "60px 24px", textAlign: "center",
          }}>
            <TrendingUp size={48} style={{ color: "#27272a", margin: "0 auto 16px", display: "block" }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              Sign in to view your portfolio
            </div>
            <p style={{ fontSize: 13, color: "#52525b", marginBottom: 24 }}>
              Track your prediction market positions and P&L.
            </p>
            <Link href="/join" style={{
              display: "inline-flex", alignItems: "center",
              padding: "10px 24px", borderRadius: 10,
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              color: "white", fontSize: 13, fontWeight: 700,
              textDecoration: "none",
            }}>
              Sign up / Log in
            </Link>
          </div>
        ) : loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Table skeleton */}
            <div style={{ background: "#111113", border: "1px solid #1f1f23", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f1f23" }}>
                <Skeleton height={13} width="100%" radius={4} />
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid #18181b" }}>
                  <Skeleton height={14} radius={4} />
                  <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                    <Skeleton height={11} width="20%" radius={3} />
                    <Skeleton height={11} width="20%" radius={3} />
                    <Skeleton height={11} width="20%" radius={3} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : positions.length === 0 ? (
          <div style={{
            background: "#111113", border: "1px solid #1f1f23",
            borderRadius: 14, padding: "60px 24px", textAlign: "center",
          }}>
            <TrendingUp size={48} style={{ color: "#27272a", margin: "0 auto 16px", display: "block" }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>
              No positions yet
            </div>
            <p style={{ fontSize: 13, color: "#52525b", marginBottom: 24 }}>
              Buy shares in prediction markets to build your portfolio.
            </p>
            <Link href="/markets" style={{
              display: "inline-flex", alignItems: "center",
              padding: "10px 24px", borderRadius: 10,
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              color: "white", fontSize: 13, fontWeight: 700,
              textDecoration: "none",
            }}>
              Browse Markets
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="fade-up" style={{
              background: "#111113", border: "1px solid #1f1f23",
              borderRadius: 14, overflow: "hidden",
            }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "3fr 100px 100px 110px 110px 100px",
                padding: "12px 20px",
                borderBottom: "1px solid #1f1f23",
                fontSize: 11, fontWeight: 600, color: "#52525b",
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                <span>Market</span>
                <span style={{ textAlign: "right" }}>YES Shares</span>
                <span style={{ textAlign: "right" }}>NO Shares</span>
                <span style={{ textAlign: "right" }}>Current Value</span>
                <span style={{ textAlign: "right" }}>Cost Basis</span>
                <span style={{ textAlign: "right" }}>P&L</span>
              </div>

              {positions.map((pos: any, i: number) => {
                const pnl = pos.profit_loss ?? 0;
                const pnlPos = pnl >= 0;
                const currentVal = (pos.current_value_yes ?? 0) + (pos.current_value_no ?? 0);
                const costBasis = (pos.cost_basis_yes ?? 0) + (pos.cost_basis_no ?? 0);

                return (
                  <div
                    key={pos.market_id ?? i}
                    className="fade-up"
                    style={{
                      animationDelay: `${i * 40}ms`,
                      display: "grid",
                      gridTemplateColumns: "3fr 100px 100px 110px 110px 100px",
                      padding: "16px 20px",
                      borderBottom: i < positions.length - 1 ? "1px solid #18181b" : "none",
                      transition: "background 0.12s", alignItems: "center",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#18181b")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    {/* Market title */}
                    <div style={{ minWidth: 0, paddingRight: 16 }}>
                      <Link
                        href={`/markets/${pos.market_id}`}
                        style={{ textDecoration: "none" }}
                      >
                        <span style={{
                          fontSize: 14, fontWeight: 600, color: "#e4e4e7",
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                          lineHeight: 1.4, cursor: "pointer",
                          transition: "color 0.12s",
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a78bfa")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#e4e4e7")}
                        >
                          {pos.market_title ?? `Market ${pos.market_id}`}
                        </span>
                      </Link>
                    </div>

                    {/* YES shares */}
                    <div style={{ textAlign: "right" }}>
                      {pos.shares_yes > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                          {pos.shares_yes.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "#3f3f46" }}>—</span>
                      )}
                    </div>

                    {/* NO shares */}
                    <div style={{ textAlign: "right" }}>
                      {pos.shares_no > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                          {pos.shares_no.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "#3f3f46" }}>—</span>
                      )}
                    </div>

                    {/* Current value */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}>
                        {fmtCGT(currentVal)} CGT
                      </span>
                    </div>

                    {/* Cost basis */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, color: "#71717a" }}>
                        {fmtCGT(costBasis)} CGT
                      </span>
                    </div>

                    {/* P&L */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: pnlPos ? "#22c55e" : "#ef4444",
                      }}>
                        {fmtPnl(pnl)} CGT
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile card view */}
            <div className="fade-up" style={{ display: "none" }}>
              {/* Hidden — handled by grid collapsing */}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
