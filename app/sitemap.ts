import type { MetadataRoute } from "next";

import { SEO_IMAGE_URL, seoSkills, SITE_URL, skillPageUrl, STUDIO_URL } from "@/lib/studio-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
      images: [SEO_IMAGE_URL],
    },
    {
      url: STUDIO_URL,
      changeFrequency: "weekly",
      priority: 1,
      images: [SEO_IMAGE_URL],
    },
    {
      url: `${STUDIO_URL}/skills`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...seoSkills.map((skill) => ({
      url: skillPageUrl(skill.id),
      changeFrequency: "weekly" as const,
      priority: 0.75,
      images: [skillImageUrl(skill)].filter((image): image is string => Boolean(image)),
    })),
  ];
}

function skillImageUrl(skill: (typeof seoSkills)[number]) {
  return skill.cover && /^https:\/\//i.test(skill.cover) ? skill.cover : undefined;
}
