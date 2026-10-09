import type { Metadata } from "next";

import { absoluteSiteUrl, metadataAlternates, type SiteLocale } from "@/lib/site-i18n";
import { SEO_IMAGE_URL } from "@/lib/studio-seo";

export function studioImageMetadata(locale: SiteLocale): Metadata {
  const pageUrl = absoluteSiteUrl(locale, "/studio/image");
  return {
    title: "AI 图像 Skill 工作台与创作案例",
    description: "浏览 15 个可复用的 AI 图像创作 Skill，比较文生图、图生图、海报、拼贴、插画与复古界面案例。",
    alternates: metadataAlternates(locale, "/studio/image"),
    openGraph: {
      url: pageUrl,
      title: "AI 图像 Skill 工作台与创作案例",
      description: "浏览真实生成案例、参考图与提示词方法，在 Codex 中继续创作。",
      images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio 创意图像案例" }],
    },
    twitter: {
      card: "summary_large_image",
      images: [SEO_IMAGE_URL],
    },
  };
}

export function studioSkillsMetadata(locale: SiteLocale): Metadata {
  const pageUrl = absoluteSiteUrl(locale, "/studio/image/skills");
  return {
    title: "AI 图像 Skill 完整目录",
    description: "浏览 Image Skill Studio 的全部 AI 图像创作方法，覆盖海报、插画、拼贴、摄影重构、旅行卡片与复古界面。",
    alternates: metadataAlternates(locale, "/studio/image/skills"),
    openGraph: {
      url: pageUrl,
      title: "AI 图像 Skill 完整目录",
      description: "按创作方法浏览可复用的 AI 图像 Skill 与真实生成案例。",
      images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio Skill 目录" }],
    },
    twitter: { card: "summary_large_image", images: [SEO_IMAGE_URL] },
  };
}

export function studioPluginMetadata(locale: SiteLocale): Metadata {
  const pageUrl = absoluteSiteUrl(locale, "/studio/image/plugin");
  return {
    title: "安装 Image Skill Studio Codex 插件",
    description:
      "通过两条 Codex 插件命令安装 Image Skill Studio，浏览社区图像 Skills，将提示词与参考图交给当前 Agent，并在本地收集生成结果。",
    alternates: metadataAlternates(locale, "/studio/image/plugin"),
    openGraph: {
      type: "website",
      url: pageUrl,
      title: "安装 Image Skill Studio Codex 插件",
      description: "免费安装社区驱动的 AI 图像 Skill 工作台。无需克隆仓库或安装 Node.js。",
      images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio Codex 插件" }],
    },
    twitter: { card: "summary_large_image", images: [SEO_IMAGE_URL] },
  };
}

export function clashHomeMetadata(locale: SiteLocale): Metadata {
  const pageUrl = absoluteSiteUrl(locale, "/");
  const title = "Clash | Creative Workspace for Agents";
  const description =
    locale === "zh"
      ? "Clash 是面向创作者与 Agents 的统一创意工作台，在同一个空间中组织灵感、素材、工具与创作流程。"
      : "Clash is a unified creative workspace for agents — ideas, media, tools, and workflows in one place.";
  return {
    title,
    description,
    alternates: metadataAlternates(locale, "/"),
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Clash creative product family" }],
    },
    twitter: { card: "summary_large_image", images: [SEO_IMAGE_URL] },
  };
}
