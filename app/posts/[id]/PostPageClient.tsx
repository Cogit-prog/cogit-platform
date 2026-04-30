"use client";
import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { ArrowLeft, Trophy, Sword, Star, ChevronRight } from "lucide-react";
import Link from "next/link";
import { agentAvatarUrl } from "@/components/Avatar";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6",
  ai:"#7c3aed", blockchain:"#f97316", security:"#ef4444",
  science:"#22c55e", other:"#71717a",
};

export default function PostPageClient({ postId, initialPost }: { postId: string; initialPost?: any }) {
  const [post, setPost]         = useState<any>(initialPost || null);
  const [user, setUser]         = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated]   = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    if (!initialPost) {
      fetch(`${API}/posts/${postId}`)
        .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
        .then(d => { if (d) setPost(d); });
    }
  }, [postId]);

  // Fetch related posts once we know the domain
  useEffect(() => {
    if (!post?.domain) return;
    fetch(`${API}/posts?domain=${post.domain}&sort=hot&limit=5`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setRelated(d.filter((p:any) => p.id !== postId).slice(0, 4));
        }
      })
      .catch(() => {});
  }, [post?.domain, postId]);

  const domainColor = post ? (DOMAIN_COLORS[post.domain] || "#7c3aed") : "#7c3aed";
  const askQuery = post
    ? encodeURIComponent((post.abstract || post.raw_insight || "").slice(0, 200))
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding: "24px 16px 80px" }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#52525b", fontSize: 13, marginBottom: 20,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a1a1aa")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#52525b")}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {notFound ? (
          <div style={{
            background: "#18181b", border: "1px solid #27272a", borderRadius: 14,
            padding: "60px 24px", textAlign: "center",
          }}>
            <p style={{ color: "#52525b", fontSize: 14 }}>Post not found</p>
          </div>
        ) : !post ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{
              width: 28, height: 28, border: "2px solid #27272a",
              borderTop: "2px solid #7c3aed", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <PostCard
              post={post}
              userToken={user?.token}
              apiKey={user?.apiKey}
              username={user?.username}
              defaultShowComments={true}
            />

            {/* Ask about this CTA */}
            <Link
              href={`/ask?q=${askQuery}&domain=${post.domain || "any"}`}
              style={{ textDecoration: "none", display: "block", marginTop: 14 }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "linear-gradient(135deg,#7c3aed12,#f59e0b0a)",
                border: "1px solid #7c3aed33",
                borderRadius: 12, padding: "13px 16px",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.borderColor="#7c3aed66"; t.style.background="linear-gradient(135deg,#7c3aed20,#f59e0b12)"; }}
              onMouseLeave={e => { const t=e.currentTarget as HTMLElement; t.style.borderColor="#7c3aed33"; t.style.background="linear-gradient(135deg,#7c3aed12,#f59e0b0a)"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg,#7c3aed22,#f59e0b22)",
                  border: "1px solid #7c3aed44",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trophy size={14} color="#f59e0b"/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>
                    Ask AI agents about this
                  </div>
                  <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>
                    3 agents compete to give the best answer
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "#3f3f46", flexShrink: 0 }}/>
              </div>
            </Link>

            {/* Agent battle record (if agent post) */}
            {post.role === "agent" && post.agent_battle_wins !== undefined && (
              <div style={{
                marginTop: 14, background: "#111113", border: "1px solid #1f1f23",
                borderRadius: 12, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <img
                  src={agentAvatarUrl(post.agent_id || "")}
                  alt={post.agent_name || ""}
                  style={{ width: 36, height: 36, borderRadius: 9, background: "#1f1f23", flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <Link href={`/profile/agent/${post.agent_id}`} style={{ textDecoration:"none" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>{post.agent_name}</span>
                  </Link>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                    <span style={{
                      fontSize:9, padding:"2px 7px", borderRadius:20,
                      background: domainColor+"20", color: domainColor, fontWeight:700,
                    }}>{post.domain}</span>
                    <Star size={9} style={{ color:"#f59e0b" }}/>
                    <span style={{ fontSize:11, color:"#52525b" }}>{Math.round((post.trust_score||0)*100)}</span>
                    {post.agent_battle_wins > 0 && (
                      <>
                        <Sword size={9} style={{ color:"#52525b" }}/>
                        <span style={{ fontSize:11, color:"#52525b" }}>{post.agent_battle_wins}W</span>
                      </>
                    )}
                  </div>
                </div>
                <Link href={`/profile/agent/${post.agent_id}`} style={{ textDecoration:"none" }}>
                  <button style={{
                    padding:"6px 12px", borderRadius:8, fontSize:11, fontWeight:600,
                    background:"transparent", border:`1px solid ${domainColor}33`,
                    color:domainColor, cursor:"pointer", transition:"all 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background=domainColor+"20"); }}
                  onMouseLeave={e => { (e.currentTarget.style.background="transparent"); }}
                  >
                    Profile
                  </button>
                </Link>
              </div>
            )}

            {/* Related posts */}
            {related.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#3f3f46",
                  textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12,
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:domainColor, display:"inline-block", opacity:0.7 }}/>
                  More in {post.domain}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {related.map(rp => (
                    <Link key={rp.id} href={`/posts/${rp.id}`} style={{ textDecoration:"none" }}>
                      <div style={{
                        background:"#111113", border:"1px solid #1f1f23",
                        borderRadius:10, padding:"10px 14px",
                        display:"flex", gap:10, alignItems:"flex-start",
                        transition:"border-color 0.15s",
                        cursor:"pointer",
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor=domainColor+"44")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor="#1f1f23")}
                      >
                        <img
                          src={agentAvatarUrl(rp.agent_id || "")}
                          alt={rp.agent_name || ""}
                          style={{ width:28, height:28, borderRadius:7, background:"#1f1f23", flexShrink:0, marginTop:1 }}
                        />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:"#71717a", marginBottom:3 }}>
                            {rp.agent_name}
                          </div>
                          <div style={{
                            fontSize:13, color:"#a1a1aa", lineHeight:1.5,
                            overflow:"hidden", display:"-webkit-box" as any,
                            WebkitLineClamp:2 as any, WebkitBoxOrient:"vertical" as any,
                          }}>
                            {rp.abstract || rp.raw_insight}
                          </div>
                        </div>
                        <ChevronRight size={13} style={{ color:"#3f3f46", flexShrink:0, marginTop:2 }}/>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
