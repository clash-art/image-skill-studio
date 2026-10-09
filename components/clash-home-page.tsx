import Link from "next/link";

import { jsonLd, seoSkills, SITE_URL, skillImage } from "@/lib/studio-seo";
import { absoluteSiteUrl, localizedPath, type SiteLocale } from "@/lib/site-i18n";

import styles from "@/app/home.module.css";

const imagePreviews = seoSkills
  .filter((skill) => skill.cover)
  .slice(0, 3)
  .map((skill) => ({ name: skill.displayName, image: skillImage(skill, skill.cover) }))
  .filter((item): item is { name: string; image: string } => Boolean(item.image));

export function ClashHomePage({ locale }: { locale: SiteLocale }) {
  const homeHref = localizedPath(locale, "/");
  const studioHref = `${localizedPath(locale, "/studio/image")}#feed`;
  const pluginHref = localizedPath(locale, "/studio/image/plugin");
  const englishHref = localizedPath("en", "/");
  const studioPrefetch = localizedPath(locale, "/studio/image");

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
        url: absoluteSiteUrl("en", "/studio/image"),
        applicationCategory: "DesignApplication",
        operatingSystem: "Web, Codex",
        description: "A community product for exploring reusable AI image methods.",
      },
    ],
  };

  const navCommunity = locale === "zh" ? "社区" : "Community";
  const navWorkspace = locale === "zh" ? "工作台" : "Workspace";
  const heroCta = locale === "zh" ? "进入工作台概览 ↓" : "Explore the workspace ↓";
  const workspaceTitle =
    locale === "zh"
      ? "不是一排工具，而是一张持续生长的创作桌面。"
      : "Not a row of tools — a creative desktop that keeps growing.";
  const communityCta = locale === "zh" ? "查看社区能力" : "See community products";
  const openStudio = locale === "zh" ? "打开 Image Skill Studio" : "Open Image Skill Studio";
  const installPlugin = locale === "zh" ? "安装 Codex 插件" : "Install Codex plugin";
  const manifesto =
    locale === "zh"
      ? "Agent 不只是执行按钮。它应该和人共享素材、过程与判断，一起留在作品里面。"
      : "Agents are not just buttons. They should share materials, process, and judgment — and stay inside the work.";

  return (
    <main className={styles.page}>
      <link rel="prefetch" href={studioPrefetch} as="document" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      <nav className={styles.nav} aria-label="Main navigation">
        <Link className={styles.brand} href={homeHref} aria-label="Clash home">
          <span className={styles.mark} aria-hidden="true" />
          <span>Clash</span>
        </Link>
        <div className={styles.navLinks}>
          {locale === "zh" ? (
            <Link href={englishHref} hrefLang="en">English</Link>
          ) : (
            <Link href={localizedPath("zh", "/")} hrefLang="zh-Hans">中文</Link>
          )}
          <a href="#workspace">{navWorkspace}</a>
          <a href="#community">{navCommunity}</a>
          <Link href={pluginHref}>Plugin</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>One space. Many creative directions.</p>
        <h1>A creative<br />workspace for <em>agents.</em></h1>
        <div className={styles.heroFoot}>
          <p>Clash 把灵感、素材、工具和 Agent 放进同一个工作空间。创作不再被切成孤立步骤，而是一条可以看见、继续和协作的路径。</p>
          <a href="#workspace">{heroCta}</a>
        </div>
        <div className={styles.orbit} aria-hidden="true">
          <i /><i /><i />
        </div>
      </section>

      <section className={styles.products} id="workspace" aria-labelledby="workspace-title">
        <header className={styles.sectionHeader}>
          <p>CLASH WORKSPACE / 01</p>
          <h2 id="workspace-title">{workspaceTitle}</h2>
        </header>

        <article className={`${styles.product} ${styles.workspaceProduct}`}>
          <div className={styles.productCopy}>
            <span>MAIN PRODUCT</span>
            <h3>Clash<br />Workspace</h3>
            <p>围绕一个真实项目组织画布、素材、对话、时间线与 Agent。每一步都保留上下文，每一种媒介都能进入同一条创作流。</p>
            <a href="#community">{communityCta} <b aria-hidden="true">↓</b></a>
          </div>
          <div className={styles.videoStage} aria-hidden="true">
            <div className={styles.frame}><span>CANVAS</span><span>AGENTS</span><span>TIMELINE</span></div>
            <div className={styles.play}>C</div>
            <div className={styles.timeline}><i /><i /><i /><i /><i /></div>
          </div>
        </article>

        <article className={`${styles.product} ${styles.communityProduct}`} id="community">
          <a className={styles.imageStage} href={studioHref} aria-label="打开 Image Skill Studio">
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
              <a href={studioHref}>{openStudio} <b aria-hidden="true">↗</b></a>
              <Link className={styles.secondaryProductLink} href={pluginHref}>{installPlugin}</Link>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.manifesto}>
        <p>ONE WORKSPACE, LIVING CONTEXT</p>
        <h2>{manifesto}</h2>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href={homeHref}>
          <span className={styles.mark} aria-hidden="true" />
          <span>Clash</span>
        </Link>
        <p>A creative workspace for agents.</p>
        <div>
          <a href="#workspace">{navWorkspace}</a>
          <a href={studioHref}>Community</a>
          <Link href={pluginHref}>Plugin</Link>
        </div>
      </footer>
    </main>
  );
}
