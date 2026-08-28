"use client";

import { ChevronLeft, ChevronRight, Copy, WandSparkles, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

export type ArtworkViewerItem = {
  id: string;
  src: string;
  thumbnailSrc?: string;
  alt: string;
  prompt: string;
  aspectRatio?: string;
  mode?: string;
};

type ArtworkLightboxProps = {
  items: ArtworkViewerItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onRemix: (item: ArtworkViewerItem) => void;
  onCopyPrompt: (item: ArtworkViewerItem) => void | Promise<void>;
  labels: {
    close: string;
    previous: string;
    next: string;
    position: (current: number, total: number) => string;
    remix: string;
    copyPrompt: string;
  };
};

export function ArtworkLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  onRemix,
  onCopyPrompt,
  labels,
}: ArtworkLightboxProps) {
  const item = items[index];
  const hasSeveral = items.length > 1;
  const reduceMotion = useReducedMotion();
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [displaySrc, setDisplaySrc] = React.useState(item?.thumbnailSrc || item?.src || "");

  React.useEffect(() => {
    setImageLoaded(false);
    const thumbnailSrc = item?.thumbnailSrc || item?.src || "";
    setDisplaySrc(thumbnailSrc);
    if (!item?.src || item.src === thumbnailSrc) return;

    let cancelled = false;
    const detailImage = new Image();
    detailImage.src = item.src;
    const revealDetail = async () => {
      try {
        await detailImage.decode();
      } catch {
        if (!detailImage.complete || !detailImage.naturalWidth) return;
      }
      if (!cancelled) setDisplaySrc(item.src);
    };
    if (detailImage.complete) void revealDetail();
    else detailImage.onload = () => void revealDetail();
    return () => {
      cancelled = true;
      detailImage.onload = null;
    };
  }, [item?.id, item?.src, item?.thumbnailSrc]);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasSeveral) onIndexChange((index - 1 + items.length) % items.length);
      if (event.key === "ArrowRight" && hasSeveral) onIndexChange((index + 1) % items.length);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [hasSeveral, index, items.length, onClose, onIndexChange]);

  if (!item) return null;

  const move = (offset: number) => onIndexChange((index + offset + items.length) % items.length);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 240,
        display: "grid",
        placeItems: "center",
        padding: "clamp(12px, 2vw, 28px)",
        background: "rgba(12, 13, 13, 0.84)",
        backdropFilter: "blur(20px) saturate(0.72)",
      }}
    >
      <motion.figure
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.99 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "fit-content",
          maxWidth: "94vw",
          maxHeight: "92dvh",
          margin: 0,
          padding: 0,
          overflow: "visible",
          border: 0,
          borderRadius: 0,
          background: "transparent",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 0,
            display: "grid",
            placeItems: "center",
            width: imageLoaded ? "fit-content" : "min(82vw, 900px)",
            height: imageLoaded ? "auto" : "min(72dvh, 760px)",
            maxWidth: "100%",
            maxHeight: "calc(92dvh - 92px)",
            overflow: "hidden",
            borderRadius: 0,
            background: "transparent",
            boxShadow: "0 36px 110px rgba(0, 0, 0, 0.46)",
          }}
        >
          {!imageLoaded ? (
            <motion.span
              aria-hidden="true"
              animate={reduceMotion ? undefined : { backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={reduceMotion ? undefined : { duration: 1.45, ease: "linear", repeat: Infinity }}
              style={{
                position: "absolute",
                inset: 0,
                display: "block",
                background: "linear-gradient(100deg, #252827 12%, #343837 38%, #252827 64%)",
                backgroundSize: "220% 100%",
              }}
            />
          ) : null}
          <motion.img
            key={item.id}
            src={displaySrc}
            alt={item.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: imageLoaded ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            style={{
              display: "block",
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "calc(92dvh - 92px)",
              objectFit: "contain",
              borderRadius: 0,
            }}
          />
        </div>
        <figcaption className="artwork-lightbox__actions">
          <button
            type="button"
            className="artwork-lightbox__action artwork-lightbox__action--secondary"
            onClick={() => onRemix(item)}
          >
            <WandSparkles size={15} strokeWidth={1.8} />
            {labels.remix}
          </button>
          <button
            type="button"
            className="artwork-lightbox__action artwork-lightbox__action--primary"
            onClick={() => void onCopyPrompt(item)}
          >
            <Copy size={15} strokeWidth={1.9} />
            {labels.copyPrompt}
          </button>
        </figcaption>
        <button
          type="button"
          autoFocus
          aria-label={labels.close}
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            border: 0,
            borderRadius: 999,
            color: "#171919",
            background: "rgba(255, 255, 255, 0.92)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.14)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </motion.figure>
      {hasSeveral ? (
        <>
          <button
            type="button"
            aria-label={labels.previous}
            onClick={(event) => { event.stopPropagation(); move(-1); }}
            style={{ position: "fixed", left: "clamp(8px, 2vw, 28px)", top: "50%", width: 44, height: 44, display: "grid", placeItems: "center", border: 0, borderRadius: 999, color: "white", background: "rgba(255,255,255,0.1)", cursor: "pointer" }}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label={labels.next}
            onClick={(event) => { event.stopPropagation(); move(1); }}
            style={{ position: "fixed", right: "clamp(8px, 2vw, 28px)", top: "50%", width: 44, height: 44, display: "grid", placeItems: "center", border: 0, borderRadius: 999, color: "white", background: "rgba(255,255,255,0.1)", cursor: "pointer" }}
          >
            <ChevronRight size={22} />
          </button>
        </>
      ) : null}
    </motion.div>
  );
}
