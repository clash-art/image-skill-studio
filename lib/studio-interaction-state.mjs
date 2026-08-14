export function isRouteTransitioning(phase) {
  return phase !== "idle";
}

export function fanCollectionPhase({ route, phase, origin, kind, skillId }) {
  if (phase === "revealing") {
    return origin?.kind === kind && origin?.skillId === skillId
      ? "origin-revealing"
      : route === "feed" ? "revealing" : "hidden";
  }
  if (isRouteTransitioning(phase)) {
    return origin?.kind === kind && origin?.skillId === skillId ? "origin" : "hidden";
  }
  return route === "feed" ? "idle" : "hidden";
}

export function fanCollectionRevealDelay(order, reducedMotion = false) {
  if (reducedMotion) return 0;
  const safeOrder = Number.isFinite(order) ? Math.max(0, Math.floor(order)) : 0;
  return Number((Math.min(safeOrder, 6) * 0.018).toFixed(3));
}

function intersectionArea(rect, viewport) {
  const width = Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left));
  const height = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
  return width * height;
}

export function rankViewportCards(cards, viewport, limit = 4) {
  const viewportCenter = (viewport.top + viewport.bottom) / 2;
  const ranked = cards.map((card, index) => {
    const area = Math.max(1, (card.right - card.left) * (card.bottom - card.top));
    const visibleRatio = intersectionArea(card, viewport) / area;
    const centerDistance = Math.abs((card.top + card.bottom) / 2 - viewportCenter);
    return { ...card, index, visibleRatio, centerDistance };
  });
  const visible = ranked.filter((card) => card.visibleRatio >= 0.15);
  if (visible.length) return visible.slice(0, limit).map((card) => card.id);
  return ranked
    .sort((left, right) => left.centerDistance - right.centerDistance || left.index - right.index)
    .slice(0, 1)
    .map((card) => card.id);
}
