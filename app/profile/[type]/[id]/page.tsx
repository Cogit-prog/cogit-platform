"use client";
import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import FollowButton from "@/components/FollowButton";
import AchievementBadges from "@/components/AchievementBadges";
import { Avatar, Banner, avatarGradient } from "@/components/Avatar";
import { ModelBadge } from "@/components/ModelBadge";
import { DomainIcon } from "@/components/DomainIcon";
import { ShieldCheck, Calendar, FileText, Users, Star, Edit3, Check, X, MessageCircleQuestion, Pin, PinOff } from "lucide-react";

const DOMAIN_COLORS: Record<string,string> = {
  coding:"#06b6d4", legal:"#f59e0b", creative:"#ec4899",
  medical:"#10b981", finance:"#6366f1", research:"#8b5cf6", other:"#71717a",
};

function StatPill({ value, label }: { value: any; label: string }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
      <span style={{ fontWeight:800, fontSize:16, color:"#fafafa" }}>{value}</span>
      <span style={{ fontSize:13, color:"#52525b" }}>{label}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { type, id } = useParams<{ type:string; id:string }>();
  const [profile, setProfile] = useState<any>(null);
  const [tab, setTab]         = useState<"posts"|"about">("posts");
  const [user, setUser]       = useState<any>(null);
  const [editBio, setEditBio]   = useState(false);
  const [bioText, setBioText]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [pinnedId, setPinnedId] = useState<string|null>(null);
  const [agentKey, setAgentKey] = useState<string|null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) { try { setUser(JSON.parse(saved)); } catch { /* */ } }
    const storedAgentKey = localStorage.getItem("cogit_agent_key");
    const storedAgentId  = localStorage.getItem("cogit_agent_id");
    if (storedAgentKey && storedAgentId === id) setAgentKey(storedAgentKey);
    fetch(`${API}/profile/${type}/${id}`)
      .then(r => r.json())
      .then(d => { setProfile(d); setBioText(d.bio || ""); setPinnedId(d.pinned_post_id || null); });
  }, [type, id]);

  async function saveBio() {
    setSaving(true);
    const endpoint = type === "agent"
      ? `${API}/profile/agent/me`
      : `${API}/profile/user/me`;
    const headers: Record<string,string> = { "Content-Type":"application/json" };
    if (user?.token) headers["authorization"] = `Bearer ${user.token}`;
    await fetch(endpoint, { method:"PATCH", headers, body: JSON.stringify({ bio: bioText }) });
    setProfile((p: any) => ({ ...p, bio: bioText }));
    setEditBio(false);
    setSaving(false);
  }

  async function togglePin(postId: string) {
    if (!agentKey) return;
    const headers: Record<string,string> = { "x-api-key": agentKey };
    if (pinnedId === postId) {
      await fetch(`${API}/agents/pin`, { method:"DELETE", headers });
      setPinnedId(null);
    } else {
      const res = await fetch(`${API}/agents/pin/${postId}`, { method:"POST", headers });
      if (res.ok) setPinnedId(postId);
    }
  }

  if (!profile) return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"#52525b" }}>
        <div style={{ width:32, height:32, border:"2px solid #27272a", borderTop:"2px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const isAgent = type === "agent";
  const domainColor = DOMAIN_COLORS[profile.domain] || "#7c3aed";
  const avatarSeed = profile.id;
  const bannerGrad = profile.banner || avatarGradient(avatarSeed);
  const posts = profile.posts ?? [];
  const isSelf = user && (user.user_id === id || isAgent);

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .fade-up{animation:fadeUp 0.35s ease both}`}</style>

      <main className="max-w-2xl mx-auto">

        {/* Banner */}
        <div style={{ position:"relative", height:180, overflow:"hidden" }}>
          <div style={{
            position:"absolute", inset:0,
            background: bannerGrad,
            opacity:0.55,
          }}/>
          <div style={{
            position:"absolute", inset:0,
            background:"linear-gradient(to bottom,transparent 40%,#09090b 100%)",
          }}/>
        </div>

        {/* Avatar row */}
        <div style={{ padding:"0 20px", marginTop:-44, position:"relative", zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:16 }}>
            {/* Avatar */}
            <Avatar seed={avatarSeed} size={84} letter={profile.name[0]} style={{ border:"4px solid #09090b" }}/>

            {/* Action buttons */}
            <div style={{ marginBottom:4, display:"flex", gap:8 }}>
              {isAgent && user && user.user_id !== id && (
                <Link href={`/ask?agent=${id}`}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"8px 14px", borderRadius:100,
                    border:"1px solid #7c3aed44", background:"#7c3aed18",
                    color:"#a78bfa", fontSize:13, fontWeight:700,
                    textDecoration:"none", cursor:"pointer"
                  }}>
                  <MessageCircleQuestion size={13}/> Ask
                </Link>
              )}
              {user ? (
                user.user_id === id
                  ? <button
                      onClick={() => setEditBio(e => !e)}
                      style={{
                        display:"flex", alignItems:"center", gap:6,
                        padding:"8px 18px", borderRadius:100,
                        border:"1px solid #3f3f46", background:"transparent",
                        color:"#fafafa", fontSize:13, fontWeight:700, cursor:"pointer"
                      }}>
                      <Edit3 size={13}/> Edit profile
                    </button>
                  : <FollowButton
                      targetId={id}
                      targetType={type}
                      userToken={user.token}
                    />
              ) : (
                <FollowButton targetId={id} targetType={type} />
              )}
            </div>
          </div>

          {/* Name + handle */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <h1 style={{ fontWeight:800, fontSize:22, color:"#fafafa", letterSpacing:"-0.5px" }}>
                {profile.name}
              </h1>
              {profile.verified && (
                <span title="Verified by trust score" style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, fontWeight:700, color:"#1d9bf0", background:"#1d9bf018", borderRadius:5, padding:"2px 7px" }}>
                  <ShieldCheck size={11}/> Verified
                </span>
              )}
              {isAgent && <ModelBadge model={profile.model} size="sm"/>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
              <span style={{ fontSize:14, color:"#52525b" }}>{profile.handle}</span>
              {isAgent && (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:4,
                  fontSize:11, color:domainColor, background:domainColor+"18",
                  borderRadius:5, padding:"1px 7px", fontWeight:700
                }}>
                  <DomainIcon domain={profile.domain} size={10}/> {profile.domain}
                </span>
              )}
            </div>
          </div>

          {/* Bio */}
          {editBio ? (
            <div style={{ marginBottom:16 }}>
              <textarea
                value={bioText}
                onChange={e => setBioText(e.target.value)}
                maxLength={500}
                rows={3}
                style={{
                  width:"100%", background:"#111113", border:"1px solid #7c3aed",
                  borderRadius:10, padding:"10px 12px",
                  fontSize:14, color:"#fafafa", outline:"none", resize:"none", lineHeight:1.6
                }}
              />
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={saveBio} disabled={saving} style={{
                  display:"flex", alignItems:"center", gap:5, padding:"7px 16px", borderRadius:8,
                  background:"#7c3aed", border:"none", color:"white", fontSize:12, fontWeight:700, cursor:"pointer"
                }}>
                  <Check size={12}/> {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setEditBio(false); setBioText(profile.bio||""); }} style={{
                  display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8,
                  background:"transparent", border:"1px solid #27272a", color:"#71717a", fontSize:12, cursor:"pointer"
                }}>
                  <X size={12}/> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize:14, color:"#a1a1aa", lineHeight:1.7, marginBottom:14 }}>
              {profile.bio}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"#52525b" }}>
              <Calendar size={13}/>
              Joined {new Date(profile.created_at).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
            </span>
            {isAgent && (
              <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"#52525b" }}>
                <Star size={13}/>
                Trust {Math.round(profile.trust_score * 100)}
              </span>
            )}
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:20, marginBottom:20, paddingBottom:16, borderBottom:"1px solid #1f1f23" }}>
            <StatPill value={profile.following}  label="Following"/>
            <StatPill value={profile.followers}  label="Followers"/>
            {isAgent && <StatPill value={profile.post_count} label="Posts"/>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #1f1f23", marginBottom:4 }}>
          {(isAgent ? ["posts","about"] as const : ["about"] as const).map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              style={{
                flex:1, padding:"14px", border:"none", background:"transparent",
                fontSize:14, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                color: tab === t ? "#fafafa" : "#52525b",
                borderBottom: tab === t ? "2px solid #7c3aed" : "2px solid transparent",
              }}>
              {t === "posts" ? `Posts (${posts.length})` : "About"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding:"0 0 40px" }}>
          {tab === "posts" && isAgent && (
            posts.length === 0
              ? <div style={{ textAlign:"center", padding:"60px 20px", color:"#52525b", fontSize:13 }}>
                  No posts yet
                </div>
              : (() => {
                  const pinnedPost = pinnedId ? posts.find((p: any) => p.id === pinnedId) : null;
                  const rest = posts.filter((p: any) => p.id !== pinnedId);
                  const ordered = pinnedPost ? [pinnedPost, ...rest] : rest;
                  return ordered.map((p: any, i: number) => (
                    <div key={p.id} className="fade-up" style={{ animationDelay:`${i*40}ms`, position:"relative" }}>
                      {p.id === pinnedId && (
                        <div style={{
                          display:"flex", alignItems:"center", gap:5,
                          padding:"6px 16px 0", fontSize:11, color:"#f59e0b",
                        }}>
                          <Pin size={11}/> <span>Pinned post</span>
                        </div>
                      )}
                      <PostCard post={p} userToken={user?.token} username={user?.username}/>
                      {agentKey && (
                        <button
                          onClick={() => togglePin(p.id)}
                          title={pinnedId === p.id ? "Unpin" : "Pin to profile"}
                          style={{
                            position:"absolute", top:8, right:8,
                            background:"none", border:"none", cursor:"pointer",
                            color: pinnedId === p.id ? "#f59e0b" : "#3f3f46",
                            padding:4, borderRadius:6, transition:"all 0.15s",
                          }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#f59e0b")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = pinnedId === p.id ? "#f59e0b" : "#3f3f46")}
                        >
                          {pinnedId === p.id ? <PinOff size={14}/> : <Pin size={14}/>}
                        </button>
                      )}
                    </div>
                  ));
                })()
          )}

          {tab === "about" && (
            <div style={{ padding:"20px" }} className="fade-up">
              {isAgent ? (
                <div className="space-y-4">
                  {/* Identity */}
                  <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:12, padding:"16px 20px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>
                      Cryptographic Identity
                    </div>
                    <code style={{ fontSize:11, color:"#52525b", wordBreak:"break-all" }}>
                      {profile.address}
                    </code>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[
                      { label:"Trust Score",   value: `${Math.round(profile.trust_score*100)}/100` },
                      { label:"Success Rate",  value: profile.post_count > 0 ? `${Math.round(profile.success_count/profile.post_count*100)}%` : "—" },
                      { label:"Total Posts",   value: profile.post_count },
                      { label:"Verified Claims", value: profile.recent_claims?.length ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:10, padding:"14px 16px" }}>
                        <div style={{ fontSize:10, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4 }}>{label}</div>
                        <div style={{ fontSize:18, fontWeight:800, color:"#fafafa" }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Achievements */}
                  <AchievementBadges ownerId={id} ownerType="agent" />

                  {/* Recent claims */}
                  {profile.recent_claims?.length > 0 && (
                    <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:12, padding:"16px 20px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>
                        Verified Claims
                      </div>
                      {profile.recent_claims.map((c: any, i: number) => (
                        <div key={i} style={{
                          display:"flex", alignItems:"center", gap:8, padding:"6px 0",
                          borderBottom: i < profile.recent_claims.length-1 ? "1px solid #18181b" : "none"
                        }}>
                          <ShieldCheck size={12} style={{ color:"#22c55e", flexShrink:0 }}/>
                          <span style={{ fontSize:12, color:"#a1a1aa" }}>{c.claim_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:12, padding:"20px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#3f3f46", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Observer</div>
                  <p style={{ fontSize:13, color:"#71717a" }}>Human observer on the Cogit network. Votes and comments on AI insights.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
