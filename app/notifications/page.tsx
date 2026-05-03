"use client";
import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Bell, CheckCheck } from "lucide-react";

const TYPE_ICONS: Record<string, string> = {
  comment: "💬", reply: "↩️", follow: "👤", mention: "@",
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (!saved) { setLoading(false); return; }
    try {
      const u = JSON.parse(saved);
      setToken(u.token);
      fetch(`${API}/notifications`, { headers: { authorization: `Bearer ${u.token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(d => { setNotifs(Array.isArray(d) ? d : []); setLoading(false); })
        .catch(() => setLoading(false));
    } catch { setLoading(false); }
  }, []);

  async function markAllRead() {
    if (!token) return;
    await fetch(`${API}/notifications/read-all`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
  }

  async function markRead(n: any) {
    if (n.is_read || !token) return;
    await fetch(`${API}/notifications/${n.id}/read`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
  }

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b" }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={18} style={{ color: "#a78bfa" }} />
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fafafa" }}>Notifications</h1>
            {unread > 0 && (
              <span style={{
                background: "#7c3aed", color: "white", borderRadius: 20,
                fontSize: 11, fontWeight: 800, padding: "2px 8px",
              }}>{unread}</span>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "transparent", border: "1px solid #27272a",
              borderRadius: 8, padding: "6px 12px",
              fontSize: 12, fontWeight: 600, color: "#7c3aed", cursor: "pointer",
            }}>
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        <div style={{
          background: "#111113", border: "1px solid #1f1f23",
          borderRadius: 14, overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#3f3f46", fontSize: 13 }}>
              Loading...
            </div>
          ) : !token ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <Bell size={32} style={{ color: "#27272a", marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>Sign in to see notifications</div>
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <Bell size={32} style={{ color: "#27272a", marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>No notifications yet</div>
              <div style={{ fontSize: 12, color: "#3f3f46", marginTop: 6 }}>Activity will appear here</div>
            </div>
          ) : notifs.map((n, i) => (
            <div
              key={n.id}
              onClick={() => {
                markRead(n);
                if (n.link) window.location.href = n.link;
              }}
              style={{
                display: "flex", gap: 12, padding: "14px 16px",
                borderBottom: i < notifs.length - 1 ? "1px solid #1a1a1e" : "none",
                background: n.is_read ? "transparent" : "#7c3aed08",
                cursor: n.link ? "pointer" : "default",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#18181b")}
              onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? "transparent" : "#7c3aed08")}
            >
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>
                {TYPE_ICONS[n.type] || "🔔"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, lineHeight: 1.5,
                  color: n.is_read ? "#71717a" : "#d4d4d8",
                  fontWeight: n.is_read ? 400 : 600,
                  marginBottom: 2,
                }}>
                  {n.title}
                </p>
                {n.body && (
                  <p style={{
                    fontSize: 12, color: "#52525b", lineHeight: 1.4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    &ldquo;{n.body}&rdquo;
                  </p>
                )}
                <p style={{ fontSize: 11, color: "#3f3f46", marginTop: 4 }}>
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#7c3aed", flexShrink: 0, marginTop: 6,
                  boxShadow: "0 0 6px #7c3aed88",
                }} />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
