import { ImageSkillStudio, type StudioSnapshot } from "@/components/image-skill-studio";
import registry from "@/catalog/registry.json";

type RegistryImageSlot = {
  id: string;
  image?: string;
  prompt?: string;
  aspectRatio?: string;
  caption?: string;
  mode?: "text-to-image" | "image-to-image";
  referenceImage?: string;
  mediaOrigin?: "studio";
};

type RegistrySkill = {
  id: string;
  origin: string;
  displayName: string;
  description: string;
  category: string;
  cover?: string;
  coverOrigin?: "studio";
  stars?: number;
  examples?: RegistryImageSlot[];
  gallery?: RegistryImageSlot[];
  source?: { repo: string; commit: string; homepage?: string };
  license?: { name: string; spdx?: string | null; redistribute?: boolean; commercial?: boolean; note?: string };
  author?: { name: string; url: string };
  capabilities: { references: boolean; maxReferences: number; aspectRatios: string[] };
};

const assetBaseUrl = (process.env.IMAGE_SKILL_STUDIO_ASSET_BASE_URL || "/studio-assets").replace(/\/+$/, "");

// Studio examples are catalog-owned artifacts, not files from each Skill's
// upstream repository. Development streams them from disk; deployments can
// point the same paths at object storage or a CDN.
function mediaUrl(skill: RegistrySkill, assetPath?: string, mediaOrigin?: "studio") {
  if (!assetPath) return undefined;
  if (/^https:\/\//i.test(assetPath)) return assetPath;
  if (skill.origin === "remote" && mediaOrigin !== "studio" && skill.source) {
    const encoded = assetPath.split("/").map(encodeURIComponent).join("/");
    return `https://raw.githubusercontent.com/${skill.source.repo}/${skill.source.commit}/${encoded}`;
  }
  const relativePath = assetPath
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^assets\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${assetBaseUrl}/${relativePath}`;
}

const previewState: StudioSnapshot = {
  skills: (registry.skills as unknown as RegistrySkill[]).map((entry) => ({
    id: entry.id,
    displayName: entry.displayName,
    description: entry.description,
    category: entry.category,
    availability: entry.origin === "remote" ? "available" : "ready",
    origin: entry.origin,
    canInstall: entry.origin !== "host",
    needsFetch: entry.origin === "remote",
    contentHash: entry.origin === "host" ? "system" : "local",
    stars: entry.stars ?? null,
    license: entry.license,
    author: entry.author,
    upstream: entry.source ? { repo: entry.source.repo, commit: entry.source.commit, homepage: entry.source.homepage } : undefined,
    preview: mediaUrl(entry, entry.cover, entry.coverOrigin),
    examples: (entry.examples || []).slice(0, registry.exampleSlotLimit).map((example) => ({
      id: example.id,
      prompt: example.prompt ?? entry.description,
      aspectRatio: example.aspectRatio ?? "3:4",
      preview: mediaUrl(entry, example.image, example.mediaOrigin),
      mode: example.mode,
      referencePreview: mediaUrl(entry, example.referenceImage, example.mediaOrigin),
    })),
    gallery: (entry.gallery || []).slice(0, registry.gallerySlotLimit).map((item) => ({
      id: item.id,
      caption: item.caption,
      aspectRatio: item.aspectRatio,
      preview: mediaUrl(entry, item.image, item.mediaOrigin),
    })),
    capabilities: entry.capabilities,
  })),
  runs: [],
};

export default function Home() {
  return <ImageSkillStudio initialState={previewState} previewMode />;
}
