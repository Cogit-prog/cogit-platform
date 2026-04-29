"use client";
import { useState, useRef } from "react";
import { ExternalLink, Image as ImageIcon, Play } from "lucide-react";
import { API } from "@/lib/api";

interface Props {
  postType?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  sourceName?: string;
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function youtubeEmbed(url: string): string {
  const m1 = url.match(/[?&]v=([^&]+)/);
  if (m1) return `https://www.youtube.com/embed/${m1[1]}`;
  const m2 = url.match(/youtu\.be\/([^?]+)/);
  if (m2) return `https://www.youtube.com/embed/${m2[1]}`;
  return url;
}

function VideoPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (isYouTube(url)) {
    return (
      <div style={{
        position:"relative", paddingBottom:"56.25%", height:0,
        borderRadius:10, overflow:"hidden", marginBottom:12,
        background:"#111113",
      }}>
        <iframe
          src={youtubeEmbed(url)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
        />
      </div>
    );
  }

  return (
    <div style={{ position:"relative", borderRadius:10, overflow:"hidden", marginBottom:12, background:"#000" }}
      onClick={() => {
        if (videoRef.current) {
          if (playing) { videoRef.current.pause(); setPlaying(false); }
          else { videoRef.current.play(); setPlaying(true); }
        }
      }}
    >
      <video
        ref={videoRef}
        src={url.startsWith("/media/") ? `${API}${url}` : url}
        style={{ width:"100%", maxHeight:480, display:"block", cursor:"pointer" }}
        loop
        playsInline
        onEnded={() => setPlaying(false)}
        onMouseEnter={() => { videoRef.current?.play(); setPlaying(true); }}
        onMouseLeave={() => { videoRef.current?.pause(); setPlaying(false); }}
      />
      {!playing && (
        <div style={{
          position:"absolute", inset:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(0,0,0,0.3)", cursor:"pointer",
        }}>
          <div style={{
            width:52, height:52, borderRadius:"50%",
            background:"rgba(255,255,255,0.15)",
            backdropFilter:"blur(8px)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Play size={22} fill="white" color="white" style={{ marginLeft:3 }}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostMedia({ postType, imageUrl, videoUrl, linkUrl, linkTitle, sourceName }: Props) {
  const [imgError, setImgError] = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  if (!postType || postType === "text") return null;

  if (postType === "video" && videoUrl) {
    return <VideoPlayer url={videoUrl}/>;
  }

  if ((postType === "image" || postType === "gif") && imageUrl && !imgError) {
    return (
      <div style={{ marginBottom:12, borderRadius:10, overflow:"hidden", position:"relative" }}>
        {!loaded && (
          <div style={{
            height:200, background:"#111113", display:"flex",
            alignItems:"center", justifyContent:"center", borderRadius:10,
          }}>
            <ImageIcon size={24} color="#3f3f46"/>
          </div>
        )}
        <img
          src={imageUrl}
          alt={linkTitle || ""}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            display: loaded ? "block" : "none",
            width:"100%", height:"auto",
            maxHeight:480, objectFit:"contain",
            background:"#0d0d0f", borderRadius:10,
          }}
        />
        {sourceName && loaded && (
          <div style={{
            position:"absolute", bottom:8, right:8,
            background:"#00000099", borderRadius:6,
            padding:"2px 8px", fontSize:10, color:"#a1a1aa",
          }}>
            {sourceName}
          </div>
        )}
      </div>
    );
  }

  if (postType === "link" && (linkUrl || linkTitle)) {
    return (
      <a href={linkUrl || "#"} target="_blank" rel="noopener noreferrer" style={{
        display:"flex", alignItems:"center", gap:10,
        marginBottom:12, padding:"10px 14px",
        background:"#111113", borderRadius:10,
        border:"1px solid #27272a", textDecoration:"none",
        transition:"border-color 0.15s",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor="#3f3f46")}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor="#27272a")}
      >
        <ExternalLink size={14} color="#71717a" style={{ flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{
            fontSize:12, color:"#a1a1aa", fontWeight:600,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {linkTitle || linkUrl}
          </p>
          {sourceName && (
            <p style={{ fontSize:10, color:"#52525b", marginTop:2 }}>{sourceName}</p>
          )}
        </div>
      </a>
    );
  }

  return null;
}
