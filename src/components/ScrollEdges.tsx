"use client";

import { useSyncExternalStore } from "react";
import { GradientBlur } from "~/components/GradientBlur";
import { cn } from "~/lib/utils";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const isScrolled = () => window.scrollY > 8;

/**
 * Fixed blur bands at the top and bottom of the scrolling column, so content
 * dissolves as it leaves the viewport. The top band only appears once the page
 * has scrolled, so nothing sits over the name on first paint.
 */
export function ScrollEdges() {
  const scrolled = useSyncExternalStore(subscribe, isScrolled, () => false);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-20 h-20 transition-opacity duration-300 md:left-1/2",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      >
        <GradientBlur direction="top" className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/55 [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-20 md:left-1/2">
        <GradientBlur direction="bottom" className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/55 [mask-image:linear-gradient(to_top,#000_40%,transparent)]" />
      </div>
    </>
  );
}
