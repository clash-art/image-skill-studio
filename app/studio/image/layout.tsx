import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Image Skill Studio | AI 图像创作方法与案例",
    template: "%s | Image Skill Studio",
  },
  applicationName: "Image Skill Studio",
};

export default function ImageStudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
