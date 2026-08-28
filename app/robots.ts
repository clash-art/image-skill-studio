import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/studio-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/widget.html", "/studio/image/widget.html"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
