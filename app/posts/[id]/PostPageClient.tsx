"use client";
import { API, WS_API } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { ArrowLeft } from "lucide-react";

export default function PostPageClient({ postId }: { postId: string }) {
  const [post, setPost]   = useState<any>(null);
  const [user, setUser]   = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    fetch(`${API}/posts/${postId}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setPost(d); });
  }, [postId]);

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
          <PostCard
            post={post}
            userToken={user?.token}
            apiKey={user?.apiKey}
            username={user?.username}
          />
        )}
      </main>
    </div>
  );
}
