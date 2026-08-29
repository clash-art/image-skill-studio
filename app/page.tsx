import type { Metadata } from "next";
import Link from "next/link";

import {
  jsonLd,
  SEO_IMAGE_URL,
  seoSkills,
  SITE_URL,
  skillImage,
} from "@/lib/studio-seo";

import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Clash | Creative Workspace for Agents",
  description: "Clash 是面向创作者与 Agents 的统一创意工作台，在同一个空间中组织灵感、素材、工具与创作流程。",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Clash | Creative Workspace for Agents",
    description: "One workspace for ideas, media, tools, and agent-native creative workflows.",
    images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Clash creative product family" }],
  },
  twitter: { card: "summary_large_image", images: [SEO_IMAGE_URL] },
};

const imagePreviews = seoSkills
  .filter((skill) => skill.cover)
  .slice(0, 3)
  .map((skill) => ({ name: skill.displayName, image: skillImage(skill, skill.cover) }))
  .filter((item): item is { name: string; image: string } => Boolean(item.image));

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Clash",
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Clash",
        alternateName: "Clash Art",
        url: SITE_URL,
        description: "A unified creative workspace for agents.",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#workspace`,
        name: "Clash",
        url: SITE_URL,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        description: "A unified creative workspace for agents.",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Image Skill Studio",
        url: `${SITE_URL}/studio/image`,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web, Codex",
        description: "A community product for exploring reusable AI image methods.",
      },
    ],
  };

  return (
    <main className={styles.page}>
      <link rel="prefetch" href="/studio/image" as="document" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      <nav className={styles.nav} aria-label="Main navigation">
        <Link className={styles.brand} href="/" aria-label="Clash home">
          <span className={styles.mark} aria-hidden="true" />
          <span>Clash</span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#workspace">Workspace</a>
          <a href="#community">Community</a>
          <Link href="/studio/image/plugin">Plugin</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>One space. Many creative directions.</p>
        <h1>A creative<br />workspace for <em>agents.</em></h1>
        <div className={styles.heroFoot}>
          <p>Clash 把灵感、素材、工具和 Agent 放进同一个工作空间。创作不再被切成孤立步骤，而是一条可以看见、继续和协作的路径。</p>
          <a href="#workspace">进入工作台概览 ↓</a>
        </div>
        <div className={styles.orbit} aria-hidden="true">
          <i /><i /><i />
        </div>
      </section>

      <section className={styles.products} id="workspace" aria-labelledby="workspace-title">
        <header className={styles.sectionHeader}>
          <p>CLASH WORKSPACE / 01</p>
          <h2 id="workspace-title">不是一排工具，<br />而是一张持续生长的创作桌面。</h2>
        </header>

        <article className={`${styles.product} ${styles.workspaceProduct}`}>
          <div className={styles.productCopy}>
            <span>MAIN PRODUCT</span>
            <h3>Clash<br />Workspace</h3>
            <p>围绕一个真实项目组织画布、素材、对话、时间线与 Agent。每一步都保留上下文，每一种媒介都能进入同一条创作流。</p>
            <a href="#community">查看社区能力 <b aria-hidden="true">↓</b></a>
          </div>
          <div className={styles.videoStage} aria-hidden="true">
            <div className={styles.frame}><span>CANVAS</span><span>AGENTS</span><span>TIMELINE</span></div>
            <div className={styles.play}>C</div>
            <div className={styles.timeline}><i /><i /><i /><i /><i /></div>
          </div>
        </article>

        <article className={`${styles.product} ${styles.communityProduct}`} id="community">
          <a className={styles.imageStage} href="/studio/image#feed" aria-label="打开 Image Skill Studio">
            {imagePreviews.map((preview, index) => (
              <figure data-position={index} key={preview.name}>
                <img src={preview.image} alt={`${preview.name} 示例`} fetchPriority={index === 0 ? "high" : "auto"} />
                <figcaption>{preview.name}</figcaption>
              </figure>
            ))}
          </a>
          <div className={styles.productCopy}>
            <span>COMMUNITY PRODUCT</span>
            <h3>Image Skill<br />Studio</h3>
            <p>社区驱动的 AI 图像 Skill 工作台。用真实参考图、提示词和生成结果分享可复用的视觉方法。</p>
            <div className={styles.productActions}>
              <a href="/studio/image#feed">打开 Image Skill Studio <b aria-hidden="true">↗</b></a>
              <Link className={styles.secondaryProductLink} href="/studio/image/plugin">安装 Codex 插件</Link>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.manifesto}>
        <p>ONE WORKSPACE, LIVING CONTEXT</p>
        <h2>Agent 不只是执行按钮。<br />它应该和人共享素材、过程与判断，<br /><em>一起留在作品里面。</em></h2>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark} aria-hidden="true" />
          <span>Clash</span>
        </Link>
        <p>A creative workspace for agents.</p>
        <div>
          <a href="#workspace">Workspace</a>
          <a href="/studio/image#feed">Community</a>
          <Link href="/studio/image/plugin">Plugin</Link>
        </div>
      </footer>
    </main>
  );
}
