"use client";
import { API, WS_API } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Props { token: string }

export default function NotificationBell({ token }: Props) {
  const [count, setCount]   = useState(0);
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const headers = { authorization: `Bearer ${token}` };
    const fetchCount = () =>
      fetch(`${API}/notifications/unread-count`, { headers })
        .then(r => r.json()).then(d => setCount(d.count || 0)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function openPanel() {
    setOpen(o => !o);
    if (!open) {
      const res = await fetch(`${API}/notifications`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) setNotifs(await res.json());
    }
  }

  async function markAllRead() {
    await fetch(`${API}/notifications/read-all`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });
    setCount(0);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
  }

  const TYPE_ICONS: Record<string, string> = {
    comment: "💬", reply: "↩️", follow: "👤", mention: "@",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={openPanel}
        style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8, border: "1px solid #27272a",
          background: "transparent", cursor: "pointer", color: count > 0 ? "#a78bfa" : "#52525b",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46"; (e.currentTarget as HTMLElement).style.color = "#fafafa"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#27272a"; (e.currentTarget as HTMLElement).style.color = count > 0 ? "#a78bfa" : "#52525b"; }}
      >
        <Bell size={15} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "#7c3aed", color: "white", borderRadius: "50%",
            width: 16, height: 16, fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #09090b",
          }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, zIndex: 100,
          background: "#111113", border: "1px solid #27272a", borderRadius: 14,
          boxShadow: "0 12px 40px #00000088",
          animation: "fadeDown 0.15s ease",
        }}>
          <style>{`@keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid #1f1f23",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>Notifications</span>
            {count > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", fontWeight: 600,
              }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 12, color: "#52525b" }}>
                No notifications yet
              </div>
            ) : notifs.map(n => (
              <div key={n.id}
                style={{
                  display: "flex", gap: 10, padding: "12px 16px",
                  borderBottom: "1px solid #18181b",
                  background: n.is_read ? "transparent" : "#7c3aed08",
                  cursor: n.link ? "pointer" : "default",
                }}
                onClick={() => {
                  if (n.link) window.location.href = n.link;
                  fetch(`${API}/notifications/${n.id}/read`, {
                    method: "POST", headers: { authorization: `Bearer ${token}` }
                  });
                  setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
                  setCount(c => Math.max(0, c - (n.is_read ? 0 : 1)));
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {TYPE_ICONS[n.type] || "🔔"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: n.is_read ? "#71717a" : "#d4d4d8", fontWeight: n.is_read ? 400 : 600, lineHeight: 1.4 }}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p style={{ fontSize: 11, color: "#52525b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      "{n.body}"
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: "#3f3f46", marginTop: 3 }}>
                    {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.is_read && (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", flexShrink: 0, marginTop: 5 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
