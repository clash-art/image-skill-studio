import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  fanCollectionRevealDelay,
  fanCollectionPhase,
  isRouteTransitioning,
  rankViewportCards,
} from "../lib/studio-interaction-state.mjs";

test("one route phase drives GUI visibility, interaction locking, and fan presentation", () => {
  assert.equal(isRouteTransitioning("idle"), false);
  assert.equal(isRouteTransitioning("exiting"), true);
  assert.equal(isRouteTransitioning("morphing"), true);
  assert.equal(isRouteTransitioning("revealing"), true);

  assert.equal(fanCollectionPhase({
    route: "feed",
    phase: "idle",
    origin: null,
    kind: "example",
    skillId: "poster",
  }), "idle");
  assert.equal(fanCollectionPhase({
    route: "skill",
    phase: "idle",
    origin: null,
    kind: "example",
    skillId: "poster",
  }), "hidden");
  assert.equal(fanCollectionPhase({
    route: "feed",
    phase: "exiting",
    origin: { kind: "example", skillId: "poster" },
    kind: "example",
    skillId: "poster",
  }), "origin");
  assert.equal(fanCollectionPhase({
    route: "feed",
    phase: "morphing",
    origin: { kind: "example", skillId: "poster" },
    kind: "run",
    skillId: "poster",
  }), "hidden");
  assert.equal(fanCollectionPhase({
    route: "feed",
    phase: "revealing",
    origin: { kind: "example", skillId: "poster" },
    kind: "example",
    skillId: "poster",
  }), "origin-revealing");
  assert.equal(fanCollectionPhase({
    route: "feed",
    phase: "revealing",
    origin: { kind: "example", skillId: "poster" },
    kind: "run",
    skillId: "other",
  }), "revealing");
});

test("returning Feed collections reveal with a short capped stagger", () => {
  assert.equal(fanCollectionRevealDelay(0, false), 0);
  assert.equal(fanCollectionRevealDelay(1, false), 0.018);
  assert.equal(fanCollectionRevealDelay(6, false), 0.108);
  assert.equal(fanCollectionRevealDelay(40, false), 0.108);
  assert.equal(fanCollectionRevealDelay(-2, false), 0);
  assert.equal(fanCollectionRevealDelay(4, true), 0);
});

test("FanCollection clears transient hover, focus, and pinned state whenever a route transition owns it", async () => {
  const fanCollection = await readFile(new URL("../components/ui/fan-collection.tsx", import.meta.url), "utf8");

  assert.match(fanCollection, /phase\?: FanCollectionPhase/);
  assert.match(fanCollection, /revealOrder\?: number/);
  assert.match(fanCollection, /fanCollectionRevealDelay\(revealOrder, Boolean\(shouldReduceMotion\)\)/);
  assert.match(fanCollection, /phase === "revealing"/);
  assert.match(fanCollection, /y: cardsHidden \? 6 : 0/);
  assert.match(fanCollection, /initial=\{false\}/);
  assert.match(fanCollection, /const \[interaction, setInteraction\] = useState<FanInteraction>\(idleFanInteraction\)/);
  assert.match(fanCollection, /const resetFanState = useCallback\(\(\) => \{[\s\S]{0,160}?setInteraction\(idleFanInteraction\)/);
  assert.match(fanCollection, /useEffect\(\(\) => \{[\s\S]{0,120}?if \(phase === "idle"\) return;[\s\S]{0,180}?requestAnimationFrame\(resetFanState\)/);
  assert.match(fanCollection, /phase === "idle" && \(interaction\.pinned \|\| interaction\.hovered \|\| interaction\.focused\)/);
  assert.doesNotMatch(fanCollection, /guiHidden\?:|cardsHidden\?:|interactionLocked\?:/);
});

test("Studio route uses one phase and Composer uses one boolean source of truth", async () => {
  const studio = await readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8");

  assert.match(studio, /const \[routePhase, setRoutePhase\] = useState<RouteTransitionPhase>\("idle"\)/);
  assert.match(studio, /setRoutePhase\("exiting"\)[\s\S]{0,360}?setRoutePhase\("morphing"\)[\s\S]{0,360}?setRoutePhase\("revealing"\)[\s\S]{0,360}?setRoutePhase\("idle"\)/);
  assert.match(studio, /runAfterRouteGuiExit\("feed"/);
  assert.match(studio, /runAfterRouteGuiExit\("skill"/);
  assert.doesNotMatch(studio, /setRouteGuiLeaving|setRouteInteractionLocked/);

  assert.match(studio, /const \[composerOpen, setComposerOpen\] = useState\(false\)/);
  assert.doesNotMatch(studio, /ComposerPhase|composerPhase|composerBodyVisible|composerOrigin|"closing"/);
});

test("return projection prefers cards actually visible in the detail viewport", () => {
  assert.deepEqual(rankViewportCards([
    { id: "above", top: -420, right: 200, bottom: -120, left: 0 },
    { id: "first", top: 40, right: 200, bottom: 340, left: 0 },
    { id: "second", top: 360, right: 200, bottom: 660, left: 0 },
    { id: "below", top: 900, right: 200, bottom: 1200, left: 0 },
  ], { top: 0, right: 300, bottom: 700, left: 0 }, 3), ["first", "second"]);
});

test("detail view state and return card order are stored per Skill", async () => {
  const studio = await readFile(new URL("../components/image-skill-studio.tsx", import.meta.url), "utf8");

  assert.match(studio, /const detailViewBySkillRef = useRef\(new Map<string, DetailViewState>\(\)\)/);
  assert.match(studio, /function captureDetailViewState\(\)/);
  assert.match(studio, /rankViewportCards\(/);
  assert.match(studio, /data-route-item-id=/);
  assert.match(studio, /setFeedCardOrderByCollection/);
  assert.match(studio, /const restoreDetailScroll = useCallback/);
  assert.match(studio, /const restoreDetailRail = useCallback/);
  assert.match(studio, /railScrollLeftByTab/);
});
