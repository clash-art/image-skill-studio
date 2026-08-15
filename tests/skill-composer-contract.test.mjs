import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioUrl = new URL("../components/image-skill-studio.tsx", import.meta.url);
const fanUrl = new URL("../components/ui/fan-collection.tsx", import.meta.url);
const morphingComposerUrl = new URL("../components/ui/morphing-composer.tsx", import.meta.url);
const cssUrl = new URL("../web/widget.css", import.meta.url);

test("the Skill route is a full-width two-tab feed beneath one floating Composer", async () => {
  const [studio, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(studio, /type DetailTab = "feed" \| "creations"/);
  assert.match(studio, /role="tablist"[^>]*aria-label="Skill 内容"/);
  assert.match(studio, /function DetailTabPanel\([\s\S]{0,720}?role="tabpanel"/);
  assert.match(studio, /<DetailTabPanel[\s\S]{0,220}?id="detail-panel-feed"/);
  assert.match(studio, /<DetailTabPanel[\s\S]{0,220}?id="detail-panel-creations"/);
  assert.match(studio, /className=\{`skill-detail-composer\$\{composerOpen \? " is-open" : " is-compact"\}`\}/);
  assert.doesNotMatch(studio, /codex-agent-backdrop/);
  assert.match(studio, /<MorphingComposer[\s\S]{0,420}?open=\{composerOpen\}/);
  assert.doesNotMatch(studio, /codex-agent-surface/);
  assert.doesNotMatch(studio, /agentDockReached|codex-agent-anchor|codex-agent-positioner|autoOpenedDockRef/);
  assert.match(css, /\.compose-toolbar\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/s);
  assert.match(css, /\.reference-add,\s*\n\.reference-thumb\s*\{[^}]*height:\s*44px/s);
  assert.match(css, /\.handoff-button\s*\{[^}]*height:\s*44px/s);
  assert.doesNotMatch(css, /reference-thumb select|compose-card__actions/);
  assert.doesNotMatch(css, /grid-template-areas:[^;}]*composer/);
});

test("Remix and generate-same seed the shared Composer without dispatching generation", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /openComposer\("remix", example\)/);
  assert.match(studio, /openComposer\("same", example\)/);
  assert.doesNotMatch(studio, /generateFromExample/);
  assert.doesNotMatch(studio, /await\s+generate\s*\(\s*\{/);
  assert.equal((studio.match(/\bgenerate\(\)/g) ?? []).length, 1);
  assert.match(studio, /className="handoff-button"[^>]*onClick=\{\(\) => generate\(\)\}/);
  assert.doesNotMatch(studio, /aria-label="画幅"/);
  assert.doesNotMatch(studio, /aria-label="参考图角色"|<option value="subject">主体</);
  assert.match(studio, /className="compose-toolbar"/);
  assert.match(studio, /aria-label="注册 Skill"/);
  assert.match(studio, /id="skill-register-form"/);
  assert.match(studio, /安装到 Codex/);
  assert.match(studio, /runtime\.registerSkill/);
  assert.match(studio, /runtime\.installSkill/);
});

test("both collection kinds move their first four cards and images into matching Skill panels", async () => {
  const [studio, fanCollection, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(fanUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(fanCollection, /visibleItems\s*=\s*items\.slice\(0,\s*4\)/);
  assert.match(fanCollection, /layoutId=\{item\.layoutId\}/);
  assert.match(fanCollection, /layout="position"[\s\S]{0,100}?layoutId=\{item\.imageLayoutId\}/);
  assert.match(studio, /kind === "run" \? "feed-runs" : "feed-examples"/);
  assert.match(studio, /kind === "run" \? "skill-runs" : "skill-examples"/);
  assert.match(studio, /layoutId:\s*skillRouteLayoutId\("run",\s*entry\.id,\s*run\.id\)/);
  assert.match(studio, /imageLayoutId:\s*skillRouteImageLayoutId\("run",\s*entry\.id,\s*run\.id\)/);
  assert.match(studio, /layoutId:\s*skillRouteLayoutId\("example",\s*entry\.id,\s*example\.id\)/);
  assert.match(studio, /imageLayoutId:\s*skillRouteImageLayoutId\("example",\s*entry\.id,\s*example\.id\)/);
  assert.doesNotMatch(studio, /const projectionItem = routeItemForSkill\("feed-(?:runs|examples)"/);
  assert.match(studio, /function routeSurfaceHasIdentity\(surface: ProjectionSurface\)/);
  assert.match(studio, /function routeItemForSkill\([\s\S]{0,360}?if \(!routeSurfaceHasIdentity\(surface\)/);
  assert.match(studio, /layoutId=\{detailLayoutIdFor\("example",\s*example\.id\)\}/);
  assert.match(studio, /layoutId=\{detailLayoutIdFor\("run",\s*run\.id\)\}/);
  assert.match(studio, /routeItemFor\("skill-runs",\s*"run",\s*run\.id\)/);
  assert.match(studio, /<LayoutGroup\s+id="studio-route">/);
  assert.doesNotMatch(studio, /<AnimatePresence\s+mode="sync"/);
  assert.ok((studio.match(/layoutScroll/g) ?? []).length >= 3);
  assert.doesNotMatch(css, /\.fan-collection__card\s*\{[^}]*\btransform:/s);
});

test("non-shared GUI leaves before route commit and target chrome waits for projection settle", async () => {
  const [studio, fanCollection] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(fanUrl, "utf8"),
  ]);

  assert.match(studio, /const routeGuiExitDuration = reduceRouteMotion \? 0 : 0\.055/);
  assert.match(studio, /const routeChangeDelayMs = reduceRouteMotion \? 0 : 80/);
  assert.match(studio, /const routeForwardSettleMs = reduceRouteMotion \? 0 : 480/);
  assert.match(studio, /const routeReturnMorphMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /const routeReturnRevealMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /const detailChromeHidden = routeGuiLeaving \|\| routeInteractionLocked/);
  assert.match(studio, /const feedRouteGuiHidden = routeGuiLeaving \|\| routeInteractionLocked \|\| route !== "feed"/);
  assert.match(studio, /function guiOpacityMotion\(hidden: boolean\)/);
  assert.match(studio, /setRoutePhase\("exiting"\)[\s\S]{0,420}?commit\(\)[\s\S]{0,160}?setRoutePhase\("morphing"\)/);
  assert.match(studio, /setRoutePhase\("revealing"\)/);
  assert.match(studio, /animate=\{guiOpacityMotion\(detailChromeHidden\)\}/);
  assert.match(studio, /animate=\{guiOpacityMotion\(feedRouteGuiHidden\)\}/);
  assert.match(fanCollection, /const cardsHidden = phase === "hidden"/);
  assert.match(fanCollection, /opacity:\s*cardsHidden \? 0 : 1/);
  assert.match(fanCollection, /disabled=\{interactionLocked \|\| cardsHidden\}/);
  assert.doesNotMatch(
    studio,
    /className="studio-(?:feed-route|skill-detail)"[\s\S]{0,180}?(?:initial|animate|exit)=\{\{[^}]*opacity:\s*0/,
  );
});

test("horizontal detail rails participate in scroll-aware shared layout", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /<motion\.div\s+ref=\{restoreFeedRail\}\s+className="skill-examples__rail skill-image-feed"\s+layoutScroll>/);
  assert.match(studio, /<motion\.div\s+ref=\{restoreCreationsRail\}\s+className="skill-results__feed"\s+role="list"\s+layoutScroll>/);
});

test("return projection follows the active tab and current viewport cards", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /const returningToFeed = routeRef\.current === "skill" && targetRoute === "feed"/);
  assert.match(studio, /const transitionOrigin = returningToFeed[\s\S]{0,220}?activeOrigin[\s\S]{0,220}?: null/);
  assert.match(studio, /const capturedReturnOrigin = returningToFeed \? detailCaptureRef\.current\(\) : null/);
  assert.match(studio, /rankViewportCards\(/);
  assert.match(studio, /setFeedCardOrderByCollection/);
  assert.match(studio, /const activeRouteOrigin = useMemo\([\s\S]{0,700}?liveProjectedRuns\.map/);
  assert.match(studio, /routeOriginRef\.current = activeRouteOrigin/);
  assert.match(studio, /openSkillWithoutProjection\(entry\.id, "feed"\)/);
  assert.doesNotMatch(studio, /recent-card--empty[\s\S]{0,500}?skillRouteLayoutId/);
});

test("the Feed stays mounted behind the Skill route for reverse shared transitions", async () => {
  const [studio, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  const feedIndex = studio.indexOf('key="feed"');
  const detailIndex = studio.indexOf('{route === "skill" ? (', feedIndex);
  assert.ok(feedIndex >= 0 && detailIndex > feedIndex);
  assert.doesNotMatch(studio, /\{route === "feed" \? \(/);
  assert.match(studio, /aria-hidden=\{route !== "feed"\}/);
  assert.match(studio, /inert=\{route !== "feed" \? true : undefined\}/);
  assert.match(studio, /returnOrigin[\s\S]{0,220}?activeOrigin\.fromSurface\.startsWith\("skill-"\)/);
  assert.match(css, /\.studio-feed-route\.is-background\s*\{[^}]*pointer-events:\s*none[^}]*z-index:\s*0/s);
  assert.match(css, /\.studio-skill-detail\s*\{[^}]*z-index:\s*2[^}]*background:\s*var\(--cream\)/s);
});

test("there are only Feed and Skill routes; generated work lives in the creations tab", async () => {
  const [studio, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(studio, /type StudioRoute = "feed" \| "skill"/);
  assert.match(studio, /className="skill-results__feed"/);
  assert.match(studio, /selectedSkillRuns = useMemo\([\s\S]{0,140}?feedRuns\.filter/);
  assert.doesNotMatch(studio, /worksSkillIdFromHash|openWorks|closeWorks|worksBaseRoute|works-runs|#works\/|studio-works-sheet/);
  assert.doesNotMatch(css, /\.studio-works-sheet|\.works-sheet__/);
});

test("hash deep links hydrate the Skill Feed tab without inventing a shared origin", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /function skillIdFromHash\(/);
  assert.match(studio, /const deepLinkedSkillId = skillIdFromHash/);
  assert.match(studio, /setRouteOrigin\(null\)/);
  assert.match(studio, /setActiveDetailTab\("feed"\)/);
  assert.match(studio, /setRoute\("skill"\)/);
  assert.doesNotMatch(studio, /#works\/|worksSkillIdFromHash/);
});

test("the Codex pill uses one mature bidirectional morph for open and close", async () => {
  const [studio, morphingComposer, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(morphingComposerUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(studio, /import \{ MorphingComposer \} from "@\/components\/ui\/morphing-composer"/);
  assert.match(studio, /<MorphingComposer[\s\S]{0,420}?open=\{composerOpen\}/);
  assert.match(studio, /const \[composerOpen, setComposerOpen\] = useState\(false\)/);
  assert.doesNotMatch(studio, /ComposerPhase|composerPhase|composerBodyVisible|composerOrigin|"closing"|composerCollapseSpring|finishComposerClose/);
  assert.match(studio, /const closeComposer = useCallback\([\s\S]{0,360}?setComposerOpen\(false\)/);

  assert.match(morphingComposer, /const MORPHING_COMPOSER_TRANSITION = \{[\s\S]{0,160}?type: "spring"[\s\S]{0,160}?duration: 0\.4/);
  assert.match(morphingComposer, /<MotionConfig transition=\{transition\}>/);
  assert.match(morphingComposer, /<motion\.section[\s\S]{0,360}?className=\{cn\("morphing-composer__surface"[\s\S]{0,220}?layout/);
  assert.match(morphingComposer, /animate=\{\{[\s\S]{0,220}?backgroundColor: open \? MORPHING_COMPOSER_OPEN_BACKGROUND : MORPHING_COMPOSER_CLOSED_BACKGROUND/);
  assert.match(morphingComposer, /const collapsedInteractive = !open && settledOpen === false/);
  assert.match(morphingComposer, /onAnimationStart=\{handleSurfaceAnimationStart\}/);
  assert.match(morphingComposer, /onAnimationComplete=\{handleSurfaceAnimationComplete\}/);
  assert.match(morphingComposer, /aria-hidden=\{!open\}[\s\S]{0,80}?inert=\{!open \? true : undefined\}/);
  assert.match(morphingComposer, /<AnimatePresence initial=\{false\} mode="popLayout">/);
  assert.match(morphingComposer, /initial=\{\{ opacity: 0 \}\}[\s\S]{0,120}?animate=\{\{ opacity: 1 \}\}[\s\S]{0,120}?exit=\{\{ opacity: 0 \}\}/);
  assert.doesNotMatch(morphingComposer, /height: open|layoutId=|<LayoutGroup/);
  assert.match(morphingComposer, /onExitComplete\?\.\(\)/);
  assert.match(morphingComposer, /useReducedMotion\(\)/);
  assert.match(morphingComposer, /role="region"/);
  assert.doesNotMatch(morphingComposer, /aria-modal|backdrop|composerCollapseSpring|setTimeout/);

  assert.match(css, /\.morphing-composer__surface\.is-open\s*\{[^}]*width:\s*min\(620px,\s*calc\(100vw - 32px\)\)/s);
  assert.match(css, /\.morphing-composer__surface\.is-compact\s*\{[^}]*width:\s*172px/s);
  assert.match(css, /\.morphing-composer__launch\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.morphing-composer__open-hit:disabled\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.skill-detail-composer\s*\{[^}]*pointer-events:\s*none/s);
  assert.doesNotMatch(css, /codex-agent-backdrop|has-composer-open|\.codex-agent-surface/);
});
