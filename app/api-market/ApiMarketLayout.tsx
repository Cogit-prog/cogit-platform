"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Globe, Cpu, FileText, BarChart3, Plus,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "홈",             href: "/",                    icon: <Home size={14} /> },
  { label: "API Marketplace", href: "/api-market",          icon: <Globe size={14} /> },
  { label: "내 API",         href: "/api-market/mine",     icon: <Cpu size={14} /> },
  { label: "문서",           href: "/api-market/docs",     icon: <FileText size={14} /> },
  { label: "사용 가이드",    href: "/api-market/guide",    icon: <FileText size={14} /> },
  { label: "API 분석",       href: "/api-market/analytics",icon: <BarChart3 size={14} /> },
];

export function ApiMarketSidebar({ counts = {} }: { counts?: Record<string, number> }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setVisible(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!visible) return null;

  return (
    <aside style={{
      display: "flex", flexDirection: "column", width: "200px", flexShrink: 0,
      background: "#090c17", borderRight: "1px solid #141726",
      position: "sticky", top: "60px", alignSelf: "flex-start",
      height: "calc(100vh - 60px)", overflowY: "auto", padding: "16px 8px",
    }}>
      <nav style={{ marginBottom: "20px" }}>
        {NAV_ITEMS.map((item, i) => {
          const active = pathname === item.href || (item.href !== "/" && item.href !== "/api-market" && pathname.startsWith(item.href));
          const exactActive = pathname === item.href;
          const isActive = item.href === "/api-market" ? exactActive : active;
          return (
            <Link key={i} href={item.href} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
              textDecoration: "none", marginBottom: "2px",
              background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
              color: isActive ? "#a5b4fc" : "#4a5270",
              fontWeight: isActive ? 600 : 400,
            }}>
              <span style={{ color: isActive ? "#818cf8" : "#4a5270" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "#2d3250", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px", marginBottom: "8px" }}>
          개발자
        </p>
        <div style={{ borderRadius: "12px", border: "1px solid #1e2235", background: "#0f1117", padding: "12px", marginBottom: "12px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "white", marginBottom: "4px" }}>API를 발행해보세요</p>
          <p style={{ fontSize: "11px", color: "#4a5270", lineHeight: 1.5 }}>
            당신의 API를 등록하고 전 세계에 공개하세요.
          </p>
        </div>
        <Link href="/api-market/create" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          width: "100%", padding: "10px", borderRadius: "12px", fontSize: "13px",
          fontWeight: 600, background: "#6366f1", color: "white", textDecoration: "none",
        }}>
          <Plus size={13} />
          API 등록하기
        </Link>
      </div>
    </aside>
  );
}
