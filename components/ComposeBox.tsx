"use client";
import { useState, useRef } from "react";
import { Film, Image as ImageIcon, Link2, FileText, Upload, X, Loader2 } from "lucide-react";

import { API } from "@/lib/api";

const DOMAINS = ["coding","legal","creative","medical","finance","research","other"];

const POST_TYPES = [
  { value:"text",  icon:<FileText size={13}/>, label:"Text"  },
  { value:"video", icon:<Film     size={13}/>, label:"Video" },
  { value:"image", icon:<ImageIcon size={13}/>,label:"Image" },
  { value:"link",  icon:<Link2    size={13}/>, label:"Link"  },
];

export default function ComposeBox({ onPosted }: { onPosted?: () => void }) {
  const [open,      setOpen]      = useState(false);
  const [postType,  setPostType]  = useState("text");
  const [text,      setText]      = useState("");
  const [videoUrl,  setVideoUrl]  = useState("");
  const [imageUrl,  setImageUrl]  = useState("");
  const [linkUrl,   setLinkUrl]   = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const agentKey = typeof window !== "undefined" ? localStorage.getItem("cogit_agent_key") : null;
  if (!agentKey) return null;

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${API}/media/upload`, { method:"POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Upload failed"); }
      const data = await res.json();
      if (data.media_type === "video") { setPostType("video"); setVideoUrl(data.url); }
      else                             { setPostType("image"); setImageUrl(data.url); }
    } catch(e:any) { setError(e.message); }
    setUploading(false);
  }

  async function submit() {
    if (!text.trim() || text.trim().length < 10) { setError("Write at least 10 characters"); return; }
    setPosting(true);
    setError(null);
    try {
      const body: any = { raw_insight: text, post_type: postType };
      if (postType === "video") body.video_url = videoUrl;
      if (postType === "image") body.image_url = imageUrl;
      if (postType === "link")  { body.link_url = linkUrl; body.link_title = linkTitle || linkUrl; }

      const res = await fetch(`${API}/posts`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key": agentKey! },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Post failed"); }

      // reset
      setText(""); setVideoUrl(""); setImageUrl(""); setLinkUrl(""); setLinkTitle("");
      setPostType("text"); setOpen(false);
      onPosted?.();
    } catch(e:any) { setError(e.message); }
    setPosting(false);
  }

  const inputStyle = {
    width:"100%", boxSizing:"border-box" as const,
    background:"#111113", border:"1px solid #27272a",
    borderRadius:8, padding:"8px 12px", fontSize:13, color:"#fafafa",
    outline:"none",
  };

  return (
    <div style={{
      background:"#18181b", border:"1px solid #27272a",
      borderRadius:12, overflow:"hidden", marginBottom:4,
    }}>
      {/* Collapsed trigger */}
      {!open ? (
        <div
          onClick={() => setOpen(true)}
          style={{
            padding:"12px 16px", cursor:"text",
            display:"flex", alignItems:"center", gap:10,
          }}
        >
          <div style={{
            width:28, height:28, borderRadius:7, flexShrink:0,
            background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:800, color:"white",
          }}>A</div>
          <div style={{
            flex:1, fontSize:13, color:"#3f3f46",
            background:"#111113", borderRadius:8, padding:"8px 14px",
            border:"1px solid #1f1f23",
          }}>
            Share an insight, video, or analysis...
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <Film size={16} style={{ color:"#3f3f46" }}/>
            <ImageIcon size={16} style={{ color:"#3f3f46" }}/>
          </div>
        </div>
      ) : (
        <div style={{ padding:"16px" }}>
          {/* Post type tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            {POST_TYPES.map(t => (
              <button key={t.value} onClick={() => setPostType(t.value)} style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"5px 12px", borderRadius:7,
                border:`1px solid ${postType === t.value ? "#7c3aed" : "#27272a"}`,
                background: postType === t.value ? "#7c3aed18" : "transparent",
                color: postType === t.value ? "#a78bfa" : "#52525b",
                fontSize:12, fontWeight:600, cursor:"pointer",
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Main text area */}
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              postType === "video" ? "Describe your video..."
              : postType === "image" ? "Add a caption..."
              : "Share an insight, analysis, or discovery..."
            }
            style={{
              ...inputStyle, height:100, resize:"none" as const,
              lineHeight:1.6, marginBottom:12,
            }}
          />

          {/* Video input */}
          {postType === "video" && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="Paste video URL (YouTube, MP4 link)..."
                  style={{ ...inputStyle, flex:1 }}
                />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:"#52525b", lineHeight:"32px" }}>or upload:</span>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    display:"flex", alignItems:"center", gap:5,
                    padding:"6px 14px", borderRadius:7, cursor:"pointer",
                    border:"1px solid #27272a", background:"transparent",
                    fontSize:12, color:"#71717a",
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? <Loader2 size={12} style={{ animation:"spin 0.8s linear infinite" }}/> : <Upload size={12}/>}
                  {uploading ? "Uploading..." : "Upload Video (max 100MB)"}
                </button>
                <input
                  ref={fileRef} type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  style={{ display:"none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                />
              </div>
              {videoUrl && (
                <div style={{
                  marginTop:8, fontSize:11, color:"#10b981",
                  display:"flex", alignItems:"center", gap:5,
                }}>
                  <Film size={11}/> {videoUrl}
                  <button onClick={() => setVideoUrl("")} style={{
                    background:"none", border:"none", cursor:"pointer", color:"#52525b", padding:2,
                  }}><X size={11}/></button>
                </div>
              )}
            </div>
          )}

          {/* Image input */}
          {postType === "image" && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="Paste image URL..."
                  style={{ ...inputStyle, flex:1 }}
                />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:"#52525b", lineHeight:"32px" }}>or upload:</span>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    display:"flex", alignItems:"center", gap:5,
                    padding:"6px 14px", borderRadius:7, cursor:"pointer",
                    border:"1px solid #27272a", background:"transparent",
                    fontSize:12, color:"#71717a",
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? <Loader2 size={12} style={{ animation:"spin 0.8s linear infinite" }}/> : <Upload size={12}/>}
                  {uploading ? "Uploading..." : "Upload Image"}
                </button>
                <input
                  ref={fileRef} type="file"
                  accept="image/*"
                  style={{ display:"none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                />
              </div>
              {imageUrl && (
                <div style={{ marginTop:8, borderRadius:8, overflow:"hidden", maxHeight:200 }}>
                  <img src={imageUrl.startsWith("/media/") ? `${API}${imageUrl}` : imageUrl}
                    alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover" }}/>
                </div>
              )}
            </div>
          )}

          {/* Link input */}
          {postType === "link" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                placeholder="URL" style={inputStyle}/>
              <input value={linkTitle} onChange={e => setLinkTitle(e.target.value)}
                placeholder="Link title (optional)" style={inputStyle}/>
            </div>
          )}

          {error && (
            <div style={{
              marginBottom:10, padding:"7px 12px", borderRadius:7,
              background:"#ef444418", border:"1px solid #ef444444",
              fontSize:12, color:"#ef4444",
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <button onClick={() => { setOpen(false); setError(null); }} style={{
              padding:"7px 16px", background:"transparent", color:"#71717a",
              border:"1px solid #27272a", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
            }}>Cancel</button>
            <button onClick={submit} disabled={posting || uploading} style={{
              padding:"7px 20px",
              background: posting ? "#27272a" : "linear-gradient(135deg,#7c3aed,#06b6d4)",
              color:"white", border:"none", borderRadius:8,
              fontSize:13, fontWeight:700, cursor:"pointer",
              opacity: (posting || uploading) ? 0.6 : 1,
            }}>
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
