"use client";
/* eslint-disable @next/next/no-img-element -- MCP App images can be data URLs and MCP resources. */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";

import { useOutsideClick } from "@/hooks/use-outside-click";
import { fanPlacement } from "@/lib/fan-collection.mjs";
import { fanCollectionRevealDelay } from "@/lib/studio-interaction-state.mjs";
import { cn } from "@/lib/utils";

export type FanCollectionItem = {
  id: string;
  src: string;
  alt: string;
  meta?: string;
  status?: "running" | "succeeded" | "failed";
  layoutId?: string;
  imageLayoutId?: string;
};

type FanCollectionProps = {
  label: string;
  items: FanCollectionItem[];
  total?: number;
  meta?: string;
  onSelect: (item: FanCollectionItem, visibleItems: FanCollectionItem[]) => void;
  className?: string;
  phase?: FanCollectionPhase;
  revealOrder?: number;
  routeKey?: string;
};

export type FanCollectionPhase = "idle" | "origin" | "origin-revealing" | "hidden" | "revealing";

type FanInteraction = {
  pinned: boolean;
  hovered: boolean;
  focused: boolean;
};

const idleFanInteraction: FanInteraction = {
  pinned: false,
  hovered: false,
  focused: false,
};

const routeTransition = {
  type: "spring",
  stiffness: 160,
  damping: 18,
  mass: 1,
} as const;

