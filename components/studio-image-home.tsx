import { ImageSkillStudio } from "@/components/image-skill-studio";
import { absoluteSiteUrl, type SiteLocale } from "@/lib/site-i18n";
import { jsonLd, seoSkills, skillPageUrl, STUDIO_URL } from "@/lib/studio-seo";
import { studioPreviewState } from "@/lib/studio-preview-state";

export function StudioImageHome({ locale }: { locale: SiteLocale }) {
  const studioUrl = absoluteSiteUrl(locale, "/studio/image");
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
        url: studioUrl,
        description: "用于发现、比较和使用可复用 AI 图像创作方法的工作台。",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web, Codex",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: ["文生图 Skill", "图生图 Skill", "真实生成案例", "参考图工作流", "提示词复用"],
      },
      {
        "@type": "CollectionPage",
        "@id": `${studioUrl}#collection`,
        name: "AI 图像 Skill 合集",
        url: studioUrl,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: seoSkills.length,
          itemListElement: seoSkills.map((skill, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: skill.displayName,
            url: skillPageUrl(skill.id, locale),
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
      <ImageSkillStudio initialState={studioPreviewState} previewMode />
    </>
  );
}
