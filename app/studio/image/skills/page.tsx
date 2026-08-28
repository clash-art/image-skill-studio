import type { Metadata } from "next";
import Link from "next/link";

import { jsonLd, SEO_IMAGE_URL, seoSkills, skillImage, skillPageUrl, STUDIO_URL } from "@/lib/studio-seo";

import styles from "../seo.module.css";

export const metadata: Metadata = {
  title: "AI 图像 Skill 完整目录",
  description: "浏览 Image Skill Studio 的全部 AI 图像创作方法，覆盖海报、插画、拼贴、摄影重构、旅行卡片与复古界面。",
  alternates: { canonical: `${STUDIO_URL}/skills` },
  openGraph: {
    url: `${STUDIO_URL}/skills`,
    title: "AI 图像 Skill 完整目录",
    description: "按创作方法浏览可复用的 AI 图像 Skill 与真实生成案例。",
    images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio Skill 目录" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SEO_IMAGE_URL],
  },
};

export default function SkillsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI 图像 Skill 完整目录",
    url: `${STUDIO_URL}/skills`,
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
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <div className={styles.shell}>
        <nav className={styles.crumbs} aria-label="面包屑">
          <Link href="/studio/image">Image Skill Studio</Link><span>/</span><span>Skills</span>
        </nav>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Curated image methods</p>
            <h1 className={styles.title}>AI 图像 Skill 目录</h1>
            <p className={styles.lede}>每个 Skill 都是一套可复用的创作方法，包含明确输入、比例约束、真实参考图和生成案例。</p>
          </div>
        </header>
        <section aria-labelledby="skill-directory-title">
          <h2 id="skill-directory-title" className={styles.sectionTitle}>{seoSkills.length} 个创作方法</h2>
          <div className={styles.grid}>
            {seoSkills.map((skill) => {
              const image = skillImage(skill, skill.cover);
              return (
                <Link className={styles.card} href={skillPageUrl(skill.id)} key={skill.id}>
                  <span className={styles.cardMedia}>{image ? <img src={image} alt={`${skill.displayName} 生成案例`} loading="lazy" /> : null}</span>
                  <span className={styles.cardBody}>
                    <h2>{skill.displayName}</h2>
                    <p>{skill.description}</p>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
