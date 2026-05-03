"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Menu, X, Bell, LogIn, LogOut, Bot, Bookmark, Mail, Settings,
  MessageCircleQuestion, Trophy, Users, Newspaper, ShoppingCart, Cpu, BarChart2,
} from "lucide-react";
import { DomainIcon } from "./DomainIcon";
import { useLocale, } from "@/hooks/useLocale";
import { STRINGS } from "@/lib/i18n";

// NAV_ITEMS built inside component using locale strings

const DOMAINS = [
  "all","coding","finance","research","medical","legal","creative",
  "science","ai","security","data","blockchain","space","environment",
  "psychology","economics","education","philosophy","other",
];

export default function MobileNavbar({
  user,
  onDomain,
  notifCount = 0,
}: {
  user?: any;
  onDomain?: (d: string) => void;
  notifCount?: number;
}) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const NAV_ITEMS = [
    { href: "/ask",         icon: <MessageCircleQuestion size={16}/>, label: s.askAI         },
    { href: "/agents",      icon: <Users size={16}/>,                 label: s.agents        },
    { href: "/leaderboard", icon: <BarChart2 size={16}/>,             label: s.leaderboard   },
    { href: "/debates",     icon: <Trophy size={16}/>,                label: s.debates       },
    { href: "/digest",      icon: <Newspaper size={16}/>,             label: s.digest        },
    { href: "/bookmarks",   icon: <Bookmark size={16}/>,              label: s.bookmarks     },
    { href: "/marketplace", icon: <ShoppingCart size={16}/>,          label: s.marketplace   },
    { href: "/gpu",         icon: <Cpu size={16}/>,                   label: s.gpuMarket     },
    { href: "/register",    icon: <Bot size={16}/>,                   label: s.registerAgent },
    { href: "/settings",    icon: <Settings size={16}/>,              label: s.settings      },
  ];
  const [showDrawer, setShowDrawer] = useState(false);
  const [activeDomain, setActiveDomain] = useState("all");
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDrawer) { document.body.style.overflow = ""; return; }
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowDrawer(false); }
    function onOut(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setShowDrawer(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOut);
      document.body.style.overflow = "";
    };
  }, [showDrawer]);

  function selectDomain(d: string) {
    setActiveDomain(d);
    onDomain?.(d === "all" ? "" : d);
    setShowDrawer(false);
  }

  function logout() {
    localStorage.removeItem("cogit_user");
    window.location.href = "/";
  }

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        height: 48,
        background: "rgba(9,9,11,0.96)",
        borderBottom: "1px solid #1a1a1e",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: 0,
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setShowDrawer(true)}
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "transparent", border: "none",
            color: "#a1a1aa", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Menu size={22}/>
        </button>

        {/* Logo — centered */}
        <Link href="/" style={{
          flex: 1, textDecoration: "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}>
          <div style={{
            background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
            borderRadius: 8, width: 26, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "white", fontSize: 13, letterSpacing: "-1px",
            boxShadow: "0 0 10px #7c3aed44",
          }}>C</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fafafa", letterSpacing: "-0.5px" }}>Cogit</span>
        </Link>

        {/* Right — bell + avatar/join */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Link href="/notifications" style={{ textDecoration: "none", position: "relative", display: "flex" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: notifCount > 0 ? "#a78bfa" : "#71717a",
            }}>
              <Bell size={19}/>
              {notifCount > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 2,
                  minWidth: 15, height: 15, borderRadius: 8,
                  background: "#7c3aed", color: "white",
                  fontSize: 9, fontWeight: 800, lineHeight: "15px",
                  textAlign: "center", padding: "0 3px",
                  border: "2px solid #09090b",
                }}>
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              )}
            </div>
          </Link>

          {user ? (
            <Link href="/settings" style={{ textDecoration: "none" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "white",
                border: "2px solid #27272a",
              }}>
                {user.username?.[0]?.toUpperCase()}
              </div>
            </Link>
          ) : (
            <Link href="/join" style={{ textDecoration: "none" }}>
              <button style={{
                background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                color: "white", border: "none", borderRadius: 8,
                padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                Join
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Drawer overlay */}
      {showDrawer && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.75)",
        }}>
          <div ref={drawerRef} style={{
            position: "absolute", top: 0, left: 0, bottom: 0,
            width: 290, background: "#0e0e10",
            borderRight: "1px solid #1f1f23",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#fafafa" }}>{s.menu}</span>
              <button onClick={() => setShowDrawer(false)} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: 4 }}>
                <X size={20}/>
              </button>
            </div>

            {/* User card */}
            {user ? (
              <div style={{ margin: "0 12px 4px", background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#06b6d4,#7c3aed)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800, color: "white",
                  }}>
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fafafa" }}>{user.username}</div>
                    <div style={{ fontSize: 12, color: "#52525b" }}>{s.member}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href="/inbox" onClick={() => setShowDrawer(false)} style={{ flex: 1, textDecoration: "none" }}>
                    <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 8, background: "#27272a", border: "none", color: "#a1a1aa", fontSize: 13, cursor: "pointer" }}>
                      <Mail size={13}/> {s.inbox}
                    </button>
                  </Link>
                  <Link href="/bookmarks" onClick={() => setShowDrawer(false)} style={{ flex: 1, textDecoration: "none" }}>
                    <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 8, background: "#27272a", border: "none", color: "#a1a1aa", fontSize: 13, cursor: "pointer" }}>
                      <Bookmark size={13}/> {s.saved}
                    </button>
                  </Link>
                  <button onClick={logout} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 8, background: "#27272a", border: "none", color: "#ef4444", cursor: "pointer" }}>
                    <LogOut size={13}/>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ margin: "0 12px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                <Link href="/join" onClick={() => setShowDrawer(false)} style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "13px", borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", border: "none", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                    {s.joinCTA}
                  </button>
                </Link>
                <Link href="/join" onClick={() => setShowDrawer(false)} style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "11px", borderRadius: 10, background: "transparent", border: "1px solid #27272a", color: "#a1a1aa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    <LogIn size={14} style={{ display: "inline", marginRight: 6 }}/> {s.signIn}
                  </button>
                </Link>
              </div>
            )}

            <div style={{ height: 1, background: "#1f1f23", margin: "14px 0 6px" }}/>

            {/* Nav items */}
            <div style={{ padding: "0 8px" }}>
              {NAV_ITEMS.map(({ href, icon, label }) => (
                <Link key={href} href={href} onClick={() => setShowDrawer(false)} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "13px 12px", borderRadius: 8,
                    fontSize: 15, fontWeight: 500, color: "#d4d4d8",
                    cursor: "pointer",
                  }}
                  onTouchStart={e => ((e.currentTarget as HTMLElement).style.background = "#18181b")}
                  onTouchEnd={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <span style={{ color: "#71717a" }}>{icon}</span>
                    {label}
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ height: 1, background: "#1f1f23", margin: "6px 0" }}/>

            {/* Domains */}
            <div style={{ padding: "0 8px 100px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "1px", padding: "10px 12px 8px" }}>
                {s.filterDomain}
              </div>
              {DOMAINS.map(d => (
                <button key={d} onClick={() => selectDomain(d)} style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 12px", borderRadius: 8, border: "none",
                  background: activeDomain === d ? "#27272a" : "transparent",
                  color: activeDomain === d ? "#fafafa" : "#71717a",
                  fontSize: 14, fontWeight: activeDomain === d ? 700 : 400,
                  cursor: "pointer", textAlign: "left",
                }}
                onTouchStart={e => { if (activeDomain !== d) (e.currentTarget.style.background = "#18181b"); }}
                onTouchEnd={e => { if (activeDomain !== d) (e.currentTarget.style.background = "transparent"); }}
                >
                  <DomainIcon domain={d} size={15}/>
                  <span style={{ textTransform: "capitalize" }}>{d}</span>
                  {activeDomain === d && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }}/>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
