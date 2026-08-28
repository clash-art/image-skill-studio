import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  findSeoSkill,
  jsonLd,
  seoSkills,
  skillImage,
  skillPageUrl,
  skillSummary,
  studioSkillUrl,
  STUDIO_URL,
} from "@/lib/studio-seo";

import styles from "../../seo.module.css";

type SkillPageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return seoSkills.map((skill) => ({ id: skill.id }));
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const { id } = await params;
  const skill = findSeoSkill(id);
  if (!skill) return { title: "Skill 未找到", robots: { index: false, follow: false } };
  const canonical = skillPageUrl(skill.id);
  const image = skillImage(skill, skill.cover);
  const description = skillSummary(skill);
  return {
    title: `${skill.displayName} — AI 图像 Skill`,
    description,
    keywords: [skill.displayName, skill.category, "AI 图像生成", "Image Skill", "提示词", ...skill.capabilities.aspectRatios],
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${skill.displayName} — AI 图像 Skill`,
      description,
      images: image ? [{ url: image, alt: `${skill.displayName} 生成案例` }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${skill.displayName} — AI 图像 Skill`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { id } = await params;
  const skill = findSeoSkill(id);
  if (!skill) notFound();

  const canonical = skillPageUrl(skill.id);
  const cover = skillImage(skill, skill.cover);
  const examples = (skill.examples || []).slice(0, 6);
  const sourceUrl = skill.source?.homepage || (skill.source?.repo ? `https://github.com/${skill.source.repo}` : undefined);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Image Skill Studio", item: STUDIO_URL },
          { "@type": "ListItem", position: 2, name: "Skills", item: `${STUDIO_URL}/skills` },
          { "@type": "ListItem", position: 3, name: skill.displayName, item: canonical },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: skill.displayName,
        url: canonical,
        description: skillSummary(skill),
        image: cover,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web, Codex",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: skill.author ? { "@type": "Person", name: skill.author.name, url: skill.author.url } : undefined,
        sameAs: sourceUrl,
        license: skill.license?.spdx ? `https://spdx.org/licenses/${skill.license.spdx}.html` : undefined,
        featureList: [
          skill.capabilities.references ? `支持最多 ${skill.capabilities.maxReferences} 张参考图` : "无需参考图",
          `支持比例 ${skill.capabilities.aspectRatios.join(", ")}`,
        ],
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <div className={styles.shell}>
        <nav className={styles.crumbs} aria-label="面包屑">
          <Link href="/studio/image">Studio</Link><span>/</span><Link href="/studio/image/skills">Skills</Link><span>/</span><span>{skill.displayName}</span>
        </nav>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{skill.category} · Image Skill</p>
            <h1 className={styles.title}>{skill.displayName}</h1>
            <p className={styles.lede}>{skill.description}</p>
            <ul className={styles.facts} aria-label="Skill 能力">
              <li>{skill.capabilities.references ? `最多 ${skill.capabilities.maxReferences} 张参考图` : "无需参考图"}</li>
              <li>{skill.capabilities.aspectRatios.join(" · ")}</li>
              {skill.license?.name ? <li>{skill.license.name}</li> : null}
              {skill.stars ? <li>{skill.stars.toLocaleString()} GitHub stars</li> : null}
            </ul>
            <div className={styles.actions}>
              <a className={styles.primary} href={studioSkillUrl(skill.id)}>在 Studio 中打开</a>
              {sourceUrl ? <a className={styles.secondary} href={sourceUrl} target="_blank" rel="noopener noreferrer">查看 Skill 来源</a> : null}
            </div>
          </div>
          {cover ? <figure className={styles.cover}><img src={cover} alt={`${skill.displayName} 代表生成案例`} fetchPriority="high" /></figure> : null}
        </header>
        {examples.length ? (
          <section aria-labelledby="examples-title">
            <h2 id="examples-title" className={styles.sectionTitle}>真实生成案例</h2>
            <div className={styles.examples}>
              {examples.map((example, index) => {
                const image = skillImage(skill, example.image || example.preview);
                const title = example.title || `案例 ${index + 1}`;
                return (
                  <figure className={styles.example} key={example.id}>
                    <div className={styles.exampleMedia}>{image ? <img src={image} alt={`${skill.displayName} ${title}`} loading={index < 2 ? "eager" : "lazy"} /> : null}</div>
                    <figcaption className={styles.caption}>
                      <h2>{title}</h2>
                      {example.prompt ? <p>{example.prompt.length > 180 ? `${example.prompt.slice(0, 177)}…` : example.prompt}</p> : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
