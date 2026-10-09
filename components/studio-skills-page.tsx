import Link from "next/link";

import { absoluteSiteUrl, localizedPath, type SiteLocale } from "@/lib/site-i18n";
import { jsonLd, seoSkills, skillImage, skillPageUrl } from "@/lib/studio-seo";

import styles from "@/app/studio/image/seo.module.css";

export function StudioSkillsPage({ locale }: { locale: SiteLocale }) {
  const skillsUrl = absoluteSiteUrl(locale, "/studio/image/skills");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI 图像 Skill 完整目录",
    url: skillsUrl,
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
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <div className={styles.shell}>
        <nav className={styles.crumbs} aria-label="面包屑">
          <Link href={localizedPath(locale, "/studio/image")}>Image Skill Studio</Link><span>/</span><span>Skills</span>
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
                <Link className={styles.card} href={skillPageUrl(skill.id, locale)} key={skill.id}>
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
