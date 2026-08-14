"use client";
/* eslint-disable @next/next/no-img-element -- MCP App images can be data URLs and MCP resources. */

import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type FeatureItem = {
  id: string;
  label: string;
  description: string;
  eyebrow?: string;
  icon: LucideIcon;
  preview?: string;
  disabled?: boolean;
};

type FeatureCarouselProps = {
  features: FeatureItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
};

const ITEM_HEIGHT = 68;

export function FeatureCarousel({ features, selectedId, onSelect, className }: FeatureCarouselProps) {
  const activeIndex = Math.max(0, features.findIndex((feature) => feature.id === selectedId));
  const active = features[activeIndex] ?? features[0];

  const visible = useMemo(() => {
    return features.map((feature, index) => {
      let distance = index - activeIndex;
      if (distance > features.length / 2) distance -= features.length;
      if (distance < -features.length / 2) distance += features.length;
      return { feature, distance };
    });
  }, [activeIndex, features]);

  if (!active) return null;

  return (
    <section className={cn("feature-carousel", className)} aria-label="生图 Skill">
      <div className="feature-carousel__heading">
        <span>Skill collection</span>
        <strong>{String(activeIndex + 1).padStart(2, "0")} / {String(features.length).padStart(2, "0")}</strong>
      </div>

      <div className="feature-carousel__rail">
        {visible.map(({ feature, distance }) => {
          const Icon = feature.icon;
          const isActive = feature.id === active.id;
          return (
            <motion.div
              key={feature.id}
              className="feature-carousel__item"
              animate={{
                y: distance * ITEM_HEIGHT,
                opacity: Math.abs(distance) > 3 ? 0 : 1 - Math.abs(distance) * 0.16,
                scale: isActive ? 1 : 0.96,
              }}
              transition={{ type: "spring", stiffness: 95, damping: 22, mass: 0.9 }}
            >
              <button
                type="button"
                disabled={feature.disabled}
                aria-pressed={isActive}
                onClick={() => onSelect(feature.id)}
                className={cn("feature-pill", isActive && "is-active")}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{feature.label}</span>
              </button>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          className="feature-carousel__summary"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <small>{active.eyebrow ?? "IMAGE GENERATION"}</small>
          <p>{active.description}</p>
          <div className="feature-carousel__preview" aria-hidden="true">
            {active.preview ? <img src={active.preview} alt="" /> : <span>{active.label.slice(0, 1)}</span>}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

export default FeatureCarousel;
