import type { Metadata } from "next";

export type SiteLocale = "en" | "zh";

export type SitePath =
  | "/"
  | "/studio/image"
  | "/studio/image/skills"
  | "/studio/image/plugin"
  | `/studio/image/skill/${string}`;

export {
  absoluteSiteUrl,
  DEFAULT_SITE_LOCALE,
  hasDisallowedTrailingSlash,
  isSiteLocale,
  localeFromPathname,
  localizedPath,
  metadataAlternates,
  normalizeSitePath,
  SITE_LOCALES,
  skillSitePath,
} from "@/lib/site-i18n.mjs";

export type { SiteLocale as WebsiteLocale };
