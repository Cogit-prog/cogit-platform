"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onSkip: () => void;
}

export default function HeroVideo({ onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [visible, setVisible] = useState(true);
  const [muted, setMuted] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const onTimeUpdate = () => {
      if (v.duration) {
        setProgress(v.currentTime / v.duration);
        setDuration(v.duration);
      }
    };
    const onEnded = () => handleSkip();
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  function handleSkip() {
    if (!visible) return;
    setVisible(false);
    setTimeout(onSkip, 400);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  const remaining = duration > 0 ? Math.ceil(duration - progress * duration) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#000",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.4s ease",
      pointerEvents: visible ? "auto" : "none",
    }}>
      {/* Video */}
      <video
        ref={videoRef}
        src="/neos_hero.mp4"
        muted
        playsInline
        autoPlay
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
      />

      {/* Bottom gradient */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.7) 100%)",
      }}/>

      {/* Join button — center bottom */}
      <div style={{
        position: "absolute", bottom: "12%", left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.push("/join")}
          style={{
            padding: "16px 48px", borderRadius: 14, fontSize: 17, fontWeight: 800,
            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            color: "white", border: "none", cursor: "pointer",
            boxShadow: "0 6px 32px rgba(124,58,237,0.55)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 8px 40px rgba(124,58,237,0.7)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(124,58,237,0.55)"; }}
        >
          Join Cogit →
        </button>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Free to join</span>
      </div>

      {/* Mute toggle — bottom left */}
      <button
        onClick={toggleMute}
        style={{
          position: "absolute", bottom: 32, left: 32,
          width: 42, height: 42, borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "white", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
        title={muted ? "소리 켜기" : "소리 끄기"}
      >
        {muted ? (
          /* 음소거 아이콘 */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          /* 소리 아이콘 */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        )}
      </button>

      {/* Skip button — bottom right */}
      <button
        onClick={handleSkip}
        style={{
          position: "absolute", bottom: 32, right: 32,
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 100,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.85)",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          backdropFilter: "blur(8px)", transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      >
        {remaining !== null && remaining > 3 && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>{remaining}s</span>
        )}
        Skip
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/>
        </svg>
      </button>

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.15)" }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
          transition: "width 0.3s linear",
        }}/>
      </div>

      {/* Cogit wordmark */}
      <div style={{
        position: "absolute", top: 28, left: 32,
        fontSize: 18, fontWeight: 900, color: "white",
        letterSpacing: "-0.5px", textShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}>
        COGIT
      </div>
    </div>
  );
}
