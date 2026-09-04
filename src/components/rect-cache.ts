export interface RectCache {
  /** Latest bounding rect of the observed element. */
  readonly current: DOMRect;
  destroy: () => void;
}

/**
 * Keeps an element's bounding rect on hand so pointer handlers can map client
 * coordinates into element space without forcing a layout on every move.
 * Refreshed on resize of the element itself and on any scroll or window resize.
 */
export function createRectCache(element: Element): RectCache {
  let rect = element.getBoundingClientRect();
  const refresh = () => {
    rect = element.getBoundingClientRect();
  };

  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener("scroll", refresh, { passive: true, capture: true });
  window.addEventListener("resize", refresh, { passive: true });

  return {
    get current() {
      return rect;
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    },
  };
}
