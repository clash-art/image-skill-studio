"use client";

import { createContext, useContext } from "react";

import type { SiteLocale } from "@/lib/site-i18n";

const SiteLocaleContext = createContext<SiteLocale>("en");

export function SiteLocaleProvider({
  locale,
  children,
}: {
  locale: SiteLocale;
  children: React.ReactNode;
}) {
  return <SiteLocaleContext.Provider value={locale}>{children}</SiteLocaleContext.Provider>;
}

export function useWebsiteLocale(): SiteLocale {
  return useContext(SiteLocaleContext);
}
