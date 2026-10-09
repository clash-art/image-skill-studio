import { SITE_URL } from "./site-urls.ts";

export const SITE_LOCALES = ["en", "zh"];
export const DEFAULT_SITE_LOCALE = "en";

export function isSiteLocale(value) {
  return value === "en" || value === "zh";
}

export function localeFromPathname(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/zh" || normalized.startsWith("/zh/")) return "zh";
  return "en";
}

export function normalizeSitePath(sitePath) {
  if (!sitePath || sitePath === "/") return "/";
  return `/${sitePath.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function localizedPath(locale, sitePath) {
  const normalized = normalizeSitePath(sitePath);
  if (normalized === "/") {
    return locale === "zh" ? "/zh" : "/";
  }
  const suffix = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return locale === "zh" ? `/zh${suffix}` : suffix;
}

export function absoluteSiteUrl(locale, sitePath) {
  const path = localizedPath(locale, sitePath);
  if (path === "/") return SITE_URL;
  return `${SITE_URL}${path}`;
}

export function hasDisallowedTrailingSlash(url) {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 1 && pathname.endsWith("/");
  } catch {
    return false;
  }
}

export function metadataAlternates(locale, sitePath) {
  const canonical = absoluteSiteUrl(locale, sitePath);
  return {
    canonical,
    languages: {
      en: absoluteSiteUrl("en", sitePath),
      "zh-Hans": absoluteSiteUrl("zh", sitePath),
      "x-default": absoluteSiteUrl("en", sitePath),
    },
  };
}

export function skillSitePath(skillId) {
  return `/studio/image/skill/${encodeURIComponent(skillId)}`;
}
