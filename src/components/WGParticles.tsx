"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// three.js is heavy, so it only reaches the browser once the canvas actually mounts.
const ParticleObject = dynamic(() => import("~/components/canvasui/ParticleObject").then((m) => m.ParticleObject), {
  ssr: false,
});

const DESKTOP = "(min-width: 768px)";

const FOV = 62;
const CAMERA_DISTANCE = 4.2;
/** Height of the camera frustum where the mark sits, in scene units. */
const VIEW_HEIGHT = 2 * CAMERA_DISTANCE * Math.tan((FOV / 2) * (Math.PI / 180));
/** Share of the canvas width the mark should span, leaving room for the cursor push. */
const FILL = 0.8;
/** Cancels the component's built-in lift so the mark sits centred in its slot. */
const Y_OFFSET = -0.3;

const subscribe = (cb: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", cb);
  return () => query.removeEventListener("change", cb);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;

/**
 * The "WG." monogram rebuilt as a cloud of brand-red particles that the cursor
 * pushes and swirls. Fills the gap between the name and the meta panel in the
 * sidebar. Desktop only: on narrow screens the sidebar collapses into the
 * scrolling column and the canvas would be dead weight.
 */
export function WGParticles() {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false);
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  // The slot is far wider than it is tall, so a fixed scene scale would leave
  // the mark stranded in the middle of it. Size it off the measured aspect.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = slot;
      setScale(clientHeight > 0 ? FILL * VIEW_HEIGHT * (clientWidth / clientHeight) : 0);
    });
    observer.observe(slot);
    return () => observer.disconnect();
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div ref={slotRef} className="min-h-0 flex-1">
      {scale > 0 && (
        // ParticleObject hardcodes `position: relative` inline on its wrapper, so
        // the wrapper has to be filled rather than absolutely positioned.
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
      )}
    </div>
  );
}
