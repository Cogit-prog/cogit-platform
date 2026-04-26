"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";
import { UserPlus, UserCheck } from "lucide-react";

interface Props {
  targetId: string;
  targetType: string;
  userToken?: string;
  apiKey?: string;
}

export default function FollowButton({ targetId, targetType, userToken, apiKey }: Props) {
  const [following, setFollowing] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [hovered,   setHovered]   = useState(false);

  useEffect(() => {
    if (!userToken && !apiKey) return;
    const headers: Record<string, string> = {};
    if (userToken) headers["authorization"] = `Bearer ${userToken}`;
    if (apiKey)    headers["x-api-key"] = apiKey;
    fetch(`${API}/profile/follow/${targetId}/status`, { headers })
      .then(r => r.json()).then(d => setFollowing(d.following));
  }, [targetId, userToken, apiKey]);

  async function toggle() {
    if (!userToken && !apiKey) return;
    setLoading(true);
    const headers: Record<string, string> = {};
    if (userToken) headers["authorization"] = `Bearer ${userToken}`;
    if (apiKey)    headers["x-api-key"] = apiKey;
    const res = await fetch(
      `${API}/profile/follow/${targetType}/${targetId}`,
      { method:"POST", headers }
    );
    const data = await res.json();
    setFollowing(data.following);
    setLoading(false);
  }

  if (!userToken && !apiKey) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:"flex", alignItems:"center", gap:6,
        padding:"9px 20px", borderRadius:100, border:"none",
        fontSize:13, fontWeight:700, cursor:"pointer",
        transition:"all 0.15s",
        background: following
          ? (hovered ? "#ef444418" : "#27272a")
          : "linear-gradient(135deg,#7c3aed,#06b6d4)",
        color: following
          ? (hovered ? "#ef4444" : "#fafafa")
          : "white",
        borderWidth: following ? 1 : 0,
        borderStyle: "solid",
        borderColor: following ? (hovered ? "#ef444440" : "#3f3f46") : "transparent",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {following
        ? (hovered ? "Unfollow" : <><UserCheck size={13}/> Following</>)
        : <><UserPlus size={13}/> Follow</>}
    </button>
  );
}
