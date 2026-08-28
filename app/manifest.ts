import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Image Skill Studio",
    short_name: "Image Skills",
    description: "发现可复用的 AI 图像创作 Skill、真实案例与提示词方法。",
    start_url: "/studio/image",
    scope: "/studio/image",
    display: "standalone",
    background_color: "#f4efe5",
    theme_color: "#f4efe5",
    lang: "zh-CN",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
