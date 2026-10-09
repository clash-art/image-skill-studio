import type { Metadata } from "next";
import "./globals.css";

import { SiteLocaleProvider } from "@/components/site-locale-provider";
import { getRequestSiteLocale } from "@/lib/site-locale-server";

const seoImageUrl = "https://clash.art/studio/image/assets/seo/og-image.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://clash.art"),
  title: {
    default: "Clash | Creative Workspace for Agents",
  },
  description: "Clash 是面向创作者与 Agents 的统一创意工作台，在同一个空间中组织灵感、素材、工具与创作流程。",
  applicationName: "Clash",
  keywords: [
    "AI 图像生成",
    "Image Skill",
    "AI 海报设计",
    "提示词",
    "图生图",
    "文生图",
    "Codex",
  ],
  authors: [{ name: "Clash", url: "https://clash.art" }],
  creator: "Clash",
  publisher: "Clash",
  category: "design",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Clash",
    images: [{
      url: seoImageUrl,
      width: 1200,
      height: 630,
      alt: "Clash creative workspace",
    }],
  },
  twitter: {
    card: "summary_large_image",
    images: [seoImageUrl],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestSiteLocale();
  const lang = locale === "zh" ? "zh-CN" : "en";
  const remoteStylesheet = remoteStylesheetUrl(process.env.IMAGE_SKILL_STUDIO_REMOTE_STYLESHEET_URL);
  return (
    <html lang={lang} data-locale={locale} data-site-locale={locale}>
      <head>
        {remoteStylesheet ? (
          <link rel="stylesheet" data-image-skill-studio-remote href={remoteStylesheet} />
        ) : null}
      </head>
      <body>
        <SiteLocaleProvider locale={locale}>{children}</SiteLocaleProvider>
      </body>
    </html>
  );
}

function remoteStylesheetUrl(value?: string) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}
