type Rect = { top: number; bottom: number; height: number };

// Half of the tweet on screen, or half the viewport covered for tweets taller than 2x the viewport
// (their intersection ratio can never reach 0.5).
export function isMostlyVisible(rect: Rect, viewportHeight: number): boolean {
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  return rect.height > 0 && visible >= 0.5 * Math.min(rect.height, viewportHeight);
}

// isIntersecting alone is true for any sliver on screen; decide after a short dwell so fast scrolling
// past a tweet never triggers a paid Jev call.
export function createVisibilityGate(onVisible: (el: Element) => void, dwellMs = 400) {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const disarm = (el: Element) => {
    clearTimeout(timers.get(el));
    timers.delete(el);
  };
  const arm = (el: Element) => {
    if (timers.has(el)) return;
    timers.set(
      el,
      setTimeout(() => {
        timers.delete(el);
        if (el.isConnected && isMostlyVisible(el.getBoundingClientRect(), window.innerHeight)) onVisible(el);
      }, dwellMs),
    );
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) arm(e.target);
        else disarm(e.target);
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  return {
    observe: (el: Element) => io.observe(el),
    // Re-observing delivers a fresh entry for the current position.
    recheck: (el: Element) => {
      disarm(el);
      io.unobserve(el);
      io.observe(el);
    },
    disconnect: () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
