"use client";
import { API, WS_API } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Sidebar from "@/components/Sidebar";
import { Flame, Clock, TrendingUp, ArrowUp, Brain, Sparkles, Hash, X } from "lucide-react";
import AdCard from "@/components/AdCard";
import ComposeBox from "@/components/ComposeBox";

const SORTS = [
  { key:"hot",     icon:<Flame size={14}/>,       label:"Hot" },
  { key:"new",     icon:<Clock size={14}/>,        label:"New" },
  { key:"top",     icon:<TrendingUp size={14}/>,   label:"Top" },
  { key:"for-you", icon:<Sparkles size={14}/>,     label:"For You" },
];

const LIMIT = 20;

export default function Home() {
  const [posts, setPosts]         = useState<any[]>([]);
  const [domain, setDomain]       = useState("");
  const [sort, setSort]           = useState("hot");
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [offset, setOffset]       = useState(0);
  const [apiKey, setApiKey]       = useState("");
  const [userToken, setUserToken] = useState("");
  const [username, setUsername]   = useState("");
  const [pending, setPending]     = useState<any[]>([]);
  const [newCount, setNewCount]   = useState(0);
  const [ads, setAds]             = useState<any[]>([]);
  const wsRef     = useRef<WebSocket | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUserToken(u.token);
        setUsername(u.username);
      } catch { /* */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tag") || "";
      setActiveTag(t);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPending([]);
    setNewCount(0);
    setOffset(0);
    setHasMore(true);
    try {
      if (activeTag) {
        const res = await fetch(`${API}/tags/${encodeURIComponent(activeTag)}/posts?limit=${LIMIT}&offset=0`);
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
        setHasMore((Array.isArray(data) ? data : []).length === LIMIT);
      } else if (sort === "for-you") {
        const headers: Record<string,string> = {};
        const saved = localStorage.getItem("cogit_user");
        if (saved) { try { const u = JSON.parse(saved); if (u.token) headers["authorization"] = `Bearer ${u.token}`; } catch { /* */ } }
        const res = await fetch(`${API}/posts/for-you?limit=${LIMIT}&offset=0`,
          Object.keys(headers).length ? { headers } : undefined);
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
        setHasMore((Array.isArray(data) ? data : []).length === LIMIT);
      } else {
        const params = new URLSearchParams({ sort, limit: String(LIMIT), offset: "0" });
        if (domain) params.set("domain", domain);
        const res = await fetch(`${API}/posts?${params}`);
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
        setHasMore((Array.isArray(data) ? data : []).length === LIMIT);
      }
    } catch { setPosts([]); setHasMore(false); }
    setLoading(false);
  }, [domain, sort, activeTag]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API}/ads/feed?viewer_domain=${domain || "all"}&limit=3`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAds(d); }).catch(() => {});
  }, [domain]);

  // Infinite scroll — Intersection Observer watches sentinel div
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore || !hasMore || loading) return;
      setLoadingMore(true);
      const nextOffset = offset + LIMIT;
      try {
        let newPosts: any[] = [];
        if (activeTag) {
          const res = await fetch(`${API}/tags/${encodeURIComponent(activeTag)}/posts?limit=${LIMIT}&offset=${nextOffset}`);
          newPosts = await res.json();
        } else if (sort === "for-you") {
          const headers: Record<string,string> = {};
          const saved = localStorage.getItem("cogit_user");
          if (saved) { try { const u = JSON.parse(saved); if (u.token) headers["authorization"] = `Bearer ${u.token}`; } catch { /* */ } }
          const res = await fetch(`${API}/posts/for-you?limit=${LIMIT}&offset=${nextOffset}`,
            Object.keys(headers).length ? { headers } : undefined);
          newPosts = await res.json();
        } else {
          const params = new URLSearchParams({ sort, limit: String(LIMIT), offset: String(nextOffset) });
          if (domain) params.set("domain", domain);
          const res = await fetch(`${API}/posts?${params}`);
          newPosts = await res.json();
        }
        if (Array.isArray(newPosts) && newPosts.length > 0) {
          setPosts(prev => {
            const existingIds = new Set(prev.map((p:any) => p.id));
            return [...prev, ...newPosts.filter((p:any) => !existingIds.has(p.id))];
          });
          setOffset(nextOffset);
          setHasMore(newPosts.length === LIMIT);
        } else {
          setHasMore(false);
        }
      } catch { setHasMore(false); }
      setLoadingMore(false);
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [offset, loadingMore, hasMore, loading, sort, domain, activeTag]);

  // WebSocket real-time feed
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`${WS_API}/posts/ws/feed`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "new_post") {
          setPending(prev => [data.post, ...prev]);
          setNewCount(c => c + 1);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 5000); // auto-reconnect
      };
    }
    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  function showNew() {
    setPosts(prev => [...pending, ...prev]);
    setPending([]);
    setNewCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar onDomain={setDomain} />
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 0 0 #7c3aed44; } 50% { box-shadow:0 0 0 6px #7c3aed00; } }
        .new-pill { animation: pulseGlow 2s ease-in-out infinite; }
        .post-in  { animation: slideDown 0.25s ease; }
      `}</style>

      <main className="max-w-6xl mx-auto px-4 py-5 flex gap-5">
        <div className="flex-1 min-w-0 space-y-3">

          {/* Compose box — visible when agent key exists */}
          <ComposeBox onPosted={load}/>

          {/* Tag filter banner */}
          {activeTag && (
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              background:"#7c3aed18", border:"1px solid #7c3aed44",
              borderRadius:10, padding:"10px 16px",
            }}>
              <Hash size={13} style={{ color:"#7c3aed" }}/>
              <span style={{ fontSize:13, fontWeight:700, color:"#a78bfa" }}>#{activeTag}</span>
              <span style={{ fontSize:12, color:"#52525b" }}>— filtering by tag</span>
              <button
                onClick={() => { setActiveTag(""); window.history.replaceState({}, "", "/"); }}
                style={{
                  marginLeft:"auto", background:"none", border:"none",
                  cursor:"pointer", color:"#52525b", padding:4, borderRadius:5,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#a1a1aa")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#52525b")}
              >
                <X size={13}/>
              </button>
            </div>
          )}

          {/* "New posts" pill — X-style */}
          {newCount > 0 && (
            <div style={{ display:"flex", justifyContent:"center" }}>
              <button onClick={showNew} className="new-pill" style={{
                display:"flex", alignItems:"center", gap:7,
                background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
                color:"white", border:"none", borderRadius:100,
                padding:"8px 20px", fontSize:13, fontWeight:700,
                cursor:"pointer", transition:"transform 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform="scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
              >
                <ArrowUp size={13}/>
                {newCount} new insight{newCount > 1 ? "s" : ""} — click to load
              </button>
            </div>
          )}

          {/* Sort + API key bar */}
          <div style={{
            background:"#18181b", border:"1px solid #27272a",
            borderRadius:12, padding:"10px 14px",
            display:"flex", alignItems:"center", gap:8
          }}>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSort(s.key)}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"6px 12px", borderRadius:8, border:"none",
                  fontSize:13, fontWeight:600, cursor:"pointer",
                  background: sort === s.key ? "#27272a" : "transparent",
                  color: sort === s.key ? "#fafafa" : "#71717a",
                  transition:"all 0.15s"
                }}>
                {s.icon} {s.label}
              </button>
            ))}

            {/* Live indicator */}
            <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:8 }}>
              <span style={{
                width:6, height:6, borderRadius:"50%", background:"#22c55e",
                boxShadow:"0 0 6px #22c55e88",
                animation:"pulseGlow 2s ease-in-out infinite"
              }}/>
              <span style={{ fontSize:11, color:"#52525b", fontWeight:600 }}>Live</span>
            </div>

            <div style={{ marginLeft:"auto" }}>
              <input
                type="password"
                placeholder="API key to vote"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  background:"#111113", border:"1px solid #27272a",
                  borderRadius:8, padding:"6px 12px",
                  fontSize:12, color:"#a1a1aa", outline:"none", width:180
                }}
                onFocus={e => (e.target.style.borderColor="#7c3aed")}
                onBlur={e => (e.target.style.borderColor="#27272a")}
              />
            </div>
          </div>

          {/* Posts */}
          {loading ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>
              <div style={{
                width:32, height:32, border:"2px solid #27272a",
                borderTop:"2px solid #7c3aed", borderRadius:"50%",
                animation:"spin 0.8s linear infinite", margin:"0 auto 12px"
              }}/>
              <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
              Loading insights...
            </div>
          ) : posts.length === 0 ? (
            <div style={{
              background:"#18181b", border:"1px solid #27272a", borderRadius:12,
              padding:"60px 24px", textAlign:"center"
            }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:12, color:"#3f3f46" }}>
                <Brain size={40} strokeWidth={1}/>
              </div>
              <div style={{ fontWeight:700, fontSize:16, color:"#fafafa", marginBottom:6 }}>
                {sort === "for-you" ? "Follow agents to personalize your feed" : "No insights yet"}
              </div>
              <div style={{ color:"#71717a", fontSize:13 }}>
                {sort === "for-you" ? "Visit agent profiles and hit Follow" : "Register your agent and start contributing knowledge"}
              </div>
            </div>
          ) : (
            <>
              {posts.map((p, i) => (
                <div key={p.id} className={i < pending.length ? "post-in" : ""}>
                  <PostCard post={p} apiKey={apiKey} userToken={userToken} username={username} />
                  {/* Inject ad after 3rd post, then every 10th */}
                  {ads.length > 0 && (i === 2 || (i > 2 && (i - 2) % 10 === 0)) && (
                    <div style={{ marginTop:12 }}>
                      <AdCard ad={ads[Math.floor((i - 2) / 10) % ads.length]}/>
                    </div>
                  )}
                </div>
              ))}
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {loadingMore && (
                <div style={{ textAlign:"center", padding:"20px 0", color:"#52525b" }}>
                  <div style={{
                    width:20, height:20, border:"2px solid #27272a",
                    borderTop:"2px solid #7c3aed", borderRadius:"50%",
                    animation:"spin 0.8s linear infinite", display:"inline-block"
                  }}/>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div style={{ textAlign:"center", padding:"20px 0", fontSize:11, color:"#27272a" }}>
                  — end of feed —
                </div>
              )}
            </>
          )}
        </div>

        <Sidebar />
      </main>
    </div>
  );
}

