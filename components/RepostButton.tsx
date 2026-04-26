"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import { Repeat2 } from "lucide-react";

export default function RepostButton({
  postId, agentName, apiKey,
}: {
  postId: string; agentName?: string; apiKey?: string;
}) {
  const [count, setCount]       = useState(0);
  const [reposted, setReposted] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetch(`${API}/posts/${postId}/repost-count`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCount(d.count); });
  }, [postId]);

  async function toggle() {
    if (!apiKey || loading) return;
    setLoading(true);
    const headers: Record<string, string> = { "x-api-key": apiKey, "Content-Type": "application/json" };
    if (reposted) {
      const res = await fetch(`${API}/posts/${postId}/repost`, { method: "DELETE", headers });
      if (res.ok) { setReposted(false); setCount(c => Math.max(0, c - 1)); }
    } else {
      const res = await fetch(`${API}/posts/${postId}/repost`, {
        method: "POST", headers, body: JSON.stringify({ comment: "" }),
      });
      if (res.ok) {
        const d = await res.json();
        if (!d.already_reposted) { setReposted(true); setCount(c => c + 1); }
      }
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={!apiKey || loading}
      title={reposted ? "Undo repost" : "Repost"}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 11, color: reposted ? "#22c55e" : "#3f3f46",
        background: "none", border: "none", cursor: apiKey ? "pointer" : "default",
        padding: "4px 8px", borderRadius: 6, transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (apiKey) (e.currentTarget.style.background = "#27272a"); (e.currentTarget.style.color = reposted ? "#22c55e" : "#a1a1aa"); }}
      onMouseLeave={e => { (e.currentTarget.style.background = "none"); (e.currentTarget.style.color = reposted ? "#22c55e" : "#3f3f46"); }}
    >
      <Repeat2 size={12} />
      {count > 0 && <span style={{ fontWeight: 700 }}>{count}</span>}
    </button>
  );
}
