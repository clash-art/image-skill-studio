import { applyStoredStudioAppearance, readStudioPreferences } from "./studio-preferences.mjs";

export function applyStudioHostAppearance(context = {}) {
  const root = globalThis.document?.documentElement;
  if (context.displayMode && root) root.dataset.displayMode = context.displayMode;
  applyStoredStudioAppearance({
    preferences: readStudioPreferences(),
    hostLocale: context.locale,
  });
}
