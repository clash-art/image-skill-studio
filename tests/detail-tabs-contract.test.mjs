import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studioUrl = new URL("../components/image-skill-studio.tsx", import.meta.url);
const cssUrl = new URL("../web/widget.css", import.meta.url);

test("Skill detail has two tabs and no third Works route or sheet", async () => {
  const [studio, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(studio, /type DetailTab = "feed" \| "creations"/);
  assert.match(studio, /role="tablist"[^>]*aria-label=\{copy\.skillContent\}/);
  assert.match(studio, /role="tab"[\s\S]{0,620}?>Feed</);
  assert.match(studio, /role="tab"[\s\S]{0,620}?>\{copy\.myGenerations\}</);
  assert.match(studio, /role="tabpanel"/);
  assert.doesNotMatch(studio, /studioRoute:\s*"works"|worksSkillIdFromHash|#works\/|studio-works-sheet/);
  assert.doesNotMatch(css, /\.studio-works-sheet|\.works-sheet__/);
});

test("detail tabs crossfade with opacity only while shared layout stays reserved for route motion", async () => {
  const studio = await readFile(studioUrl, "utf8");

  const panelStart = studio.indexOf("function DetailTabPanel(");
  const panelEnd = studio.indexOf("export function ImageSkillStudio", panelStart);
  assert.notEqual(panelStart, -1);
  assert.notEqual(panelEnd, -1);
  const panel = studio.slice(panelStart, panelEnd);

  assert.match(panel, /active: boolean/);
  assert.match(panel, /initial=\{false\}/);
  assert.match(panel, /opacity: active \? 1 : 0/);
  assert.match(panel, /duration: reduceMotion \? 0 : active \? 0\.18 : 0\.12/);
  assert.doesNotMatch(panel, /\b(?:x|y|scale|layout|layoutId)\s*[:=]/);
  assert.match(panel, /aria-hidden=\{!active\}/);
  assert.match(panel, /inert=\{!active \? true : undefined\}/);
  assert.match(panel, /tabIndex=\{active \? 0 : -1\}/);
  assert.doesNotMatch(panel, /useIsPresent|\bexit=/);

  assert.doesNotMatch(studio, /<AnimatePresence initial=\{false\} mode="sync">/);
  assert.match(studio, /<DetailTabPanel[\s\S]{0,220}?active=\{activeDetailTab === "feed"\}/);
  assert.match(studio, /<DetailTabPanel[\s\S]{0,220}?active=\{activeDetailTab === "creations"\}/);
  const selectStart = studio.indexOf("function selectDetailTab(");
  const selectEnd = studio.indexOf("function handleDetailTabKeyDown", selectStart);
  const selectDetailTab = studio.slice(selectStart, selectEnd);
  assert.doesNotMatch(selectDetailTab, /setRouteOrigin|captureRouteOrigin/);
  assert.match(studio, /const detailProjectionTransition = routeInteractionLocked\s*\? routeSpring\s*:\s*\{ duration: 0 \} as const/);
  assert.match(studio, /function detailIdentityEnabled\([\s\S]{0,260}?routePhase === "idle"/);
  assert.ok((studio.match(/transition=\{detailProjectionTransition\}/g) ?? []).length >= 4);
});

test("both Feed collections keep four independent shared images when entering their matching tab", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /type ProjectionSurface = "feed-runs" \| "feed-examples" \| "skill-runs" \| "skill-examples"/);
  assert.match(
    studio,
    /onSelect=\{\(item, visibleItems\) => openSkill\(entry\.id,\s*"run",\s*item,\s*visibleItems,\s*"creations"\)\}/,
  );
  assert.match(
    studio,
    /onSelect=\{\(item, visibleItems\) => openSkill\(entry\.id,\s*"example",\s*item,\s*visibleItems,\s*"feed"\)\}/,
  );
  assert.match(studio, /kind === "run" \? "feed-runs" : "feed-examples"/);
  assert.match(studio, /kind === "run" \? "skill-runs" : "skill-examples"/);
  assert.match(studio, /detailLayoutIdFor\("run",\s*run\.id\)/);
  assert.match(studio, /detailLayoutIdFor\("example",\s*example\.id\)/);
  assert.match(studio, /items:\s*visibleItems\.map/);
  assert.match(studio, /setActiveDetailTab\(targetTab\)[\s\S]{0,220}?setRoute\("skill"\)/);
});

test("detail stays a full-width feed while a non-modal Composer floats above it", async () => {
  const [studio, css] = await Promise.all([
    readFile(studioUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(studio, /className="skill-detail-shell"/);
  assert.match(studio, /className=\{`skill-detail-composer\$\{composerOpen \? " is-open" : " is-compact"\}`\}/);
  assert.doesNotMatch(studio, /codex-agent-backdrop/);
  assert.match(studio, /<MorphingComposer[\s\S]{0,420}?open=\{composerOpen\}/);
  assert.doesNotMatch(studio, /codex-agent-surface|aria-modal|inert=\{[^}]*composerOpen|keepFocusInComposer/);
  assert.doesNotMatch(studio, /agentDockReached|codex-agent-anchor|codex-agent-positioner/);

  assert.match(css, /\.skill-detail-shell\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.skill-detail-composer\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(css, /\.skill-detail-composer\.is-open\s*\{[^}]*place-items:\s*end\s+center/s);
  assert.match(css, /\.morphing-composer__surface\s*\{[^}]*transform-origin:\s*50%\s+100%/s);
  assert.match(css, /\.skill-detail-composer\.is-compact\s*\{[^}]*place-items:\s*end\s+center/s);
  assert.match(css, /\.skill-detail-composer\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.skill-detail-composer\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/s);
  assert.doesNotMatch(css, /codex-agent-backdrop|has-composer-open/);
  assert.match(css, /\.skill-image-feed\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/s);
  assert.doesNotMatch(css, /grid-template-areas:[^;}]*composer|position:\s*sticky[^}]*skill-detail-composer/s);
});

test("non-shared GUI clears before the four images move and stays locked until they settle", async () => {
  const studio = await readFile(studioUrl, "utf8");

  assert.match(studio, /const detailChromeHidden = routeGuiLeaving \|\| routeInteractionLocked/);
  assert.match(studio, /const routeChangeDelayMs = reduceRouteMotion \? 0 : 80/);
  assert.match(studio, /const routeForwardSettleMs = reduceRouteMotion \? 0 : 480/);
  assert.match(studio, /const routeReturnMorphMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /const routeReturnRevealMs = reduceRouteMotion \? 0 : 280/);
  assert.match(studio, /setRoutePhase\("exiting"\)[\s\S]{0,420}?commit\(\)[\s\S]{0,160}?setRoutePhase\("morphing"\)/);
  assert.match(studio, /data-route-transitioning=\{routeInteractionLocked \? "" : undefined\}/);
  assert.match(studio, /animate=\{guiOpacityMotion\(detailChromeHidden\)\}/);
  assert.match(studio, /disabled=\{routeInteractionLocked\}/);
});
