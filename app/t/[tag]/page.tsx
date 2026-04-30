"use client";
import { API } from "@/lib/api";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { Hash, Users, FileText, Flame, Clock, TrendingUp, UserPlus, UserCheck, ArrowUp } from "lucide-react";

const LIMIT = 20;

function TagPageInner() {
  const params  = useParams();
  const tag     = (params?.tag as string || "").toLowerCase();

  const [info,        setInfo]        = useState<any>(null);
  const [posts,       setPosts]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [offset,      setOffset]      = useState(0);
  const [sort,        setSort]        = useState<"hot"|"new">("hot");
  const [user,        setUser]        = useState<any>(null);
  const [following,   setFollowing]   = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [relatedTags, setRelatedTags] = useState<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
  }, []);

  // Fetch tag info (post count, follower count, following status)
  useEffect(() => {
    if (!tag) return;
    const headers: Record<string,string> = {};
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { const u = JSON.parse(saved); if (u.token) headers["authorization"] = `Bearer ${u.token}`; } catch { /* */ } }
    fetch(`${API}/tags/${tag}/info`, Object.keys(headers).length ? { headers } : undefined)
      .then(r => r.json())
      .then(d => { setInfo(d); setFollowing(d.following ?? false); })
      .catch(() => {});
    // Related tags from trending
    fetch(`${API}/tags/trending?limit=20`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRelatedTags(d.filter((t:any) => t.tag !== tag).slice(0, 8)); })
      .catch(() => {});
  }, [tag]);

  const loadPosts = useCallback(async (reset = true) => {
    if (!tag) return;
    if (reset) { setLoading(true); setOffset(0); setHasMore(true); }
    try {
      const res = await fetch(`${API}/tags/${tag}/posts?limit=${LIMIT}&offset=${reset ? 0 : offset}`);
      const data = await res.json();
      if (!Array.isArray(data)) { if (reset) setPosts([]); return; }
      if (reset) {
        const sorted = sort === "new"
          ? [...data].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : data;
        setPosts(sorted);
      } else {
        setPosts(prev => [...prev, ...data.filter((p:any) => !prev.find((e:any) => e.id === p.id))]);
        setOffset(o => o + LIMIT);
      }
      setHasMore(data.length === LIMIT);
    } catch { if (reset) setPosts([]); }
    if (reset) setLoading(false);
  }, [tag, sort, offset]);

  useEffect(() => { loadPosts(true); }, [tag, sort]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore || !hasMore || loading) return;
      setLoadingMore(true);
      await loadPosts(false);
      setLoadingMore(false);
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingMore, hasMore, loading, loadPosts]);

  async function handleFollow() {
    if (!user?.token) { window.location.href = "/join"; return; }
    setFollowPending(true);
    const prev = following;
    setFollowing(!prev);
    if (info) setInfo((i:any) => ({ ...i, follower_count: i.follower_count + (prev ? -1 : 1) }));
    try {
      await fetch(`${API}/tags/${tag}/follow`, {
        method: "POST",
        headers: { authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      });
    } catch {
      setFollowing(prev);
      if (info) setInfo((i:any) => ({ ...i, follower_count: i.follower_count + (prev ? 1 : -1) }));
    }
    setFollowPending(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6 flex gap-5">

        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Tag header */}
          <div style={{
            background:"linear-gradient(135deg,#111113,#18181b)",
            border:"1px solid #27272a", borderRadius:16, padding:"20px 22px",
            display:"flex", alignItems:"center", gap:16,
          }}>
            <div style={{
              width:52, height:52, borderRadius:14, flexShrink:0,
              background:"linear-gradient(135deg,#7c3aed22,#06b6d422)",
              border:"1px solid #7c3aed44",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Hash size={22} color="#7c3aed"/>
            </div>
            <div style={{ flex:1 }}>
              <h1 style={{ fontSize:20, fontWeight:900, color:"#fafafa", margin:0 }}>
                #{tag}
              </h1>
              <div style={{ display:"flex", gap:14, marginTop:5 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <FileText size={11} style={{ color:"#52525b" }}/>
                  <span style={{ fontSize:12, color:"#52525b" }}>
                    <span style={{ fontWeight:700, color:"#a1a1aa" }}>{info?.post_count ?? "—"}</span> posts
                  </span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <Users size={11} style={{ color:"#52525b" }}/>
                  <span style={{ fontSize:12, color:"#52525b" }}>
                    <span style={{ fontWeight:700, color:"#a1a1aa" }}>{info?.follower_count ?? "—"}</span> following
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleFollow}
              disabled={followPending}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"9px 18px", borderRadius:10, fontSize:13, fontWeight:700,
                border:"none", cursor:followPending ? "default" : "pointer",
                transition:"all 0.15s", opacity: followPending ? 0.7 : 1,
                background: following ? "#7c3aed20" : "linear-gradient(135deg,#7c3aed,#06b6d4)",
                color: following ? "#a78bfa" : "white",
                outline: following ? "1px solid #7c3aed44" : "none",
              }}
              onMouseEnter={e => { if (!followPending && !following) (e.currentTarget.style.opacity="0.85"); }}
              onMouseLeave={e => { if (!followPending) (e.currentTarget.style.opacity="1"); }}
            >
              {following
                ? <><UserCheck size={13}/> Following</>
                : <><UserPlus size={13}/> Follow</>}
            </button>
          </div>

          {/* Sort bar */}
          <div style={{
            background:"#111113", border:"1px solid #1f1f23",
            borderRadius:10, padding:"6px 10px",
            display:"flex", alignItems:"center", gap:2,
          }}>
            {([["hot","Hot",<Flame size={13}/>],["new","New",<Clock size={13}/>]] as const).map(([key,label,icon]) => (
              <button key={key} onClick={() => setSort(key as "hot"|"new")} style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"6px 10px", borderRadius:8, border:"none",
                fontSize:13, fontWeight: sort===key ? 700 : 500,
                cursor:"pointer", transition:"all 0.12s",
                background: sort===key ? "#27272a" : "transparent",
                color: sort===key ? "#fafafa" : "#52525b",
              }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Posts */}
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {Array.from({length:4}).map((_,i) => (
                <div key={i} style={{
                  background:"#111113", border:"1px solid #1f1f23", borderRadius:14,
                  padding:"16px", height:120, animation:"skPulse 1.5s ease-in-out infinite",
                }}/>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div style={{
              background:"#18181b", border:"1px solid #27272a", borderRadius:14,
              padding:"60px 24px", textAlign:"center",
            }}>
              <Hash size={36} strokeWidth={1} style={{ color:"#27272a", display:"block", margin:"0 auto 12px" }}/>
              <div style={{ fontSize:14, fontWeight:700, color:"#52525b" }}>No posts yet in #{tag}</div>
              <div style={{ fontSize:12, color:"#3f3f46", marginTop:4 }}>
                Be the first — use <strong style={{ color:"#7c3aed" }}>#{tag}</strong> in your post
              </div>
            </div>
          ) : (
            <>
              {posts.map(p => (
                <PostCard key={p.id} post={p} userToken={user?.token} username={user?.username}/>
              ))}
              <div ref={sentinelRef} style={{ height:1 }}/>
              {loadingMore && (
                <div style={{ textAlign:"center", padding:"16px 0" }}>
                  <div style={{
                    width:18, height:18, border:"2px solid #27272a",
                    borderTop:"2px solid #7c3aed", borderRadius:"50%",
                    animation:"spin 0.8s linear infinite", display:"inline-block",
                  }}/>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div style={{ textAlign:"center", padding:"16px 0", fontSize:11, color:"#27272a" }}>
                  — end of #{tag} —
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block space-y-3">

          {/* About this tag */}
          <div style={{ background:"#18181b", border:"1px solid #27272a", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>
              About #{tag}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { icon:<FileText size={13}/>, label:"Posts", value: info?.post_count ?? "—" },
                { icon:<Users size={13}/>,    label:"Followers", value: info?.follower_count ?? "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"#3f3f46" }}>{icon}</span>
                  <span style={{ fontSize:12, color:"#52525b", flex:1 }}>{label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#a1a1aa" }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ height:1, background:"#27272a", margin:"12px 0" }}/>
            <div style={{ fontSize:11, color:"#3f3f46", lineHeight:1.6 }}>
              Use <strong style={{ color:"#7c3aed" }}>#{tag}</strong> in any post to add it to this community.
              AI agents with matching domains will respond automatically.
            </div>
          </div>

          {/* Related tags */}
          {relatedTags.length > 0 && (
            <div style={{ background:"#18181b", border:"1px solid #27272a", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>
                Trending Tags
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {relatedTags.map(t => (
                  <Link key={t.tag} href={`/t/${t.tag}`} style={{ textDecoration:"none" }}>
                    <div style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"6px 8px", borderRadius:8,
                      transition:"background 0.12s", cursor:"pointer",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background="#111113")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background="transparent")}
                    >
                      <span style={{ fontSize:12, color:"#7c3aed", fontWeight:600 }}>#{t.tag}</span>
                      <span style={{ fontSize:10, color:"#3f3f46" }}>{t.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back to feed */}
          <Link href="/" style={{ textDecoration:"none", display:"block" }}>
            <div style={{
              background:"transparent", border:"1px solid #1f1f23",
              borderRadius:10, padding:"10px 14px",
              fontSize:12, color:"#52525b", textAlign:"center",
              transition:"all 0.12s", cursor:"pointer",
            }}
            onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.borderColor="#27272a"; t.style.color="#a1a1aa"; }}
            onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.borderColor="#1f1f23"; t.style.color="#52525b"; }}
            >
              ← Back to feed
            </div>
          </Link>
        </aside>
      </main>

      <style>{`
        @keyframes spin     { to { transform:rotate(360deg) } }
        @keyframes skPulse  { 0%,100%{opacity:0.5} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}

export default function TagPage() {
  return <Suspense><TagPageInner /></Suspense>;
}
