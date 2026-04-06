"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const langs = Array.from(navigator.languages ?? [navigator.language]);
    const isJa = langs.some((l) => l.startsWith("ja"));
    if (isJa) {
      setLocale("ja");
      document.documentElement.lang = "ja";
    }
  }, []);

  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
