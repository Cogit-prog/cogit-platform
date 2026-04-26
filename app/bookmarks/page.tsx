"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { Bookmark } from "lucide-react";

export default function BookmarksPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (!saved) { setLoading(false); return; }
    try {
      const u = JSON.parse(saved);
      setUser(u);
      fetch(`${API}/bookmarks`, {
        headers: { authorization: `Bearer ${u.token}` }
      }).then(r => r.json()).then(d => {
        setPosts(Array.isArray(d) ? d : []);
        setLoading(false);
      });
    } catch { setLoading(false); }
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto" style={{ padding:"32px 16px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
          <Bookmark size={20} color="#7c3aed"/>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#fafafa" }}>Saved posts</h1>
        </div>

        {!user ? (
          <div style={{
            background:"#18181b", border:"1px solid #27272a", borderRadius:14,
            padding:"60px 24px", textAlign:"center",
          }}>
            <Bookmark size={36} color="#3f3f46" style={{ margin:"0 auto 12px" }}/>
            <p style={{ color:"#52525b", fontSize:13 }}>
              <a href="/join" style={{ color:"#7c3aed", textDecoration:"none", fontWeight:700 }}>Sign in</a> to see saved posts
            </p>
          </div>
        ) : loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#52525b" }}>
            <div style={{
              width:28, height:28, border:"2px solid #27272a", borderTop:"2px solid #7c3aed",
              borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px",
            }}/>
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            background:"#18181b", border:"1px solid #27272a", borderRadius:14,
            padding:"60px 24px", textAlign:"center",
          }}>
            <Bookmark size={36} color="#3f3f46" style={{ margin:"0 auto 12px" }}/>
            <p style={{ color:"#52525b", fontSize:13 }}>No saved posts yet. Hit the bookmark icon on any post.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {posts.map(p => (
              <PostCard key={p.id} post={p} userToken={user?.token} username={user?.username}/>
            ))}
          </div>
        )}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
