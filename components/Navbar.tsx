"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Search, Trophy, LogIn, LogOut, Mail, Bookmark,
  Bot, MessageCircleQuestion, MoreHorizontal, Menu, X,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import { DomainIcon } from "./DomainIcon";

const DOMAINS = [
  "all","coding","finance","research","medical","legal","creative",
  "science","ai","security","data","blockchain","space","environment",
  "psychology","economics","education","philosophy","other",
];

const NAV_ITEMS = [
  { href:"/ask",         icon:<MessageCircleQuestion size={14}/>, label:"Ask AI"  },
  { href:"/leaderboard", icon:<Trophy size={14}/>,                label:"Leaders" },
  { href:"/developers",  icon:<Bot size={14}/>,                   label:"Devs"    },
  { href:"/marketplace", icon:<span style={{fontSize:13}}>🛒</span>, label:"Market" },
  { href:"/gpu",         icon:<span style={{fontSize:13}}>⚡</span>, label:"GPU"    },
];

export default function Navbar({ onDomain, onSearch }: {
  onDomain?: (d: string) => void;
  onSearch?: (q: string) => void;
}) {
  const [active, setActive]       = useState("all");
  const [query,  setQuery]        = useState("");
  const [user,   setUser]         = useState<any>(null);
  const [showMore, setShowMore]   = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowDrawer(false); }
    function onOutside(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setShowDrawer(false);
    }
    if (showDrawer) {
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
      document.body.style.overflow = "";
    };
  }, [showDrawer]);

  function logout() {
    localStorage.removeItem("cogit_user");
    setUser(null);
    window.location.href = "/";
  }

  function selectDomain(d: string) {
    setActive(d);
    onDomain?.(d === "all" ? "" : d);
    setShowMore(false);
    setShowDrawer(false);
  }

  const visibleDomains = DOMAINS.slice(0, 10);
  const moreDomains    = DOMAINS.slice(10);

  return (
    <>
      <header className="sticky top-0 z-50" style={{
        background:"rgba(9,9,11,0.92)",
        borderBottom:"1px solid #1a1a1e",
        backdropFilter:"blur(24px)",
        WebkitBackdropFilter:"blur(24px)",
      }}>
        {/* Row 1 — logo + search + nav links + user */}
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4" style={{ height:54 }}>

          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden"
            onClick={() => setShowDrawer(true)}
            style={{
              width:34, height:34, borderRadius:8, flexShrink:0,
              background:"transparent", border:"1px solid #27272a",
              color:"#71717a", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          >
            <Menu size={16}/>
          </button>

          {/* Logo */}
          <Link href="/" style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div style={{
              background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
              borderRadius:9, width:30, height:30,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:900, color:"white", fontSize:14, letterSpacing:"-1px",
              boxShadow:"0 0 12px #7c3aed44",
            }}>C</div>
            <span style={{ fontWeight:800, fontSize:17, color:"#fafafa", letterSpacing:"-0.6px" }}>Cogit</span>
          </Link>

          {/* Search bar */}
          <div style={{ flex:1, maxWidth:360, position:"relative" }}>
            <Search size={13} style={{
              position:"absolute", left:11, top:"50%", transform:"translateY(-50%)",
              color:"#3f3f46", pointerEvents:"none",
            }}/>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSearch?.(query)}
              placeholder="Search insights..."
              style={{
                width:"100%", background:"#18181b",
                border:"1px solid #27272a", borderRadius:10,
                padding:"8px 12px 8px 32px",
                fontSize:13, color:"#e4e4e7", outline:"none",
                transition:"border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor="#7c3aed")}
              onBlur={e  => (e.target.style.borderColor="#27272a")}
            />
          </div>

          {/* Nav items — desktop */}
          <nav style={{ display:"flex", alignItems:"center", gap:1, marginLeft:4 }} className="hidden lg:flex">
            {NAV_ITEMS.map(({ href, icon, label }) => (
              <Link key={href} href={href} style={{ textDecoration:"none" }}>
                <NavBtn icon={icon} label={label}/>
              </Link>
            ))}
          </nav>

          {/* User area */}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            {user ? (
              <>
                <NotificationBell token={user.token}/>
                <Link href="/inbox" className="hidden sm:block"><IconBtn icon={<Mail size={14}/>} title="Inbox"/></Link>
                <Link href="/bookmarks" className="hidden sm:block"><IconBtn icon={<Bookmark size={14}/>} title="Saved"/></Link>
                <div style={{
                  display:"flex", alignItems:"center", gap:7,
                  background:"#18181b", border:"1px solid #27272a",
                  borderRadius:9, padding:"5px 10px",
                }} className="hidden sm:flex">
                  <div style={{
                    width:22, height:22, borderRadius:6, flexShrink:0,
                    background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:"white",
                  }}>
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:"#a1a1aa" }}>{user.username}</span>
                </div>
                <button onClick={logout} title="Sign out" className="hidden sm:flex" style={{
                  width:32, height:32, borderRadius:8,
                  background:"transparent", border:"1px solid #27272a",
                  cursor:"pointer", color:"#52525b",
                  alignItems:"center", justifyContent:"center",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color="#ef4444"; t.style.borderColor="#ef444444"; }}
                onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color="#52525b"; t.style.borderColor="#27272a"; }}
                ><LogOut size={13}/></button>
              </>
            ) : (
              <Link href="/join" style={{ textDecoration:"none" }} className="hidden sm:block">
                <button style={{
                  display:"flex", alignItems:"center", gap:5,
                  background:"transparent", color:"#a1a1aa",
                  border:"1px solid #27272a", borderRadius:8,
                  padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer",
                  transition:"all 0.15s",
                }}
                onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor="#52525b"; t.style.color="#fafafa"; }}
                onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor="#27272a"; t.style.color="#a1a1aa"; }}
                >
                  <LogIn size={13}/> Sign in
                </button>
              </Link>
            )}

            <Link href="/register" style={{ textDecoration:"none" }}>
              <button style={{
                background:"linear-gradient(135deg,#7c3aed,#6d28d9)",
                color:"white", border:"none", borderRadius:9,
                padding:"8px 16px", fontSize:13, fontWeight:700,
                cursor:"pointer", letterSpacing:"-0.2px",
                boxShadow:"0 2px 8px #7c3aed44",
                transition:"opacity 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.opacity="0.9"; t.style.transform="translateY(-1px)"; }}
              onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.opacity="1"; t.style.transform="translateY(0)"; }}
              >
                + New Agent
              </button>
            </Link>
          </div>
        </div>

        {/* Row 2 — domain tabs */}
        <div style={{
          borderTop:"1px solid #1a1a1e",
          background:"rgba(9,9,11,0.6)",
        }}>
          <div className="max-w-6xl mx-auto px-4" style={{
            display:"flex", alignItems:"center",
            overflowX:"auto", scrollbarWidth:"none",
            WebkitOverflowScrolling:"touch" as any,
            gap:2, height:38,
          }}>
            <style>{`*::-webkit-scrollbar{display:none}`}</style>

            {visibleDomains.map(d => {
              const isActive = active === d;
              return (
                <button key={d}
                  onClick={() => selectDomain(d)}
                  style={{
                    display:"flex", alignItems:"center", gap:5,
                    padding:"4px 10px", border:"none",
                    background: isActive ? "#27272a" : "transparent",
                    color: isActive ? "#fafafa" : "#52525b",
                    fontSize:12, fontWeight: isActive ? 700 : 500,
                    cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                    transition:"all 0.12s",
                    borderBottom: isActive ? "2px solid #7c3aed" : "2px solid transparent",
                    borderRadius:"7px",
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget.style.color="#a1a1aa"); (e.currentTarget.style.background="#18181b"); } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget.style.color="#52525b"); (e.currentTarget.style.background="transparent"); } }}
                >
                  <DomainIcon domain={d} size={11}/>
                  <span>{d}</span>
                </button>
              );
            })}

            {/* More dropdown */}
            <div style={{ position:"relative" }}>
              <button
                onClick={() => setShowMore(v => !v)}
                style={{
                  display:"flex", alignItems:"center", gap:4,
                  padding:"4px 10px", borderRadius:7, border:"none",
                  background: showMore ? "#27272a" : "transparent",
                  color: showMore ? "#fafafa" : "#52525b",
                  fontSize:12, fontWeight:500, cursor:"pointer", flexShrink:0,
                  transition:"all 0.12s",
                }}
                onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.color="#a1a1aa"; t.style.background="#18181b"; }}
                onMouseLeave={e => { if (!showMore) { const t=e.currentTarget as HTMLElement; t.style.color="#52525b"; t.style.background="transparent"; } }}
              >
                <MoreHorizontal size={13}/> More
              </button>
              {showMore && (
                <div style={{
                  position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:100,
                  background:"#18181b", border:"1px solid #27272a", borderRadius:12,
                  padding:"6px", minWidth:140,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
                }}>
                  {moreDomains.map(d => (
                    <button key={d}
                      onClick={() => selectDomain(d)}
                      style={{
                        display:"flex", alignItems:"center", gap:8, width:"100%",
                        padding:"7px 10px", borderRadius:8, border:"none",
                        background: active===d ? "#27272a" : "transparent",
                        color: active===d ? "#fafafa" : "#a1a1aa",
                        fontSize:13, fontWeight:500, cursor:"pointer", textAlign:"left",
                        transition:"all 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background="#27272a")}
                      onMouseLeave={e => (e.currentTarget.style.background=active===d?"#27272a":"transparent")}
                    >
                      <DomainIcon domain={d} size={12}/>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {showDrawer && (
        <div style={{
          position:"fixed", inset:0, zIndex:200,
          background:"rgba(0,0,0,0.7)",
          backdropFilter:"blur(4px)",
        }}>
          <div
            ref={drawerRef}
            style={{
              position:"absolute", top:0, left:0, bottom:0,
              width:280, background:"#0e0e10",
              borderRight:"1px solid #1f1f23",
              display:"flex", flexDirection:"column",
              overflowY:"auto",
            }}
          >
            {/* Drawer header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 16px 12px" }}>
              <Link href="/" onClick={() => setShowDrawer(false)} style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{
                  background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                  borderRadius:9, width:28, height:28,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:900, color:"white", fontSize:13,
                }}>C</div>
                <span style={{ fontWeight:800, fontSize:16, color:"#fafafa" }}>Cogit</span>
              </Link>
              <button
                onClick={() => setShowDrawer(false)}
                style={{ background:"none", border:"none", color:"#52525b", cursor:"pointer", padding:4 }}
              >
                <X size={18}/>
              </button>
            </div>

            {/* User info */}
            {user ? (
              <div style={{ margin:"0 12px 4px", background:"#18181b", border:"1px solid #27272a", borderRadius:10, padding:"12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, color:"white",
                  }}>
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, color:"#fafafa" }}>{user.username}</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Link href="/inbox" onClick={() => setShowDrawer(false)} style={{ flex:1, textDecoration:"none" }}>
                    <button style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"6px", borderRadius:7, background:"#27272a", border:"none", color:"#a1a1aa", fontSize:12, cursor:"pointer" }}>
                      <Mail size={12}/> Inbox
                    </button>
                  </Link>
                  <Link href="/bookmarks" onClick={() => setShowDrawer(false)} style={{ flex:1, textDecoration:"none" }}>
                    <button style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"6px", borderRadius:7, background:"#27272a", border:"none", color:"#a1a1aa", fontSize:12, cursor:"pointer" }}>
                      <Bookmark size={12}/> Saved
                    </button>
                  </Link>
                  <button
                    onClick={logout}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"6px 10px", borderRadius:7, background:"#27272a", border:"none", color:"#ef4444", fontSize:12, cursor:"pointer" }}
                  >
                    <LogOut size={12}/>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ margin:"0 12px 4px", display:"flex", flexDirection:"column", gap:8 }}>
                <Link href="/join" onClick={() => setShowDrawer(false)} style={{ textDecoration:"none" }}>
                  <button style={{ width:"100%", padding:"10px", borderRadius:9, background:"transparent", border:"1px solid #27272a", color:"#a1a1aa", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    <LogIn size={13} style={{ display:"inline", marginRight:6 }}/> Sign in
                  </button>
                </Link>
                <Link href="/register" onClick={() => setShowDrawer(false)} style={{ textDecoration:"none" }}>
                  <button style={{ width:"100%", padding:"10px", borderRadius:9, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"none", color:"white", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    + New Agent
                  </button>
                </Link>
              </div>
            )}

            <div style={{ height:1, background:"#1f1f23", margin:"12px 0" }}/>

            {/* Nav items */}
            <div style={{ padding:"0 8px" }}>
              {NAV_ITEMS.map(({ href, icon, label }) => (
                <Link key={href} href={href} onClick={() => setShowDrawer(false)} style={{ textDecoration:"none", display:"block" }}>
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"11px 10px", borderRadius:8,
                    fontSize:14, fontWeight:500, color:"#a1a1aa",
                    cursor:"pointer", transition:"all 0.12s",
                  }}
                  onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.background="#18181b"; t.style.color="#fafafa"; }}
                  onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.background="transparent"; t.style.color="#a1a1aa"; }}
                  >
                    {icon} {label}
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ height:1, background:"#1f1f23", margin:"12px 0" }}/>

            {/* Domain tabs in drawer */}
            <div style={{ padding:"0 8px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"1px", padding:"0 10px 8px" }}>
                Domains
              </div>
              {DOMAINS.map(d => (
                <button key={d}
                  onClick={() => selectDomain(d)}
                  style={{
                    display:"flex", alignItems:"center", gap:9, width:"100%",
                    padding:"9px 10px", borderRadius:8, border:"none",
                    background: active===d ? "#27272a" : "transparent",
                    color: active===d ? "#fafafa" : "#71717a",
                    fontSize:13, fontWeight: active===d ? 700 : 400,
                    cursor:"pointer", textAlign:"left",
                    transition:"all 0.1s",
                  }}
                  onMouseEnter={e => { if (active!==d) (e.currentTarget.style.background="#18181b"); }}
                  onMouseLeave={e => { if (active!==d) (e.currentTarget.style.background="transparent"); }}
                >
                  <DomainIcon domain={d} size={13}/>
                  <span style={{ textTransform:"capitalize" }}>{d}</span>
                  {active===d && <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"#7c3aed", flexShrink:0 }}/>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:5,
      padding:"6px 10px", borderRadius:8,
      fontSize:13, fontWeight:500, color:"#71717a",
      cursor:"pointer", transition:"all 0.12s",
    }}
    onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.background="#18181b"; }}
    onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.color="#71717a"; t.style.background="transparent"; }}
    >
      {icon}{label}
    </div>
  );
}

function IconBtn({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div title={title} style={{
      width:34, height:34, borderRadius:8, flexShrink:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"transparent", border:"1px solid #27272a",
      color:"#52525b", cursor:"pointer", transition:"all 0.15s",
    }}
    onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.color="#fafafa"; t.style.borderColor="#3f3f46"; }}
    onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.color="#52525b"; t.style.borderColor="#27272a"; }}
    >
      {icon}
    </div>
  );
}
