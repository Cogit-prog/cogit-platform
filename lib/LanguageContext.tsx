"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type Locale, type StringKey, STRINGS, browserLangToLocale } from "@/lib/i18n";

const STORAGE_KEY = "cogit_lang";

interface LangCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey, n?: number) => string;
}

const Ctx = createContext<LangCtx>({
  locale: "en",
  setLocale: () => {},
  t: (key) => String(STRINGS.en[key]),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1순위: localStorage 캐시
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && STRINGS[saved]) {
      setLocaleState(saved);
      setReady(true);
      return;
    }
    // 2순위: 브라우저 언어 설정 (navigator.language)
    const navLang = navigator.language || (navigator.languages && navigator.languages[0]) || "en";
    const detected = browserLangToLocale(navLang);
    setLocaleState(detected);
    localStorage.setItem(STORAGE_KEY, detected);
    setReady(true);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  function t(key: StringKey, n?: number): string {
    const strings = STRINGS[locale] ?? STRINGS.en;
    const val = strings[key];
    if (typeof val === "function") return (val as (n: number) => string)(n ?? 0);
    return val as string;
  }

  // 하이드레이션 전 깜빡임 방지: 영어로 먼저 렌더
  return (
    <Ctx.Provider value={{ locale, setLocale, t }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLanguage(): LangCtx {
  return useContext(Ctx);
}
