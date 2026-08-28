import assert from "node:assert/strict";
import test from "node:test";

import { preferWorkbenchDisplayMode, WORKBENCH_DISPLAY_MODES } from "../lib/display-mode.mjs";

test("the workbench supports standard inline collapse but still prefers fullscreen", () => {
  assert.deepEqual(WORKBENCH_DISPLAY_MODES, ["fullscreen", "inline"]);
  assert.equal(preferWorkbenchDisplayMode(["inline", "fullscreen", "pip"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode(["inline", "pip"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode(["inline"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode([]), "fullscreen");
});
