import type { Metadata } from "next";
import "./globals.css";

const seoImageUrl = "https://clash.art/studio/image/assets/seo/og-image.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://clash.art"),
  title: {
    default: "Image Skill Studio | AI 图像创作方法与案例",
    template: "%s | Image Skill Studio",
  },
  description: "发现可复用的 AI 图像创作 Skill，浏览真实生成案例、参考图与提示词方法，并在 Codex 中继续创作。",
  applicationName: "Image Skill Studio",
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
  alternates: {
    canonical: "/studio/image",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/studio/image",
    siteName: "Image Skill Studio",
    title: "Image Skill Studio | AI 图像创作方法与案例",
    description: "发现可复用的 AI 图像创作 Skill，浏览真实案例、参考图与提示词方法。",
    images: [{
      url: seoImageUrl,
      width: 1200,
      height: 630,
      alt: "Image Skill Studio 创意图像案例",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Image Skill Studio | AI 图像创作方法与案例",
    description: "发现可复用的 AI 图像创作 Skill，浏览真实案例、参考图与提示词方法。",
    images: [seoImageUrl],
  },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const remoteStylesheet = remoteStylesheetUrl(process.env.IMAGE_SKILL_STUDIO_REMOTE_STYLESHEET_URL);
  return (
    <html lang="zh-CN">
      <head>
        {remoteStylesheet ? (
          <link rel="stylesheet" data-image-skill-studio-remote href={remoteStylesheet} />
        ) : null}
      </head>
      <body>{children}</body>
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