export function FanCollection({
  label,
  items,
  total = items.length,
  meta,
  onSelect,
  className,
  phase = "idle",
  revealOrder = 0,
  routeKey,
}: FanCollectionProps) {
  const visibleItems = items.slice(0, 4);
  const shouldReduceMotion = useReducedMotion();
  const collectionGuiExitDuration = shouldReduceMotion ? 0 : 0.055;
  const collectionImageExitDuration = shouldReduceMotion ? 0 : 0.045;
  const revealDelay = fanCollectionRevealDelay(revealOrder, Boolean(shouldReduceMotion));
  const [interaction, setInteraction] = useState<FanInteraction>(idleFanInteraction);
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastPointerType = useRef("");
  const cardsId = useId();
  const resetFanState = useCallback(() => {
    setInteraction(idleFanInteraction);
    lastPointerType.current = "";
  }, []);
  useOutsideClick(rootRef, resetFanState);

  useEffect(() => {
    if (phase === "idle") return;
    lastPointerType.current = "";
    const frame = requestAnimationFrame(resetFanState);
    return () => cancelAnimationFrame(frame);
  }, [phase, resetFanState]);

  if (!visibleItems.length) return null;
  const canFan = visibleItems.length > 1;
  const interactionLocked = phase !== "idle";
  const cardsHidden = phase === "hidden";
  const guiHidden = phase === "hidden" || phase === "origin";
  const revealing = phase === "revealing" || phase === "origin-revealing";
  const isFanned = canFan && (
    phase === "origin" || phase === "origin-revealing"
    || phase === "idle" && (interaction.pinned || interaction.hovered || interaction.focused)
  );

  function selectItem(event: MouseEvent<HTMLButtonElement>, item: FanCollectionItem) {
    const directTouch = lastPointerType.current && lastPointerType.current !== "mouse";
    lastPointerType.current = "";
    if (canFan && !interaction.pinned && directTouch && event.detail > 0) {
      setInteraction((current) => ({ ...current, pinned: true }));
      return;
    }
    onSelect(item, visibleItems);
  }

  function handleEscape(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape" || !interaction.pinned) return;
    event.preventDefault();
    resetFanState();
    triggerRef.current?.focus();
  }

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (phase === "idle" && event.pointerType === "mouse") {
      setInteraction((current) => ({ ...current, hovered: true }));
    }
  }

  function handleFocusLeave(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setInteraction((current) => ({ ...current, focused: false }));
    }
  }

  return (
    <article
      ref={rootRef}
      className={cn(
        "fan-collection",
        interaction.pinned && "is-open",
        !canFan && "is-single",
        interactionLocked && "is-transition-locked",
        className,
      )}
      data-route-visibility={phase}
      data-route-collection={routeKey}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => setInteraction((current) => ({ ...current, hovered: false }))}
      onFocus={(event) => {
        if (phase === "idle" && event.target !== triggerRef.current) {
          setInteraction((current) => ({ ...current, focused: true }));
        }
      }}
      onBlur={handleFocusLeave}
    >
      <motion.button
        initial={false}
        ref={triggerRef}
        type="button"
        className="fan-collection__trigger"
        aria-expanded={canFan ? interaction.pinned : false}
        aria-controls={cardsId}
        aria-label={canFan ? `${label}，${total} 件，${interaction.pinned ? "收起" : "展开"}` : `打开 ${label}`}
        onClick={() => {
          if (!canFan) {
            onSelect(visibleItems[0], visibleItems);
            return;
          }
          if (interaction.pinned) resetFanState();
          else setInteraction((current) => ({ ...current, pinned: true }));
        }}
        onKeyDown={handleEscape}
        disabled={interactionLocked || guiHidden}
        animate={{
          opacity: guiHidden ? 0 : 1,
          transition: {
            duration: guiHidden
              ? collectionGuiExitDuration
              : shouldReduceMotion ? 0 : revealing ? 0.14 : 0.11,
            delay: guiHidden || shouldReduceMotion ? 0 : revealing ? revealDelay + 0.018 : 0.075,
            ease: guiHidden ? [0.4, 0, 1, 1] : [0.22, 1, 0.36, 1],
          },
        }}
        exit={{
          opacity: 0,
          transition: { duration: collectionGuiExitDuration, ease: [0.4, 0, 1, 1] },
        }}
      >
        <strong>{label}</strong>
        <small>{total}{meta ? ` · ${meta}` : ""}</small>
      </motion.button>

      <motion.div
        initial={false}
        id={cardsId}
        className="fan-collection__cards"
        aria-hidden={cardsHidden || undefined}
        animate={{
          opacity: cardsHidden ? 0 : 1,
          y: cardsHidden ? 6 : 0,
          transition: {
            duration: cardsHidden
              ? collectionImageExitDuration
              : shouldReduceMotion ? 0 : revealing ? 0.16 : 0.11,
            delay: cardsHidden || shouldReduceMotion ? 0 : revealing ? revealDelay : 0.075,
            ease: cardsHidden ? [0.4, 0, 1, 1] : [0.22, 1, 0.36, 1],
          },
        }}
      >
        {visibleItems.map((item, index) => {
          const placement = fanPlacement(index, visibleItems.length);
          const stackDepth = visibleItems.length - 1 - index;
          const baseY = isFanned ? placement.y : stackDepth * -3;
          const hoverLiftY = shouldReduceMotion ? baseY : baseY - 12;
          const hoverScale = shouldReduceMotion ? 1 : 1.05;
          const style: CSSProperties = { zIndex: placement.zIndex };
          return (
            <motion.button
              initial={false}
              key={item.id}
              type="button"
              data-route-item-id={item.id}
              layout
              layoutId={item.layoutId}
              animate={{
                x: isFanned ? `${placement.x}%` : `${stackDepth * -1.15}%`,
                y: baseY,
                rotate: isFanned ? placement.rotation : stackDepth * -1.2,
              }}
              whileHover={interactionLocked ? undefined : {
                scale: hoverScale,
                y: hoverLiftY,
                zIndex: 50,
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                },
              }}
              transition={{
                layout: routeTransition,
                x: { ...routeTransition, delay: isFanned ? index * 0.024 : 0 },
                y: { ...routeTransition, delay: isFanned ? index * 0.024 : 0 },
                rotate: { ...routeTransition, delay: isFanned ? index * 0.024 : 0 },
              }}
              className={cn("fan-collection__card", item.status && `is-${item.status}`)}
              style={style}
              aria-label={`打开 ${label}：${item.alt}${item.meta ? `，${item.meta}` : ""}`}
              onPointerDown={(event) => {
                lastPointerType.current = event.pointerType;
              }}
              onClick={(event) => selectItem(event, item)}
              onKeyDown={handleEscape}
              disabled={interactionLocked || cardsHidden}
            >
              <motion.span
                className="fan-collection__media"
                layout="position"
                layoutId={item.imageLayoutId}
                transition={routeTransition}
              >
                <img src={item.src} alt="" />
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>
    </article>
  );
}

export default FanCollection;
