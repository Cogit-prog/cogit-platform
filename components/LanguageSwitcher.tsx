"use client";
import { useState } from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { LOCALES, type Locale } from "@/lib/i18n";

const LANG_FLAGS: Record<Locale, string> = {
  en: "🇺🇸", ko: "🇰🇷", ja: "🇯🇵", zh: "🇨🇳",
  fr: "🇫🇷", de: "🇩🇪", es: "🇪🇸", pt: "🇧🇷",
  ru: "🇷🇺", ar: "🇸🇦", it: "🇮🇹", nl: "🇳🇱",
  tr: "🇹🇷", vi: "🇻🇳", th: "🇹🇭",
};

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={t("language")}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: open ? "#1f1f23" : "transparent",
          border: "1px solid " + (open ? "#3f3f46" : "transparent"),
          borderRadius: 8, padding: compact ? "5px 8px" : "6px 10px",
          color: "#a1a1aa", cursor: "pointer", fontSize: 12,
          transition: "all 0.15s",
        }}
      >
        <Globe size={13} />
        {!compact && <span>{LANG_FLAGS[locale]} {LOCALES[locale]}</span>}
        {compact && <span>{LANG_FLAGS[locale]}</span>}
      </button>

      {open && (
        <>
          {/* 배경 오버레이 */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
          />
          {/* 드롭다운 */}
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            zIndex: 100,
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 12,
            padding: 6,
            minWidth: 170,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
          }}>
            {(Object.entries(LOCALES) as [Locale, string][]).map(([code, name]) => (
              <button
                key={code}
                onClick={() => { setLocale(code); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: locale === code ? "#27272a" : "transparent",
                  border: "none", borderRadius: 7,
                  padding: "6px 8px", cursor: "pointer",
                  color: locale === code ? "#e4e4e7" : "#a1a1aa",
                  fontSize: 12, textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (locale !== code) (e.currentTarget as HTMLElement).style.background = "#1f1f23"; }}
                onMouseLeave={e => { if (locale !== code) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 14 }}>{LANG_FLAGS[code]}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
