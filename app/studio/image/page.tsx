import { ImageSkillStudio, type StudioSnapshot } from "@/components/image-skill-studio";
import registry from "@/catalog/registry.json";
import { jsonLd, SEO_IMAGE_URL, seoSkills, skillPageUrl, STUDIO_URL } from "@/lib/studio-seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 图像 Skill 工作台与创作案例",
  description: "浏览 15 个可复用的 AI 图像创作 Skill，比较文生图、图生图、海报、拼贴、插画与复古界面案例。",
  alternates: { canonical: STUDIO_URL },
  openGraph: {
    url: STUDIO_URL,
    title: "AI 图像 Skill 工作台与创作案例",
    description: "浏览真实生成案例、参考图与提示词方法，在 Codex 中继续创作。",
    images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio 创意图像案例" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SEO_IMAGE_URL],
  },
};

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

const assetBaseUrl = (process.env.IMAGE_SKILL_STUDIO_ASSET_BASE_URL || "/studio/image/assets").replace(/\/+$/, "");

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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://clash.art/#website",
        name: "Image Skill Studio",
        alternateName: "Clash Image Skill Studio",
        url: "https://clash.art",
        inLanguage: ["zh-CN", "en"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${STUDIO_URL}#application`,
        name: "Image Skill Studio",
        url: STUDIO_URL,
        description: "用于发现、比较和使用可复用 AI 图像创作方法的工作台。",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web, Codex",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: ["文生图 Skill", "图生图 Skill", "真实生成案例", "参考图工作流", "提示词复用"],
      },
      {
        "@type": "CollectionPage",
        "@id": `${STUDIO_URL}#collection`,
        name: "AI 图像 Skill 合集",
        url: STUDIO_URL,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: seoSkills.length,
          itemListElement: seoSkills.map((skill, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: skill.displayName,
            url: skillPageUrl(skill.id),
          })),
        },
      },
    ],
  };

  return (
    <>
      <h1 className="sr-only">Image Skill Studio：AI 图像创作方法与真实案例</h1>
      <p className="sr-only">浏览文生图、图生图、海报、插画、拼贴和复古界面等可复用 Image Skill。</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <ImageSkillStudio initialState={previewState} previewMode />
    </>
  );
}
