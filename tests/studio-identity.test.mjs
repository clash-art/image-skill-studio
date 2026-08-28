import assert from "node:assert/strict";
import test from "node:test";

import { createStudioIdentity, injectStudioIdentity, STABLE_STUDIO_TOOLS } from "../lib/studio-identity.mjs";

test("the live identity suffixes every agent-facing tool and uses its own App URI", () => {
  const stable = createStudioIdentity("stable");
  const live = createStudioIdentity("dev");
  assert.equal(stable.tools.open, "open_image_skill_studio");
  assert.equal(live.tools.open, "open_image_skill_studio_dev");
  assert.equal(live.tools.record, "record_image_generation_dev");
  assert.equal(live.resourceUri, "ui://image-skill-studio-dev/v1/workbench.html");
  assert.notEqual(live.resourceUri, stable.resourceUri);
  for (const key of Object.keys(STABLE_STUDIO_TOOLS)) {
    assert.equal(live.tools[key], `${STABLE_STUDIO_TOOLS[key]}_dev`);
  }
});

test("injectStudioIdentity writes the live tool map into the workbench HTML", () => {
  const html = injectStudioIdentity("<!doctype html><head></head>", createStudioIdentity("dev"));
  assert.match(html, /window\.__IMAGE_SKILL_STUDIO__/);
  assert.match(html, /open_image_skill_studio_dev/);
});
