import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  buildExportFilename,
  containRect,
  getExportLayout,
  wrapPrompt,
} from "../lib/export-layout.mjs";

test("Xiaohongshu exports use an exact 3:4 canvas", () => {
  assert.equal(EXPORT_WIDTH, 1080);
  assert.equal(EXPORT_HEIGHT, 1440);
  const layout = getExportLayout("reference_to_result");
  assert.deepEqual(layout.canvas, { width: 1080, height: 1440 });
  assert.equal(layout.reference.width, layout.result.width);
});

test("containRect preserves the entire source image without cropping", () => {
  const rect = containRect(1600, 900, { x: 72, y: 200, width: 936, height: 480 });
  assert.ok(Math.abs(rect.x - 113.33333333333333) < 1e-9);
  assert.equal(rect.y, 200);
  assert.ok(Math.abs(rect.width - 853.3333333333333) < 1e-9);
  assert.equal(rect.height, 480);
});

test("wrapPrompt never silently truncates long copy", () => {
  const prompt = "让风吹过旧书店的窗帘，午后的光落在木桌上。".repeat(20);
  const pages = wrapPrompt(prompt, { maxCharsPerLine: 14, maxLinesPerPage: 8 });
  assert.ok(pages.length > 1);
  assert.equal(pages.flat().join(""), prompt);
});

test("buildExportFilename is filesystem-safe and deterministic", () => {
  assert.equal(
    buildExportFilename("电影 / 海报", "run-12345678", "prompt_to_result", 2),
    "电影-海报_123_prompt-result_02.png",
  );
});
