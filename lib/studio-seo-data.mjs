import registry from "../catalog/registry.json" with { type: "json" };

import { SITE_URL, STUDIO_URL } from "./site-urls.ts";

export { SITE_URL, STUDIO_URL };
export const STUDIO_PATH = "/studio/image";
export const SEO_IMAGE_URL = `${STUDIO_URL}/assets/seo/og-image.png`;
export const seoSkills = registry.skills;
