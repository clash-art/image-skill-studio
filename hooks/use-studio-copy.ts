import { useEffect, useState } from "react";

import { studioCopy } from "../lib/studio-copy.mjs";
import { applyStoredStudioAppearance } from "../lib/studio-preferences.mjs";

export type StudioCopy = ReturnType<typeof studioCopy>;

function readHostLocale() {
  if (typeof document === "undefined") return "en";
  return document.documentElement.dataset.locale || document.documentElement.lang || "en";
}

export function useStudioCopy(): StudioCopy {
  const [copy, setCopy] = useState<StudioCopy>(() => {
    applyStoredStudioAppearance();
    return studioCopy(readHostLocale());
  });

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setCopy(studioCopy(readHostLocale()));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-locale", "lang"] });
    return () => observer.disconnect();
  }, []);

  return copy;
}
