"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Trophy, Bell, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

export default function BottomNav({
  onMenuOpen,
  userToken,
}: {
  onMenuOpen?: () => void;
  userToken?: string;
}) {
  const path = usePathname();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!userToken) return;
    const headers = { authorization: `Bearer ${userToken}` };
    const fetchCount = () =>
      fetch(`${API}/notifications/unread-count`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && typeof d.count === "number") setNotifCount(d.count); })
        .catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [userToken]);

  const TABS = [
    { href: "/",            icon: Home,          label: "Home",   badge: 0           },
    { href: "/search",      icon: Search,        label: "Search", badge: 0           },
    { href: "/arena",       icon: Trophy,        label: "Arena",  badge: 0           },
    { href: "/notifications", icon: Bell,        label: "Alerts", badge: notifCount  },
    { href: "/inbox",       icon: MessageCircle, label: "Inbox",  badge: 0           },
  ];

  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, icon: Icon, label, badge }) => {
        const active = path === href || (href !== "/" && path.startsWith(href));
        return (
          <Link key={href} href={href} style={{ textDecoration: "none", flex: 1 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, height: 56,
              color: active ? "#a78bfa" : "#71717a",
              transition: "color 0.15s",
            }}>
              <div style={{
                position: "relative",
                width: 36, height: 28, borderRadius: 10,
                background: active ? "#7c3aed18" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span style={{
                    position: "absolute", top: 1, right: 1,
                    minWidth: 14, height: 14, borderRadius: 7,
                    background: "#7c3aed", color: "white",
                    fontSize: 9, fontWeight: 800, lineHeight: "14px",
                    textAlign: "center", padding: "0 3px",
                    boxShadow: "0 0 0 2px #09090b",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                {label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
