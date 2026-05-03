"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Trophy, Bell, MessageCircle } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { STRINGS } from "@/lib/i18n";

export default function MobileBottomNav({ notifCount = 0 }: { notifCount?: number }) {
  const path = usePathname();
  const locale = useLocale();
  const s = STRINGS[locale];

  const TABS = [
    { href: "/",              Icon: Home,          label: s.home   },
    { href: "/search",        Icon: Search,        label: s.search },
    { href: "/arena",         Icon: Trophy,        label: s.arena  },
    { href: "/notifications", Icon: Bell,          label: s.alerts },
    { href: "/inbox",         Icon: MessageCircle, label: s.inbox  },
  ];

  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 100,
      background: "#111113",
      borderTop: "1px solid #27272a",
      display: "flex",
      alignItems: "stretch",
      height: "calc(58px + env(safe-area-inset-bottom, 0px))",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {TABS.map(({ href, Icon, label }) => {
        const active = path === href || (href !== "/" && path.startsWith(href));
        const isAlert = href === "/notifications";
        return (
          <Link key={href} href={href} style={{ flex: 1, textDecoration: "none" }}>
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, height: "100%",
              color: active ? "#a78bfa" : "#71717a",
            }}>
              <div style={{ position: "relative" }}>
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8}/>
                {isAlert && notifCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -7,
                    minWidth: 15, height: 15, borderRadius: 8,
                    background: "#7c3aed", color: "white",
                    fontSize: 9, fontWeight: 800, lineHeight: "15px",
                    textAlign: "center", padding: "0 3px",
                    border: "2px solid #111113",
                  }}>
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
