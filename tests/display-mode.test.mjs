import assert from "node:assert/strict";
import test from "node:test";

import { preferWorkbenchDisplayMode } from "../lib/display-mode.mjs";

test("preferWorkbenchDisplayMode always asks for fullscreen, never the conversation card", () => {
  assert.equal(preferWorkbenchDisplayMode(["inline", "fullscreen", "pip"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode(["inline", "pip"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode(["inline"]), "fullscreen");
  assert.equal(preferWorkbenchDisplayMode([]), "fullscreen");
});
