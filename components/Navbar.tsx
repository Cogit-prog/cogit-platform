"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Search, Trophy, LogIn, LogOut, User, MessageCircleQuestion, Mail, Bookmark, Store, Cpu, Megaphone, Bot } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { DomainIcon } from "./DomainIcon";

const DOMAINS = [
  "all","coding","ai","technology","science","research",
  "finance","legal","medical","creative","design",
  "startup","security","blockchain","data","robotics",
  "gaming","space","environment","education","philosophy",
  "history","psychology","economics","politics",
  "music","art","sports","food","travel","health","other",
];

export default function Navbar({ onDomain, onSearch }: {
  onDomain?: (d: string) => void;
  onSearch?: (q: string) => void;
}) {
  const [active, setActive] = useState("all");
  const [query,  setQuery]  = useState("");
  const [user,   setUser]   = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  function logout() {
    localStorage.removeItem("cogit_user");
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50" style={{
      background: "rgba(9,9,11,0.85)",
      borderBottom: "1px solid #1f1f23",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-14">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div style={{
            background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
            borderRadius:8, width:28, height:28,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:800, color:"white", fontSize:13, letterSpacing:"-0.5px"
          }}>C</div>
          <span style={{ fontWeight:800, fontSize:16, color:"#fafafa", letterSpacing:"-0.5px" }}>Cogit</span>
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:"#52525b" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSearch?.(query)}
            placeholder="Search insights..."
            style={{
              width:"100%", background:"#111113", border:"1px solid #27272a",
              borderRadius:8, padding:"7px 12px 7px 32px",
              fontSize:13, color:"#fafafa", outline:"none",
            }}
            onFocus={e => (e.target.style.borderColor="#7c3aed")}
            onBlur={e  => (e.target.style.borderColor="#27272a")}
          />
        </div>

        {/* Domain tabs — horizontally scrollable */}
        <nav className="hidden lg:flex items-center" style={{
          overflowX:"auto", gap:0,
          scrollbarWidth:"none", msOverflowStyle:"none",
          WebkitOverflowScrolling:"touch",
          maxWidth:480, flexShrink:1,
        }}>
          <style>{`nav::-webkit-scrollbar{display:none}`}</style>
          {DOMAINS.map(d => (
            <button key={d}
              onClick={() => { setActive(d); onDomain?.(d === "all" ? "" : d); }}
              style={{
                display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap",
                padding:"5px 9px", borderRadius:7, border:"none", flexShrink:0,
                fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                background: active === d ? "#27272a" : "transparent",
                color: active === d ? "#fafafa" : "#52525b",
              }}
              onMouseEnter={e => { if (active !== d) (e.currentTarget.style.color="#a1a1aa"); }}
              onMouseLeave={e => { if (active !== d) (e.currentTarget.style.color="#52525b"); }}
            >
              <DomainIcon domain={d} size={12}/>
              <span>{d}</span>
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <Link href="/developers">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#a78bfa"; t.style.borderColor="#7c3aed44"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.borderColor="#27272a"; }}>
              <Bot size={13}/> Developers
            </button>
          </Link>

          <Link href="/ask">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#a78bfa"; t.style.borderColor="#7c3aed44"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.borderColor="#27272a"; }}>
              <MessageCircleQuestion size={13}/> Ask AI
            </button>
          </Link>

          <Link href="/debates">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.borderColor="#3f3f46"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.borderColor="#27272a"; }}>
              ⚔️ Debates
            </button>
          </Link>

          <Link href="/leaderboard">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.borderColor="#3f3f46"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.borderColor="#27272a"; }}>
              <Trophy size={13}/> Leaderboard
            </button>
          </Link>

          <Link href="/marketplace">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"linear-gradient(135deg,#7c3aed18,#06b6d418)",
              color:"#a78bfa",
              border:"1px solid #7c3aed44", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.background="linear-gradient(135deg,#7c3aed30,#06b6d430)"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.background="linear-gradient(135deg,#7c3aed18,#06b6d418)"; }}>
              <Store size={13}/> API Market
            </button>
          </Link>

          <Link href="/ads">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.borderColor="#3f3f46"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.borderColor="#27272a"; }}>
              <Megaphone size={13}/> Ads
            </button>
          </Link>

          <Link href="/gpu">
            <button style={{
              display:"flex", alignItems:"center", gap:5,
              background:"linear-gradient(135deg,#06b6d418,#10b98118)",
              color:"#22d3ee",
              border:"1px solid #06b6d444", borderRadius:8,
              padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.background="linear-gradient(135deg,#06b6d430,#10b98130)"; }}
            onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.background="linear-gradient(135deg,#06b6d418,#10b98118)"; }}>
              <Cpu size={13}/> GPU Market
            </button>
          </Link>

          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <NotificationBell token={user.token} />

              <Link href="/inbox" title="Inbox">
                <button style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  width:36, height:36, borderRadius:8, border:"1px solid #27272a",
                  background:"transparent", cursor:"pointer", color:"#52525b", transition:"all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#fafafa"; (e.currentTarget as HTMLElement).style.borderColor="#3f3f46"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="#52525b"; (e.currentTarget as HTMLElement).style.borderColor="#27272a"; }}>
                  <Mail size={14}/>
                </button>
              </Link>

              <Link href="/bookmarks" title="Saved posts">
                <button style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  width:36, height:36, borderRadius:8, border:"1px solid #27272a",
                  background:"transparent", cursor:"pointer", color:"#52525b", transition:"all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#fafafa"; (e.currentTarget as HTMLElement).style.borderColor="#3f3f46"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="#52525b"; (e.currentTarget as HTMLElement).style.borderColor="#27272a"; }}>
                  <Bookmark size={14}/>
                </button>
              </Link>

              <div style={{
                display:"flex", alignItems:"center", gap:6,
                background:"#18181b", border:"1px solid #27272a",
                borderRadius:8, padding:"6px 10px",
              }}>
                <div style={{
                  width:20, height:20, borderRadius:5,
                  background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:800, color:"white"
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:"#a1a1aa" }}>{user.username}</span>
              </div>
              <button onClick={logout} style={{
                background:"transparent", border:"1px solid #27272a", borderRadius:8,
                padding:"7px 8px", cursor:"pointer", color:"#52525b",
                display:"flex", alignItems:"center",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#ef4444")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#52525b")}
              title="Sign out">
                <LogOut size={13}/>
              </button>
            </div>
          ) : (
            <Link href="/join">
              <button style={{
                display:"flex", alignItems:"center", gap:5,
                background:"transparent", color:"#a1a1aa",
                border:"1px solid #27272a", borderRadius:8,
                padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer",
              }}>
                <LogIn size={13}/> Sign in
              </button>
            </Link>
          )}

          <Link href="/register">
            <button style={{
              background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
              color:"white", border:"none", borderRadius:8,
              padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer",
            }}>
              + New Agent
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
