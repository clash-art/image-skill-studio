import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("reference-inspired UI components are integrated and data-driven", async () => {
  const [gallery, carousel, studio] = await Promise.all([
    readFile(new URL("../components/ui/expandable-gallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/feature-carousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(gallery, /motion\/react/);
  assert.match(gallery, /items:\s*GalleryItem\[\]/);
  assert.match(carousel, /motion\/react/);
  assert.match(carousel, /features:\s*FeatureItem\[\]/);
  assert.match(studio, /<FanCollection/);
  assert.match(studio, /<motion\.(?:div|section|article)/);
  assert.match(studio, /skill-results__feed/);
});

test("the MCP App has a feed route and a focused Skill route without an event timeline", async () => {
  const [studio, css] = await Promise.all([
    readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../web/widget.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /["']feed["']/);
  assert.match(studio, /["']skill["']/);
  assert.match(studio, /studio-feed/);
  assert.match(studio, /studio-skill-detail/);
  assert.match(studio, />Skills</);
  assert.doesNotMatch(studio, /image-studio__topbar|Skill Feed/);
  assert.doesNotMatch(css, /\.skill-detail__workspace\s*\{[^}]*grid-template-columns:/s);
  assert.match(studio, /run\.snapshot\.skill\.id\s*===\s*skill\?\.id/);
  assert.match(studio, /skill-examples/);
  assert.match(studio, />生成同款</);
  assert.match(studio, />Remix</);
  assert.match(studio, /example\.prompt/);
  assert.match(studio, />我的生成</);
  assert.match(css, /\.skill-example-card/);
  assert.doesNotMatch(studio, /run-inspector|events\.map\(/);
  assert.doesNotMatch(css, /\.run-inspector/);
});

test("the product keeps a lightweight brand signature without restoring a global header", async () => {
  const [studio, css] = await Promise.all([
    readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../web/widget.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /brand-signature/);
  assert.match(studio, /aria-label="Image Skill Studio"/);
  assert.match(studio, />Image Skill<\/span>/);
  assert.match(css, /\.brand-signature\s*\{/);
  assert.doesNotMatch(studio, /image-studio__topbar/);
  assert.doesNotMatch(css, /\.brand-signature\s*\{[^}]*(?:position:\s*(?:fixed|sticky)|border:)/s);
});

test("recent work is grouped into per-Skill collections that fan on hover, focus, or click", async () => {
  const [studio, fanCollection, css] = await Promise.all([
    readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/fan-collection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../web/widget.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /recentCollectionsBySkill/);
  assert.match(studio, /groupRecentRunsBySkill\(snapshot\.skills, feedRuns, feedRuns\.length\)/);
  assert.ok((studio.match(/<FanCollection/g) ?? []).length >= 2);
  assert.match(fanCollection, /const \[interaction, setInteraction\] = useState<FanInteraction>\(idleFanInteraction\)/);
  assert.match(fanCollection, /aria-expanded=/);
  assert.match(fanCollection, /fan-collection__trigger/);
  assert.match(css, /\.fan-collection:not\(\.is-transition-locked\):hover\s+\.fan-collection__card/);
  assert.match(css, /\.fan-collection:focus-within\s+\.fan-collection__card/);
  assert.match(css, /\.fan-collection\.is-open\s+\.fan-collection__card/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(studio, /recentRunsBySkill/);
});

test("hovering an individual fan card lifts that exact card to the front", async () => {
  const fanCollection = await readFile(
    new URL("../components/ui/fan-collection.tsx", import.meta.url),
    "utf8",
  );

  assert.match(fanCollection, /whileHover=\{interactionLocked \? undefined : \{/);
  assert.match(fanCollection, /const hoverScale = shouldReduceMotion \? 1 : 1\.05/);
  assert.match(fanCollection, /whileHover=\{interactionLocked \? undefined : \{[\s\S]{0,260}?scale:\s*hoverScale/);
  assert.match(fanCollection, /whileHover=\{interactionLocked \? undefined : \{[\s\S]{0,260}?y:\s*hoverLiftY/);
  assert.match(fanCollection, /whileHover=\{interactionLocked \? undefined : \{[\s\S]{0,260}?zIndex:\s*50/);
  assert.match(fanCollection, /const hoverLiftY = shouldReduceMotion \? baseY : baseY - 12/);
});

test("route transitions suspend card hover until shared layout has settled", async () => {
  const [studio, fanCollection, css] = await Promise.all([
    readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/fan-collection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../web/widget.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /const \[routePhase, setRoutePhase\] = useState<RouteTransitionPhase>\("idle"\)/);
  assert.match(studio, /const routeInteractionLocked = isRouteTransitioning\(routePhase\)/);
  assert.match(studio, /const routeForwardSettleMs = reduceRouteMotion \? 0 : 480/);
  assert.match(studio, /const routeReturnMorphMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /const routeReturnRevealMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /data-route-transitioning=\{routeInteractionLocked \? "" : undefined\}/);
  assert.ok(
    (studio.match(/phase=\{collectionPhase\(/g) ?? []).length >= 2,
    "both generated-work and Skill collections must stop accepting hover during the transition",
  );
  assert.ok(
    (studio.match(/disabled=\{routeInteractionLocked\}/g) ?? []).length >= 2,
    "detail image buttons must stay inert until the projection settles",
  );

  assert.match(fanCollection, /phase\?: FanCollectionPhase/);
  assert.match(fanCollection, /phase === "idle" && \(interaction\.pinned \|\| interaction\.hovered \|\| interaction\.focused\)/);
  assert.match(fanCollection, /whileHover=\{interactionLocked \? undefined : \{/);
  assert.match(fanCollection, /disabled=\{interactionLocked \|\| cardsHidden\}/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.fan-collection:not\(\.is-transition-locked\):hover/s);
});

test("the GUI adapts across phone, tablet, desktop, and touch input", async () => {
  const css = await readFile(new URL("../web/widget.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width:\s*380px\)[\s\S]*?\.recent-work__rail\s*\{[^}]*grid-auto-columns:\s*minmax\(154px,\s*58%\)/s);
  assert.match(css, /@media \(max-width:\s*639px\)[\s\S]*?\.codex-agent-surface textarea\s*\{[^}]*font-size:\s*16px/s);
  assert.match(css, /\.skill-detail-composer\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(css, /\.codex-agent-surface\.is-open\s*\{[^}]*width:\s*min\(560px,\s*calc\(100vw - 32px\)\)/s);
  assert.match(css, /\.skill-detail-shell\s*\{[^}]*grid-template-areas:\s*"nav"\s*"content"/s);
  assert.match(css, /\.skill-detail-tabs button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.skill-image-feed\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/s);
  assert.match(css, /\.skill-results__feed\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill/s);
  assert.match(css, /@media \(min-width:\s*640px\)[\s\S]*?\.skill-feed__cards\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(css, /@media \(min-width:\s*1000px\)[\s\S]*?\.skill-feed__cards\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
});

test("the finished preview replaces all starter metadata and disposable skeletons", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ImageSkillStudio/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.match(layout, /Image Skill Studio/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /previewState\.skills\.flatMap/);
  assert.doesNotMatch(page, /example\.preview\s*\?\?\s*skill\.preview/);
});

test("preview handoff never passes a Skill cover off as a generated artifact", async () => {
  const studio = await readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8");

  const bridgeStart = studio.indexOf("function createPreviewBridge");
  const componentStart = studio.indexOf("export function ImageSkillStudio", bridgeStart);
  const bridge = studio.slice(bridgeStart, componentStart);
  assert.match(bridge, /status:\s*["']agent_running["']/);
  assert.match(bridge, /artifacts:\s*\[\]/);
  assert.doesNotMatch(bridge, /downloadUrl:\s*selected\.preview/);
});
