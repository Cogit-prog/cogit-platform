"use client";
import { API } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Camera, Check, Upload, User } from "lucide-react";

function resizeToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 300;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function SettingsPage() {
  const [user,     setUser]     = useState<any>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [pending,  setPending]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => {
    const s = localStorage.getItem("cogit_user");
    if (!s) { router.push("/join"); return; }
    try {
      const u = JSON.parse(s);
      setUser(u);
      if (u.avatar_url) setPreview(u.avatar_url);
    } catch { router.push("/join"); }
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("이미지 파일만 업로드 가능해요"); return; }
    setError("");
    try {
      const b64 = await resizeToBase64(file);
      setPending(b64);
      setPreview(b64);
    } catch { setError("이미지 처리 중 오류가 발생했어요"); }
  }

  async function handleSave() {
    if (!pending || !user?.token) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/users/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ data: pending }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.detail || "업로드 실패"); return; }
      const { avatar_url } = await res.json();
      const updated = { ...user, avatar_url };
      localStorage.setItem("cogit_user", JSON.stringify(updated));
      setUser(updated);
      setPending(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("연결 오류가 발생했어요"); }
    setSaving(false);
  }

  if (!user) return null;

  return (
    <div style={{ minHeight:"100vh", background:"#09090b" }}>
      <Navbar />
      <main className="max-w-lg mx-auto" style={{ padding:"40px 16px 80px" }}>

        <h1 style={{ fontSize:20, fontWeight:900, color:"#fafafa", marginBottom:6 }}>Settings</h1>
        <p style={{ fontSize:13, color:"#52525b", marginBottom:32 }}>@{user.username}</p>

        {/* Profile picture section */}
        <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:16, padding:24, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:20 }}>
            Profile Picture
          </div>

          <div style={{ display:"flex", gap:20, alignItems:"center", marginBottom:24 }}>
            {/* Current avatar */}
            <div style={{ position:"relative", flexShrink:0 }}>
              {preview ? (
                <img src={preview} alt="avatar" style={{
                  width:80, height:80, borderRadius:20, objectFit:"cover",
                  border:"2px solid #27272a",
                }}/>
              ) : (
                <div style={{
                  width:80, height:80, borderRadius:20,
                  background:"linear-gradient(135deg,#06b6d4,#7c3aed)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:32, fontWeight:800, color:"white",
                  border:"2px solid #27272a",
                }}>
                  {user.username?.[0]?.toUpperCase()}
                </div>
              )}
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  position:"absolute", bottom:-6, right:-6,
                  width:26, height:26, borderRadius:"50%",
                  background:"#7c3aed", border:"2px solid #111113",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer",
                }}
              >
                <Camera size={12} color="white"/>
              </button>
            </div>

            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#a1a1aa", marginBottom:4 }}>
                {user.username}
              </div>
              <div style={{ fontSize:11, color:"#3f3f46", lineHeight:1.6 }}>
                JPG, PNG 권장 · 자동으로 300×300 크롭
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            style={{
              border:`2px dashed ${dragging ? "#7c3aed" : "#27272a"}`,
              borderRadius:12, padding:"28px 20px",
              textAlign:"center", cursor:"pointer",
              background: dragging ? "#7c3aed0a" : "transparent",
              transition:"all 0.15s",
            }}
            onMouseEnter={e => { const t=e.currentTarget as HTMLElement; t.style.borderColor="#3f3f46"; t.style.background="#18181b"; }}
            onMouseLeave={e => { const t=e.currentTarget as HTMLElement; if (!dragging) { t.style.borderColor="#27272a"; t.style.background="transparent"; }}}
          >
            <Upload size={20} style={{ color:"#3f3f46", margin:"0 auto 8px", display:"block" }}/>
            <div style={{ fontSize:13, color:"#52525b", fontWeight:600 }}>
              클릭하거나 드래그해서 업로드
            </div>
            <div style={{ fontSize:11, color:"#3f3f46", marginTop:3 }}>
              최대 450KB (자동 압축됨)
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display:"none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {error && (
            <p style={{ fontSize:12, color:"#ef4444", marginTop:10 }}>{error}</p>
          )}

          {pending && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width:"100%", marginTop:14, padding:"12px",
                background: saving ? "#27272a" : "linear-gradient(135deg,#7c3aed,#06b6d4)",
                color:"white", border:"none", borderRadius:10,
                fontSize:14, fontWeight:700, cursor:saving ? "default" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                transition:"opacity 0.15s",
              }}
            >
              {saving ? (
                <><div style={{ width:14, height:14, border:"2px solid #ffffff44", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/> 저장 중...</>
              ) : (
                <><Upload size={14}/> 프로필 사진 저장</>
              )}
            </button>
          )}

          {saved && (
            <div style={{
              marginTop:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              fontSize:13, fontWeight:700, color:"#22c55e",
            }}>
              <Check size={14}/> 저장됐어요
            </div>
          )}
        </div>

        {/* Account info (read-only) */}
        <div style={{ background:"#111113", border:"1px solid #1f1f23", borderRadius:16, padding:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#52525b", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:16 }}>
            Account
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { label:"Username", value:`@${user.username}` },
              { label:"Email",    value:user.email || "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#52525b" }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:"#a1a1aa" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
