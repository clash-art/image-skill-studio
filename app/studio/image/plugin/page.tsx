import type { Metadata } from "next";
import Link from "next/link";

import { jsonLd, SEO_IMAGE_URL, STUDIO_URL } from "@/lib/studio-seo";

import studioStyles from "../seo.module.css";
import styles from "./plugin.module.css";

const PLUGIN_URL = `${STUDIO_URL}/plugin`;
const REPOSITORY_URL = "https://github.com/hrhrng/awesome-image-skill";
const MARKETPLACE_COMMAND = "codex plugin marketplace add hrhrng/awesome-image-skill";
const INSTALL_COMMAND = "codex plugin add image-skill-studio@image-skill-studio";
const OPEN_PROMPT = "Open Image Skill Studio";

export const metadata: Metadata = {
  title: "安装 Image Skill Studio Codex 插件",
  description: "通过两条 Codex 插件命令安装 Image Skill Studio，浏览社区图像 Skills，将提示词与参考图交给当前 Agent，并在本地收集生成结果。",
  alternates: { canonical: PLUGIN_URL },
  openGraph: {
    type: "website",
    url: PLUGIN_URL,
    title: "安装 Image Skill Studio Codex 插件",
    description: "免费安装社区驱动的 AI 图像 Skill 工作台。无需克隆仓库或安装 Node.js。",
    images: [{ url: SEO_IMAGE_URL, width: 1200, height: 630, alt: "Image Skill Studio Codex 插件" }],
  },
  twitter: { card: "summary_large_image", images: [SEO_IMAGE_URL] },
};

export default function PluginPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Image Skill Studio",
        url: PLUGIN_URL,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Codex",
        softwareVersion: "0.1.0",
        description: "A Codex plugin for discovering image-generation Skills, handing work to the current agent, and collecting results by Skill.",
        codeRepository: REPOSITORY_URL,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "HowTo",
        name: "如何安装 Image Skill Studio Codex 插件",
        totalTime: "PT2M",
        step: [
          { "@type": "HowToStep", position: 1, name: "添加插件市场", text: MARKETPLACE_COMMAND },
          { "@type": "HowToStep", position: 2, name: "安装插件", text: INSTALL_COMMAND },
          { "@type": "HowToStep", position: 3, name: "打开工作台", text: `新建 Codex 任务并输入：${OPEN_PROMPT}` },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Image Skill Studio", item: STUDIO_URL },
          { "@type": "ListItem", position: 2, name: "安装插件", item: PLUGIN_URL },
        ],
      },
    ],
  };

  return (
    <main className={studioStyles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <div className={studioStyles.shell}>
        <nav className={studioStyles.crumbs} aria-label="面包屑">
          <Link href="/studio/image">Image Skill Studio</Link><span>/</span><span>Plugin</span>
        </nav>

        <section className={`${studioStyles.hero} ${styles.hero}`}>
          <div>
            <p className={studioStyles.eyebrow}>Free Codex plugin</p>
            <h1 className={studioStyles.title}>把图像 Skills 装进 Codex。</h1>
            <p className={studioStyles.lede}>
              Image Skill Studio 是社区驱动的 Codex 插件。发现可复用的图像创作方法，把提示词和参考图交给当前 Agent，并按 Skill 收集真实生成结果。
            </p>
            <div className={studioStyles.actions}>
              <a className={studioStyles.primary} href="#install">查看安装命令</a>
              <Link className={studioStyles.secondary} href="/studio/image/skills">浏览全部 Skills</Link>
            </div>
            <ul className={studioStyles.facts} aria-label="插件信息">
              <li>免费</li>
              <li>Codex Plugin</li>
              <li>无需 Node.js</li>
              <li>MIT 工作台</li>
            </ul>
          </div>

          <aside className={styles.installCard} id="install" aria-labelledby="install-title">
            <p className={styles.cardLabel}>INSTALL / ABOUT 2 MINUTES</p>
            <h2 id="install-title">两条命令，然后打开。</h2>
            <ol className={styles.commandList}>
              <li>
                <span>01</span>
                <div>
                  <h3>添加插件市场</h3>
                  <pre><code>{MARKETPLACE_COMMAND}</code></pre>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>安装 Image Skill Studio</h3>
                  <pre><code>{INSTALL_COMMAND}</code></pre>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>新建 Codex 任务并输入</h3>
                  <pre><code>{OPEN_PROMPT}</code></pre>
                </div>
              </li>
            </ol>
            <p className={styles.installNote}>安装完成后请新建一个 Codex 任务，让宿主加载插件运行时。</p>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="capabilities-title">
          <header className={styles.sectionHeader}>
            <p>WHAT IT DOES</p>
            <h2 id="capabilities-title">不是另一套生成器，<br />而是 Agent 的图像方法库。</h2>
          </header>
          <div className={styles.featureGrid}>
            <article>
              <span>01</span>
              <h3>发现方法</h3>
              <p>在一个图像 Feed 中浏览海报、插画、拼贴、摄影重构、旅行卡片和复古界面等社区 Skills。</p>
            </article>
            <article>
              <span>02</span>
              <h3>交给当前 Agent</h3>
              <p>选择 Skill、提示词与可选参考图，插件生成明确任务，由当前 Codex Agent 使用可用图像工具完成。</p>
            </article>
            <article>
              <span>03</span>
              <h3>收集真实结果</h3>
              <p>生成结果回到对应 Skill 下，便于复用方法、比较输入输出，并导出适合分享的对照卡片。</p>
            </article>
          </div>
        </section>

        <section className={styles.splitSection} aria-labelledby="boundary-title">
          <div>
            <p className={styles.kicker}>CLOUD CATALOG / LOCAL WORK</p>
            <h2 id="boundary-title">目录可以更新，<br />你的工作留在本地。</h2>
          </div>
          <div className={styles.boundaryCopy}>
            <p>插件从云端获取轻量的 Skill 目录和展示资源，因此社区新增方法不要求每次重新安装插件。</p>
            <p>运行记录、缓存与生成文件保存在本机。只有当你明确让当前 Agent 或图像工具处理素材时，相应输入才会按该工具的规则发送。</p>
            <p>远程 Skill 固定到作者仓库的具体提交版本，首次使用时按需下载，来源、许可和版本保持可追踪。</p>
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <p className={styles.kicker}>QUESTIONS</p>
          <h2 id="faq-title">安装前需要知道的事</h2>
          <details>
            <summary>需要克隆 GitHub 仓库或安装 Node.js 吗？</summary>
            <p>不需要。Codex 插件市场负责下载已发布的插件包；按照页面上的两条命令安装即可。</p>
          </details>
          <details>
            <summary>插件会自己生成图片吗？</summary>
            <p>不会。插件负责发现 Skill、组织输入并把任务交给当前 Agent；真正的生成由 Agent 当前可用的图像工具完成。</p>
          </details>
          <details>
            <summary>为什么安装后要新建任务？</summary>
            <p>新任务会让 Codex 重新加载已安装插件的 MCP 服务、Skills 和交互界面。</p>
          </details>
          <details>
            <summary>在哪里查看源代码和许可证？</summary>
            <p>工作台代码发布在 <a href={REPOSITORY_URL}>GitHub</a>。目录中的每个第三方 Skill 仍遵循其作者自己的许可证。</p>
          </details>
        </section>

        <section className={styles.finalCta}>
          <div>
            <p className={styles.kicker}>READY WHEN CODEX IS</p>
            <h2>安装插件，打开你的图像 Skill 工作台。</h2>
          </div>
          <a href="#install">回到安装命令 ↑</a>
        </section>
      </div>
    </main>
  );
}
