"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

// three.js is heavy, so it only reaches the browser once the canvas actually mounts.
const ParticleObject = dynamic(() => import("~/components/canvasui/ParticleObject").then((m) => m.ParticleObject), {
  ssr: false,
});

const DESKTOP = "(min-width: 768px)";

const FOV = 62;
const CAMERA_DISTANCE = 4.2;
/** Height of the camera frustum where the mark sits, in scene units. */
const VIEW_HEIGHT = 2 * CAMERA_DISTANCE * Math.tan((FOV / 2) * (Math.PI / 180));
/** Share of the slot width the mark should span. Cursor push lives in the overflow. */
const FILL = 0.8;
/** Cancels the component's built-in lift so the mark sits centred in its slot. */
const Y_OFFSET = -0.3;
/** Extra canvas around the slot so displaced particles still render. */
const OVERFLOW_PX = 160;

const subscribe = (cb: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", cb);
  return () => query.removeEventListener("change", cb);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;

type FrostRect = { x: number; y: number; w: number; h: number; radius: string };

/**
 * Backdrop-filter on the cards themselves cannot sample this WebGL canvas
 * (sticky sidebar + compositor layers). Plates live in the same flattened
 * layer as the canvas, matching each `[data-frost]` card.
 */
function FrostPlates({ wrapRef }: { wrapRef: RefObject<HTMLDivElement | null> }) {
  const [rects, setRects] = useState<FrostRect[]>([]);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current?.getBoundingClientRect();
      if (!wrap) return;
      setRects(
        [...document.querySelectorAll("[data-frost]")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x - wrap.x,
            y: r.y - wrap.y,
            w: r.width,
            h: r.height,
            radius: getComputedStyle(el).borderRadius,
          };
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [wrapRef]);

  return (
    <>
      {rects.map((r, i) => (
        <div
          key={i}
          aria-hidden
          className="glass-backdrop pointer-events-none absolute"
          style={{
            top: r.y,
            left: r.x,
            width: r.w,
            height: r.h,
            borderRadius: r.radius,
          }}
        />
      ))}
    </>
  );
}

/**
 * The "WG." monogram rebuilt as a cloud of brand-red particles that the cursor
 * pushes and swirls. Fills the gap between the name and the meta panel in the
 * sidebar. Desktop only: on narrow screens the sidebar collapses into the
 * scrolling column and the canvas would be dead weight.
 */
export function WGParticles() {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false);
  const slotRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  // The slot is far wider than it is tall, so a fixed scene scale would leave
  // the mark stranded in the middle of it. Size it off the measured aspect.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = slot;
      // Frustum height maps to the expanded canvas, not the layout slot.
      const canvasHeight = clientHeight + OVERFLOW_PX * 2;
      setScale(canvasHeight > 0 ? FILL * VIEW_HEIGHT * (clientWidth / canvasHeight) : 0);
    });
    observer.observe(slot);
    return () => observer.disconnect();
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div ref={slotRef} className="relative min-h-0 flex-1">
      {scale > 0 && (
        // ParticleObject hardcodes `position: relative` inline on its wrapper, so
        // the overflow box is sized and the component fills that, not the slot.
        // translateZ flattens the WebGL canvas so backdrop-filter can sample it.
        <div ref={wrapRef} className="absolute" style={{ inset: -OVERFLOW_PX, transform: "translateZ(0)" }}>
          <ParticleObject
            src="/wg.glb"
            className="size-full"
            color="#ff2c2c"
            scale={scale}
            yOffset={Y_OFFSET}
            fov={FOV}
            cameraDistance={CAMERA_DISTANCE}
            count={15000}
            size={2.3}
            radius={140}
            strength={1.15}
            swirl={0.7}
            floatIntensity={1.6}
            rotationIntensity={0.8}
            floatSpeed={1.6}
            orbit={false}
          />
          <FrostPlates wrapRef={wrapRef} />
        </div>
      )}
    </div>
  );
}
