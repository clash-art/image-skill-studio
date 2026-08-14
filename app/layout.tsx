import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Skill Studio — Codex 生图工作台",
  description: "从 Codex Skill Catalog 选择创作方法，用 ImageGen 生成图片并导出小红书对比模板。",
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
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
