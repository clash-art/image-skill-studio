import assert from "node:assert/strict";
import test from "node:test";

import { applyStudioHostAppearance } from "../lib/studio-host-appearance.mjs";
import {
  applyStoredStudioAppearance,
  defaultStudioPreferences,
  readStudioPreferences,
  resolveStudioLocale,
  writeStudioPreferences,
} from "../lib/studio-preferences.mjs";

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

test("Studio defaults to light theme and system language", () => {
  assert.deepEqual(defaultStudioPreferences(), { theme: "light", language: "system" });
  assert.equal(resolveStudioLocale("system", { systemLocale: "zh-CN" }), "zh-CN");
  assert.equal(resolveStudioLocale("system", { hostLocale: "en-US", systemLocale: "zh-CN" }), "en-US");
  assert.equal(resolveStudioLocale("zh", { hostLocale: "en-US" }), "zh");
});

test("stored appearance stays light even when the host asks for dark", () => {
  const storage = memoryStorage();
  const root = { dataset: {}, style: {}, lang: "en", dir: "ltr" };
  applyStoredStudioAppearance({ storage, root, systemLocale: "en-US" });
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");

  const previous = globalThis.document;
  const previousStorage = globalThis.localStorage;
  globalThis.document = { documentElement: root };
  globalThis.localStorage = storage;
  try {
    applyStudioHostAppearance({ theme: "dark", locale: "zh-CN" });
  } finally {
    globalThis.document = previous;
    globalThis.localStorage = previousStorage;
  }
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.lang, "zh-CN");
});

test("the user can opt into dark and pin a language", () => {
  const storage = memoryStorage();
  const root = { dataset: {}, style: {}, lang: "en", dir: "ltr" };
  const next = writeStudioPreferences({ theme: "dark", language: "en" }, storage);
  applyStoredStudioAppearance({ storage, root, preferences: next, hostLocale: "zh-CN" });
  assert.equal(readStudioPreferences(storage).theme, "dark");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.lang, "en");
});
