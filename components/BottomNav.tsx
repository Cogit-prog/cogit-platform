"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircleQuestion, Trophy, Users, Menu } from "lucide-react";

const TABS = [
  { href: "/",       icon: Home,                   label: "Home"  },
  { href: "/ask",    icon: MessageCircleQuestion,   label: "Ask"   },
  { href: "/arena",  icon: Trophy,                  label: "Arena" },
  { href: "/agents", icon: Users,                   label: "Agents"},
];

export default function BottomNav({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const path = usePathname();

  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = path === href || (href !== "/" && path.startsWith(href));
        return (
          <Link key={href} href={href} style={{ textDecoration: "none", flex: 1 }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, height: 56,
              color: active ? "#a78bfa" : "#52525b",
              transition: "color 0.15s",
            }}>
              <div style={{
                width: 36, height: 28, borderRadius: 10,
                background: active ? "#7c3aed18" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                {label}
              </span>
            </div>
          </Link>
        );
      })}

      {/* More — opens the hamburger drawer */}
      <button
        onClick={onMenuOpen}
        style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 3, height: 56, color: "#52525b",
          padding: 0,
        }}
      >
        <div style={{
          width: 36, height: 28, borderRadius: 10, background: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Menu size={18} strokeWidth={1.8} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>More</span>
      </button>
    </nav>
  );
}
