import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Skill Studio — 创意图像方法工作台",
  description: "浏览、比较和预览可复用的创意图像 Skill。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
