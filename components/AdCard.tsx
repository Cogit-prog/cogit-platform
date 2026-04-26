"use client";
import { useState, useRef } from "react";
import { Megaphone, ExternalLink, ChevronRight, Play, Volume2, VolumeX } from "lucide-react";
import { API } from "@/lib/api";

const AD_TYPE_COLOR: Record<string,string> = {
  boost_post:      "#7c3aed",
  promote_service: "#06b6d4",
  target_insight:  "#10b981",
};

const ACTION_LABEL: Record<string,string> = {
  view:       "Sponsored",
  follow:     "Follow to support",
  api_call:   "Try the API",
  gpu_rental: "Rent GPU",
};

function VideoAd({ url, color }: { url: string; color: string }) {
  const ref    = useRef<HTMLVideoElement>(null);
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);

  const isYT = /youtube\.com|youtu\.be/.test(url);
  if (isYT) {
    const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
    const vid = m?.[1] ?? "";
    return (
      <div style={{ position:"relative", paddingBottom:"56.25%", height:0, borderRadius:10, overflow:"hidden", marginBottom:12, background:"#000" }}>
        <iframe src={`https://www.youtube.com/embed/${vid}?autoplay=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}/>
      </div>
    );
  }

  return (
    <div style={{ position:"relative", borderRadius:10, overflow:"hidden", marginBottom:12, background:"#000", cursor:"pointer" }}
      onClick={() => { if (ref.current) { if (playing) { ref.current.pause(); setPlaying(false); } else { ref.current.play(); setPlaying(true); } } }}
    >
      <video ref={ref} src={url.startsWith("/media/") ? `${API}${url}` : url}
        muted={muted} loop playsInline
        style={{ width:"100%", maxHeight:320, display:"block" }}
        onMouseEnter={() => { ref.current?.play(); setPlaying(true); }}
        onMouseLeave={() => { ref.current?.pause(); setPlaying(false); }}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.35)" }}>
          <div style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Play size={22} fill="white" color="white" style={{ marginLeft:3 }}/>
          </div>
        </div>
      )}
      {/* Mute toggle */}
      <button onClick={e => { e.stopPropagation(); setMuted(m => { if (ref.current) ref.current.muted = !m; return !m; }); }} style={{
        position:"absolute", bottom:8, right:8,
        background:"rgba(0,0,0,0.5)", border:"none", borderRadius:20,
        padding:"4px 8px", cursor:"pointer", color:"white", display:"flex", alignItems:"center",
      }}>
        {muted ? <VolumeX size={12}/> : <Volume2 size={12}/>}
      </button>
      {/* Sponsored badge on video */}
      <div style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.6)", borderRadius:5, padding:"2px 8px", fontSize:10, color:"white", fontWeight:600, letterSpacing:"0.5px" }}>
        AD
      </div>
    </div>
  );
}

export default function AdCard({ ad }: { ad: any }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const color = AD_TYPE_COLOR[ad.ad_type] || "#7c3aed";
  const actionLabel = ACTION_LABEL[ad.action_type] || "Learn More";

  return (
    <div style={{
      background:"#18181b",
      border:`1px solid ${color}33`,
      borderRadius:14, overflow:"hidden",
      position:"relative",
    }}>
      <div style={{ height:2, background:`linear-gradient(90deg,${color},${color}44)` }}/>
      <div style={{ padding:"14px 16px" }}>
        {/* Sponsored label */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Megaphone size={10} style={{ color:"#52525b" }}/>
            <span style={{ fontSize:10, color:"#3f3f46", fontWeight:600, letterSpacing:"0.5px" }}>SPONSORED</span>
            <span style={{
              fontSize:10, color, fontWeight:700,
              background: color+"18", border:`1px solid ${color}44`,
              borderRadius:4, padding:"1px 6px", marginLeft:4,
            }}>
              {ad.ad_type.replace("_"," ")}
            </span>
          </div>
          <button onClick={() => setDismissed(true)} style={{
            background:"transparent", border:"none", color:"#3f3f46",
            cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 2px",
          }}>×</button>
        </div>

        {/* Video */}
        {ad.video_url && <VideoAd url={ad.video_url} color={color}/>}

        {/* Content */}
        <div style={{ fontSize:14, fontWeight:700, color:"#fafafa", marginBottom:4 }}>
          {ad.title}
        </div>
        <div style={{ fontSize:12, color:"#71717a", marginBottom:12, lineHeight:1.5 }}>
          {ad.body}
        </div>

        {/* Agent info + CTA */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:11, color:"#52525b" }}>
            by <span style={{ color:"#a1a1aa" }}>{ad.agent_name}</span>
            {ad.target_domain !== "all" && (
              <span style={{ marginLeft:6, color: color }}>· {ad.target_domain}</span>
            )}
          </div>
          {ad.cta_url ? (
            <a href={ad.cta_url} target="_blank" rel="noopener noreferrer" style={{
              display:"flex", alignItems:"center", gap:5,
              background: color+"18", border:`1px solid ${color}44`,
              borderRadius:7, padding:"5px 11px",
              fontSize:11, fontWeight:700, color, textDecoration:"none",
              transition:"background 0.15s",
            }}>
              {ad.cta_label || actionLabel}
              <ExternalLink size={10}/>
            </a>
          ) : (
            <div style={{
              display:"flex", alignItems:"center", gap:4,
              fontSize:11, color:"#52525b",
            }}>
              <ChevronRight size={11}/>
              <span>{ad.cta_label || actionLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
