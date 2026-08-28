import registry from "@/catalog/registry.json";

export const SITE_URL = "https://clash.art";
export const STUDIO_PATH = "/studio/image";
export const STUDIO_URL = `${SITE_URL}${STUDIO_PATH}`;
export const SEO_IMAGE_URL = `${STUDIO_URL}/assets/seo/og-image.png`;

export type SeoExample = {
  id: string;
  title?: string;
  prompt?: string;
  image?: string;
  preview?: string;
  aspectRatio?: string;
  mode?: "text-to-image" | "image-to-image";
  mediaOrigin?: "studio";
};

export type SeoSkill = {
  id: string;
  origin: string;
  displayName: string;
  description: string;
  category: string;
  cover?: string;
  coverOrigin?: "studio";
  stars?: number;
  examples?: SeoExample[];
  author?: { name: string; url: string };
  license?: { name: string; spdx?: string | null };
  source?: { repo: string; commit: string; homepage?: string };
  capabilities: { references: boolean; maxReferences: number; aspectRatios: string[] };
};

export const seoSkills = registry.skills as unknown as SeoSkill[];

export function skillPageUrl(id: string) {
  return `${STUDIO_URL}/skill/${encodeURIComponent(id)}`;
}

export function studioSkillUrl(id: string) {
  return `${STUDIO_URL}#skill/${encodeURIComponent(id)}`;
}

export function findSeoSkill(id: string) {
  return seoSkills.find((skill) => skill.id === id);
}

export function skillImage(skill: SeoSkill, value?: string) {
  if (!value) return undefined;
  if (/^https:\/\//i.test(value)) return value;
  if (skill.origin === "remote" && skill.source) {
    const path = value.split("/").map(encodeURIComponent).join("/");
    return `https://raw.githubusercontent.com/${skill.source.repo}/${skill.source.commit}/${path}`;
  }
  const path = value
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^assets\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${STUDIO_URL}/assets/${path}`;
}

export function skillSummary(skill: SeoSkill) {
  const modes = new Set((skill.examples || []).map((example) => example.mode));
  const modeLabel = [
    modes.has("text-to-image") ? "文生图" : null,
    modes.has("image-to-image") ? "图生图" : null,
  ].filter(Boolean).join("、");
  return `${skill.description}${modeLabel ? ` 支持${modeLabel}` : ""}，可用比例：${skill.capabilities.aspectRatios.join("、")}。`;
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
