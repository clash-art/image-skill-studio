"use client";

import { Sparkles, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Transition } from "motion/react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Uses the single-surface height animation pattern from 21st's Agent Dock.
// Every visual property shares this one transition, so close retraces open.
const MORPHING_COMPOSER_TRANSITION = {
  type: "spring",
  bounce: 0.1,
  duration: 0.4,
} as const satisfies Transition;

const MORPHING_COMPOSER_OPEN_BACKGROUND = "rgba(255, 253, 248, 0.985)";
const MORPHING_COMPOSER_CLOSED_BACKGROUND = "#202222";
const MORPHING_COMPOSER_OPEN_COLOR = "#202222";
const MORPHING_COMPOSER_CLOSED_COLOR = "#fffdf8";
const MORPHING_COMPOSER_OPEN_BORDER = "rgba(47, 53, 55, 0.08)";
const MORPHING_COMPOSER_CLOSED_BORDER = "rgba(47, 53, 55, 0)";
const MORPHING_COMPOSER_OPEN_SHADOW = "0 30px 90px rgba(24, 28, 30, 0.22)";
const MORPHING_COMPOSER_CLOSED_SHADOW = "0 18px 46px rgba(30, 35, 38, 0.23)";

export type MorphingComposerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExitComplete?: () => void;
  brand: ReactNode;
  title?: string;
  status?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function MorphingComposer({
  open,
  onOpenChange,
  onExitComplete,
  brand,
  title = "Codex",
  status = "Ready to create",
  children,
  className,
  disabled = false,
}: MorphingComposerProps) {
  const uniqueId = useId();
  const shouldReduceMotion = useReducedMotion();
  const [settledOpen, setSettledOpen] = useState<boolean | null>(open);
  const contentId = `morphing-composer-content-${uniqueId}`;
  const transition = shouldReduceMotion
    ? ({ duration: 0 } as const satisfies Transition)
    : MORPHING_COMPOSER_TRANSITION;

  const collapsedInteractive = !open && settledOpen === false;

  function handleSurfaceAnimationStart() {
    setSettledOpen(null);
  }

  function handleSurfaceAnimationComplete() {
    setSettledOpen(open);
    if (!open) onExitComplete?.();
  }

  return (
    <MotionConfig transition={transition}>
      <div className={cn("morphing-composer", className)}>
        <motion.section
          className={cn("morphing-composer__surface", open ? "is-open" : "is-compact")}
          layout
          initial={false}
          animate={{
            backgroundColor: open ? MORPHING_COMPOSER_OPEN_BACKGROUND : MORPHING_COMPOSER_CLOSED_BACKGROUND,
            borderColor: open ? MORPHING_COMPOSER_OPEN_BORDER : MORPHING_COMPOSER_CLOSED_BORDER,
            borderRadius: open ? 26 : 999,
            boxShadow: open ? MORPHING_COMPOSER_OPEN_SHADOW : MORPHING_COMPOSER_CLOSED_SHADOW,
            color: open ? MORPHING_COMPOSER_OPEN_COLOR : MORPHING_COMPOSER_CLOSED_COLOR,
          }}
          transition={transition}
          onAnimationStart={handleSurfaceAnimationStart}
          onAnimationComplete={handleSurfaceAnimationComplete}
          role="region"
          aria-label={`${title} Agent`}
        >
          <button
            type="button"
            className="morphing-composer__open-hit"
            aria-label="打开 Codex Agent"
            aria-expanded={open}
            aria-controls={contentId}
            disabled={disabled || !collapsedInteractive}
            tabIndex={collapsedInteractive ? 0 : -1}
            onClick={() => onOpenChange(true)}
          />

          <motion.header className="morphing-composer__header" layout="position">
            <div className="morphing-composer__agent">
              <span className="morphing-composer__brand">{brand}</span>
              <span className="morphing-composer__identity">
                <strong>{title}</strong>
                <small>{status}</small>
              </span>
            </div>
            <span className="morphing-composer__actions">
              <motion.span
                className="morphing-composer__launch"
                initial={false}
                animate={{ opacity: open ? 0 : 1, scale: open ? 0.72 : 1 }}
                transition={transition}
                aria-hidden="true"
              >
                <Sparkles size={15} />
              </motion.span>
              <motion.button
                type="button"
                className="morphing-composer__close"
                initial={false}
                animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.72 }}
                transition={transition}
                aria-label="收起 Codex Agent"
                disabled={!open}
                tabIndex={open ? 0 : -1}
                onClick={() => onOpenChange(false)}
              >
                <X size={16} />
              </motion.button>
            </span>
          </motion.header>

          <div
            id={contentId}
            className="morphing-composer__reveal-gate"
            aria-hidden={!open}
            inert={!open ? true : undefined}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {open ? (
                <motion.div
                  key="composer-body"
                  className="morphing-composer__reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <div className="morphing-composer__body">{children}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.section>
      </div>
    </MotionConfig>
  );
}
