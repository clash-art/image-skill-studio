"use client";

import { Settings } from "lucide-react";
import { useRef, useState } from "react";

import { useOutsideClick } from "@/hooks/use-outside-click";
import { useStudioCopy } from "@/hooks/use-studio-copy";
import {
  applyStoredStudioAppearance,
  readStudioPreferences,
  writeStudioPreferences,
} from "@/lib/studio-preferences.mjs";

export function StudioSettings() {
  const copy = useStudioCopy();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(readStudioPreferences);

  useOutsideClick(rootRef, () => setOpen(false));

  function update(patch: Partial<{ theme: "light" | "dark"; language: "system" | "zh" | "en" }>) {
    const next = writeStudioPreferences({ ...preferences, ...patch });
    applyStoredStudioAppearance({ preferences: next });
    setPreferences(next);
  }

  return (
    <div className="studio-settings" ref={rootRef}>
      <button
        type="button"
        className="icon-action"
        aria-label={copy.settings}
        aria-expanded={open}
        aria-controls="studio-settings-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings size={16} />
      </button>
      {open ? (
        <div className="studio-settings__panel" id="studio-settings-panel" role="dialog" aria-label={copy.settings}>
          <p>{copy.appearance}</p>
          <div className="studio-settings__segment" role="group" aria-label={copy.appearance}>
            <button type="button" aria-pressed={preferences.theme === "light"} onClick={() => update({ theme: "light" })}>
              {copy.themeLight}
            </button>
            <button type="button" aria-pressed={preferences.theme === "dark"} onClick={() => update({ theme: "dark" })}>
              {copy.themeDark}
            </button>
          </div>
          <p>{copy.language}</p>
          <div className="studio-settings__segment studio-settings__segment--3" role="group" aria-label={copy.language}>
            <button type="button" aria-pressed={preferences.language === "system"} onClick={() => update({ language: "system" })}>
              Auto
            </button>
            <button type="button" aria-pressed={preferences.language === "zh"} onClick={() => update({ language: "zh" })}>
              中文
            </button>
            <button type="button" aria-pressed={preferences.language === "en"} onClick={() => update({ language: "en" })}>
              EN
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
