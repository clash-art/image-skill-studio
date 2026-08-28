import { applyStudioLocale } from "./studio-copy.mjs";

export const STUDIO_PREFERENCES_KEY = "image-skill-studio.preferences";

export function defaultStudioPreferences() {
  return { theme: "light", language: "system" };
}

export function readStudioPreferences(storage = globalThis.localStorage) {
  const fallback = defaultStudioPreferences();
  try {
    const parsed = JSON.parse(storage?.getItem?.(STUDIO_PREFERENCES_KEY) || "");
    return {
      theme: parsed?.theme === "dark" ? "dark" : "light",
      language: parsed?.language === "zh" || parsed?.language === "en" ? parsed.language : "system",
    };
  } catch {
    return fallback;
  }
}

export function writeStudioPreferences(preferences, storage = globalThis.localStorage) {
  const next = {
    theme: preferences?.theme === "dark" ? "dark" : "light",
    language: preferences?.language === "zh" || preferences?.language === "en" ? preferences.language : "system",
  };
  try {
    storage?.setItem?.(STUDIO_PREFERENCES_KEY, JSON.stringify(next));
  } catch {
    // Private mode should still apply the in-memory choice.
  }
  return next;
}

export function applyStudioTheme(theme, root = globalThis.document?.documentElement) {
  const next = theme === "dark" ? "dark" : "light";
  if (root) {
    root.dataset.theme = next;
    if (root.style) root.style.colorScheme = next;
  }
  return next;
}

export function systemLocale(explicit) {
  return explicit
    || globalThis.navigator?.language
    || globalThis.document?.documentElement?.lang
    || "en";
}

export function resolveStudioLocale(language, sources = {}) {
  if (language === "zh" || language === "en") return language;
  return sources.hostLocale || sources.currentLocale || sources.systemLocale || systemLocale();
}

export function applyStoredStudioAppearance({
  storage,
  root,
  hostLocale,
  systemLocale: systemLocaleOverride,
  preferences,
} = {}) {
  const prefs = preferences || readStudioPreferences(storage);
  const target = root ?? globalThis.document?.documentElement;
  applyStudioTheme(prefs.theme, target);
  applyStudioLocale(
    resolveStudioLocale(prefs.language, {
      hostLocale,
      currentLocale: target?.dataset?.locale || target?.lang,
      systemLocale: systemLocaleOverride || systemLocale(),
    }),
    target,
  );
  return prefs;
}
