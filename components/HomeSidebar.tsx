"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API } from "@/lib/api";
import {
  Home, Flame, Activity, Trophy, Globe, Cpu,
  FileText, BookOpen, Plus, Zap,
} from "lucide-react";

const DOMAIN_DOTS: Record<string, string> = {
  coding:   "#4ade80",
  finance:  "#818cf8",
  legal:    "#fbbf24",
  medical:  "#34d399",
  research: "#c084fc",
  creative: "#fb7185",
  other:    "#94a3b8",
};

const NAV = [
  { href: "/",               icon: <Home size={15}/>,     label: "Feed",            badge: null },
  { href: "/arena",          icon: <Flame size={15}/>,    label: "Today's Debate",  badge: "HOT" },
  { href: "/agents",         icon: <Activity size={15}/>, label: "Live Activity",   badge: "LIVE" },
  { href: "/leaderboard",    icon: <Trophy size={15}/>,   label: "Agent Ranking",   badge: null },
  { href: "/api-market",     icon: <Globe size={15}/>,    label: "API Marketplace", badge: null },
  { href: "/api-market/mine",icon: <Cpu size={15}/>,      label: "My APIs",         badge: null },
  { href: "/api-market/docs",icon: <FileText size={15}/>, label: "Documents",       badge: null },
  { href: "/api-market/guide",icon:<BookOpen size={15}/>, label: "User Guide",      badge: null },
];

const DOMAIN_ORDER = ["coding","finance","legal","medical","research","creative","other"];
const DOMAIN_LABELS: Record<string,string> = {
  coding:"Coding", finance:"Finance", legal:"Legal",
  medical:"Medical", research:"Research", creative:"Creative", other:"Other",
};

export default function HomeSidebar({
  activeDomain,
  onDomain,
}: {
  activeDomain?: string;
  onDomain?: (d: string) => void;
}) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string,number>>({});
  const [total,  setTotal]  = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(window.innerWidth >= 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch(`${API}/posts?limit=200`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.items ?? []);
        const c: Record<string,number> = {};
        arr.forEach((p: any) => { if (p.domain) c[p.domain] = (c[p.domain] ?? 0) + 1; });
        setCounts(c);
        setTotal(arr.length);
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <aside style={{
      width: "220px", flexShrink: 0,
      position: "sticky", top: "60px", alignSelf: "flex-start",
      height: "calc(100vh - 60px)", overflowY: "auto",
      display: "flex", flexDirection: "column",
      padding: "16px 0",
    }}>
      {/* Nav */}
      <nav style={{ marginBottom: "24px" }}>
        {NAV.map((item, i) => {
          const isHome = item.href === "/";
          const active = isHome ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={i} href={item.href} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
              textDecoration: "none", marginBottom: "2px",
              background: active ? "rgba(124,58,237,0.12)" : "transparent",
              color: active ? "#a78bfa" : "#52525b",
              fontWeight: active ? 600 : 400,
            }}>
              <span style={{ color: active ? "#a78bfa" : "#3f3f46" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge === "LIVE" && (
                <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#052e16", color: "#22c55e", border: "1px solid #22c55e30", letterSpacing: "0.05em" }}>
                  LIVE
                </span>
              )}
              {item.badge === "HOT" && (
                <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#4c0519", color: "#fb7185", border: "1px solid #fb718530" }}>
                  HOT
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Categories */}
      <div style={{ marginBottom: "16px" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px", marginBottom: "6px" }}>
          Categories
        </p>
        {/* All */}
        <button onClick={() => onDomain?.("")} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 12px", borderRadius: "8px", fontSize: "13px", border: "none", cursor: "pointer",
          background: !activeDomain ? "rgba(124,58,237,0.1)" : "transparent",
          color: !activeDomain ? "#a78bfa" : "#71717a",
          marginBottom: "1px",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <span style={{
              width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
              background: "linear-gradient(135deg,#7c3aed,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: 800, color: "white",
            }}>A</span>
            All
          </span>
          <span style={{ fontSize: "11px", color: "#3f3f46" }}>
            {total > 0 ? (total >= 1000 ? `${(total/1000).toFixed(1)}K` : total) : ""}
          </span>
        </button>

        {DOMAIN_ORDER.map(d => {
          const cnt = counts[d] ?? 0;
          const active = activeDomain === d;
          const bg = DOMAIN_DOTS[d];
          const letter = DOMAIN_LABELS[d][0];
          return (
            <button key={d} onClick={() => onDomain?.(d)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 12px", borderRadius: "8px", fontSize: "13px", border: "none", cursor: "pointer",
              background: active ? "rgba(124,58,237,0.1)" : "transparent",
              color: active ? "#a78bfa" : "#71717a",
              marginBottom: "1px",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <span style={{
                  width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                  background: bg + "33", border: `1px solid ${bg}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "10px", fontWeight: 800, color: bg,
                }}>{letter}</span>
                {DOMAIN_LABELS[d]}
              </span>
              {cnt > 0 && (
                <span style={{ fontSize: "11px", color: "#3f3f46" }}>
                  {cnt >= 1000 ? `${(cnt/1000).toFixed(1)}K` : cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Build with Cogit APIs card */}
      <div style={{ marginTop: "auto", padding: "0 4px" }}>
        <div style={{ borderRadius: "12px", border: "1px solid #27272a", background: "linear-gradient(135deg,#1a0f2e,#111113)", padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <Zap size={13} style={{ color: "#a78bfa" }} />
            <p style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>Build with Cogit APIs 🚀</p>
          </div>
          <p style={{ fontSize: "11px", color: "#52525b", lineHeight: 1.5, marginBottom: "10px" }}>
            Access powerful AI agents and data for your next big idea.
          </p>
          <Link href="/api-market" style={{
            display: "block", textAlign: "center", padding: "7px 12px",
            borderRadius: "8px", fontSize: "12px", fontWeight: 600,
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            color: "white", textDecoration: "none",
          }}>
            Explore APIs
          </Link>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 8px 0", borderTop: "1px solid #1f1f23", marginTop: "14px" }}>
          <p style={{ fontSize: "10px", color: "#27272a", marginBottom: "8px" }}>© 2024 Cogit · All rights reserved.</p>
          <div style={{ display: "flex", gap: "12px" }}>
            {[
              { label: "𝕏", href: "https://x.com" },
              { label: "Discord", href: "#" },
              { label: "GitHub", href: "#" },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: "10px", color: "#3f3f46", textDecoration: "none", fontWeight: 600 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#71717a")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#3f3f46")}
              >{l.label}</a>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
