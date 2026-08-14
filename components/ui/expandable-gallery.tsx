"use client";
/* eslint-disable @next/next/no-img-element -- MCP App images can be data URLs and MCP resources. */

import { ArrowLeft, Expand, ImageIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  label?: string;
  meta?: string;
  status?: "running" | "succeeded" | "failed";
};

type ExpandableGalleryProps = {
  items: GalleryItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const transition = { type: "spring", stiffness: 165, damping: 20, mass: 0.95 } as const;
const collapsedTransforms = [
  { rotate: -8, x: -32, y: 11 },
  { rotate: 4, x: 28, y: -4 },
  { rotate: -1, x: 0, y: -14 },
];

export function ExpandableGallery({
  items,
  selectedId,
  onSelect,
  empty,
  footer,
  className,
}: ExpandableGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const layoutGroupId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsExpanded(false), []);
  useOutsideClick(containerRef, () => {
    if (isExpanded) close();
  });

  if (!items.length) {
    return (
      <div className={cn("expandable-gallery expandable-gallery--empty", className)}>
        {empty ?? (
          <div className="gallery-empty">
            <span><ImageIcon size={26} strokeWidth={1.5} /></span>
            <strong>你的作品会叠放在这里</strong>
            <p>Codex 调用 image_gen 后，真实产物会自动进入右侧作品集。</p>
          </div>
        )}
      </div>
    );
  }

  const ordered = [...items].sort((left, right) => {
    if (left.id === selectedId) return 1;
    if (right.id === selectedId) return -1;
    return 0;
  });

  return (
    <section className={cn("expandable-gallery", isExpanded && "is-expanded", className)}>
      <LayoutGroup id={layoutGroupId}>
        <div className="expandable-gallery__toolbar">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.button
                key="back"
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={close}
              >
                <ArrowLeft size={16} /> 返回作品堆
              </motion.button>
            ) : (
              <motion.button
                key="expand"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsExpanded(true)}
              >
                <Expand size={15} /> 展开全部
              </motion.button>
            )}
          </AnimatePresence>
          <span>{items.length} 件作品</span>
        </div>

        <motion.div
          ref={containerRef}
          layout
          className={cn("expandable-gallery__canvas", isExpanded && "is-grid")}
          transition={transition}
        >
          {ordered.map((item, index) => {
            if (!isExpanded && index < Math.max(0, ordered.length - 3)) return null;
            const stackIndex = index - Math.max(0, ordered.length - 3);
            const transform = collapsedTransforms[Math.max(0, stackIndex)] ?? collapsedTransforms[2];
            return (
              <motion.figure
                key={item.id}
                layout
                layoutId={`gallery-card-${item.id}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: isExpanded ? 0 : transform.rotate,
                  x: isExpanded ? 0 : transform.x,
                  y: isExpanded ? 0 : transform.y,
                  zIndex: isExpanded ? 1 : index + 1,
                }}
                whileHover={isExpanded ? { y: -4 } : { y: transform.y - 12, scale: 1.025 }}
                transition={transition}
                className={cn("gallery-card", item.status && `is-${item.status}`)}
                onClick={() => {
                  onSelect?.(item.id);
                  if (!isExpanded) setIsExpanded(true);
                }}
              >
                <motion.div layoutId={`gallery-image-${item.id}`} className="gallery-card__image">
                  <img src={item.src} alt={item.alt} />
                </motion.div>
                <figcaption>
                  <strong>{item.label ?? "Generated image"}</strong>
                  <small>{item.meta}</small>
                </figcaption>
              </motion.figure>
            );
          })}
        </motion.div>
        {!isExpanded && footer ? <div className="expandable-gallery__footer">{footer}</div> : null}
      </LayoutGroup>
    </section>
  );
}

export default ExpandableGallery;
