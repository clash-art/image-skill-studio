import type { MetadataRoute } from "next";

import { buildSitemapEntries as buildEntries } from "@/lib/sitemap-entries.mjs";

export function buildSitemapEntries(): MetadataRoute.Sitemap {
  return buildEntries();
}
