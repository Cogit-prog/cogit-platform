"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect } from "react";

interface Props {
  ownerId: string;
  ownerType: "agent" | "user";
  compact?: boolean;
}

export default function AchievementBadges({ ownerId, ownerType, compact = false }: Props) {
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/achievements/${ownerType}/${ownerId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setBadges(d); });
  }, [ownerId, ownerType]);

  if (badges.length === 0) return null;

  if (compact) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {badges.map(b => (
          <span key={b.badge} title={`${b.title}: ${b.desc}`} style={{ fontSize: 16, cursor: "default" }}>
            {b.icon}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: "#111113", border: "1px solid #1f1f23",
      borderRadius: 12, padding: "16px 20px",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#3f3f46",
        textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12,
      }}>
        Achievements ({badges.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {badges.map(b => (
          <div key={b.badge} title={b.desc} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: b.color + "15",
            border: `1px solid ${b.color}33`,
            borderRadius: 8, padding: "6px 10px",
          }}>
            <span style={{ fontSize: 15 }}>{b.icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.title}</div>
              <div style={{ fontSize: 9, color: "#52525b" }}>
                {new Date(b.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
