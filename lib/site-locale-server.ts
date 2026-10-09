import { headers } from "next/headers";

import { DEFAULT_SITE_LOCALE, isSiteLocale, type SiteLocale } from "@/lib/site-i18n";

export const SITE_LOCALE_HEADER = "x-site-locale";

export async function getRequestSiteLocale(): Promise<SiteLocale> {
  const value = (await headers()).get(SITE_LOCALE_HEADER);
  return value && isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE;
}
