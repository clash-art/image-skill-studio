"use client";

import * as React from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

type InteractiveTiltCardProps = {
  children: React.ReactNode;
  disabled?: boolean;
  maxTilt?: number;
};

const spring = { stiffness: 260, damping: 24, mass: 0.7 };

export function InteractiveTiltCard({
  children,
  disabled = false,
  maxTilt = 5.5,
}: InteractiveTiltCardProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = React.useState(false);
  const rotateXTarget = useMotionValue(0);
  const rotateYTarget = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const rotateX = useSpring(rotateXTarget, spring);
  const rotateY = useSpring(rotateYTarget, spring);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.08) 18%, rgba(255, 255, 255, 0) 52%)`;
  const interactive = !disabled && !reduceMotion;

  const reset = React.useCallback(() => {
    setHovered(false);
    rotateXTarget.set(0);
    rotateYTarget.set(0);
    glareX.set(50);
    glareY.set(50);
  }, [glareX, glareY, rotateXTarget, rotateYTarget]);

  React.useEffect(() => {
    if (!interactive) reset();
  }, [interactive, reset]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    rotateXTarget.set((0.5 - y) * maxTilt * 2);
    rotateYTarget.set((x - 0.5) * maxTilt * 2);
    glareX.set(x * 100);
    glareY.set(y * 100);
  }

  return (
    <motion.div
      animate={{ scale: hovered && interactive ? 1.012 : 1 }}
      onPointerEnter={(event) => {
        if (interactive && event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={reset}
      onPointerMove={handlePointerMove}
      style={{
        position: "relative",
        width: "100%",
        display: "block",
        borderRadius: "inherit",
        perspective: 1000,
        willChange: "transform",
      }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        style={{
          position: "relative",
          width: "100%",
          display: "block",
          borderRadius: "inherit",
          rotateX,
          rotateY,
          transformOrigin: "center",
          transformPerspective: 1000,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {children}
        <motion.span
          aria-hidden="true"
          animate={{ opacity: hovered && interactive ? 1 : 0 }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            display: "block",
            borderRadius: "inherit",
            background: glare,
            pointerEvents: "none",
            translateZ: 18,
          }}
          transition={{ duration: 0.18 }}
        />
      </motion.div>
    </motion.div>
  );
}
