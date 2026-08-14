"use client";

import { type RefObject, useEffect } from "react";

export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
) {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) callback();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [callback, ref]);
}
