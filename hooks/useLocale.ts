"use client";
import { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n";

export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const lang = navigator.language || navigator.languages?.[0] || "en";
    setLocale(lang.startsWith("ko") ? "ko" : "en");
  }, []);

  return locale;
}
