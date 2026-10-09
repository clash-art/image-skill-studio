import { SEO_IMAGE_URL, seoSkills } from "./studio-seo-data.mjs";
import {
  absoluteSiteUrl,
  metadataAlternates,
  SITE_LOCALES,
  skillSitePath,
} from "./site-i18n.mjs";

function alternatesFor(sitePath) {
  const languages = metadataAlternates("en", sitePath).languages;
  return languages ? { languages } : undefined;
}

function localizedEntry(locale, sitePath, options) {
  return {
    url: absoluteSiteUrl(locale, sitePath),
    alternates: alternatesFor(sitePath),
    ...options,
  };
}

export function buildSitemapEntries() {
  const staticPaths = ["/", "/studio/image", "/studio/image/skills", "/studio/image/plugin"];
  const entries = [];

  for (const sitePath of staticPaths) {
    for (const locale of SITE_LOCALES) {
      entries.push(
        localizedEntry(locale, sitePath, {
          changeFrequency: sitePath === "/studio/image/plugin" ? "monthly" : "weekly",
          priority: sitePath === "/" || sitePath === "/studio/image" ? 1 : 0.75,
          ...(sitePath === "/" || sitePath === "/studio/image" ? { images: [SEO_IMAGE_URL] } : {}),
        }),
      );
    }
  }

  for (const skill of seoSkills) {
    const sitePath = skillSitePath(skill.id);
    const image = skill.cover && /^https:\/\//i.test(skill.cover) ? skill.cover : undefined;
    for (const locale of SITE_LOCALES) {
      entries.push(
        localizedEntry(locale, sitePath, {
          changeFrequency: "weekly",
          priority: 0.75,
          ...(image ? { images: [image] } : {}),
        }),
      );
    }
  }

  return entries;
}
