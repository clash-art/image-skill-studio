import assert from "node:assert/strict";
import test from "node:test";

import { applyStudioLocale, studioCopy, studioLanguage } from "../lib/studio-copy.mjs";

test("host locales map to Chinese or English Studio copy", () => {
  assert.equal(studioLanguage("zh-CN"), "zh");
  assert.equal(studioLanguage("zh-TW"), "zh");
  assert.equal(studioLanguage("en-US"), "en");
  assert.equal(studioLanguage("de-DE"), "en");
  assert.equal(studioCopy("zh-CN").tryLuck, "试试手气");
  assert.equal(studioCopy("en").tryLuck, "Try your luck");
  assert.equal(studioCopy("zh").settings, "设置");
  assert.equal(studioCopy("en").settings, "Settings");
  assert.ok(studioCopy("en").tryLuck.length > studioCopy("zh").tryLuck.length);
});

test("applying a locale updates lang without assuming a fixed width label", () => {
  const root = { lang: "zh-CN", dataset: {}, dir: "ltr" };
  assert.equal(applyStudioLocale("en-GB", root), "en");
  assert.equal(root.lang, "en");
  assert.equal(root.dataset.locale, "en");
  assert.equal(applyStudioLocale("zh", root), "zh");
  assert.equal(root.lang, "zh-CN");
});

test("handoff copy is localized and does not require $imagegen", () => {
  const zh = studioCopy("zh").handoff;
  const en = studioCopy("en").handoff;
  assert.match(zh.renderGuidance, /其他生图 Skill、工具或手段/);
  assert.match(en.renderGuidance, /another image skill, tool, or method/);
  assert.doesNotMatch(zh.renderGuidance, /出图必须/);
  assert.doesNotMatch(en.renderGuidance, /must use `\$imagegen`/);
  assert.equal(en.scene("Moon"), "Scene: Moon");
  assert.equal(zh.scene("月"), "画面要求：月");
  assert.equal(studioCopy("zh").composerHandedOff, "已交给 Codex");
  assert.equal(studioCopy("en").composerHandedOff, "Handed off");
  assert.equal(studioCopy("zh").handOff, "交给 Codex");
  assert.equal(studioCopy("en").handOff, "Hand off to Codex");
});
