import type { MetadataRoute } from "next";

import { buildSitemapEntries } from "@/lib/sitemap-entries";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries();
}
