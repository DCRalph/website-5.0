"use client";

import Image, { getImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "~/lib/utils";

export type GalleryImage = { src: string; alt: string };

type Props = {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Accessible name for the dialog, e.g. the project title. */
  label: string;
};

/** Horizontal travel that steps to the next image, and vertical travel that dismisses. */
const swipeStep = 60;
const swipeDismiss = 120;
/** Past this the pointer is dragging, so the pointerup that follows is not a click. */
const dragSlop = 10;

type Gesture = { x: number; y: number; axis: "x" | "y" | null };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Full screen viewer for a project's images. Arrow keys and the edge buttons step,
 * Escape or a click beside the photo closes, a horizontal swipe steps and a vertical
 * one dismisses. Rendered into the body rather than into the drawer because vaul
 * keeps a transform on the drawer, which would trap `fixed` inside it.
 */
export function ImageGallery({ images, index, onIndexChange, onClose, label }: Props) {
  // Null while idle, so the track only animates between images and not back from a
  // drag the pointer is still holding.
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);
  const current = images[index];

  const step = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < images.length) onIndexChange(next);
  };

  // Re-bound every render so it always closes over the current index. Capture phase
  // keeps Escape from reaching the drawer underneath, which would otherwise close
  // along with the gallery.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    // The rail scrolls itself, so a drag that starts there is not an image swipe.
    if (event.target instanceof Element && event.target.closest("[data-gallery-rail]")) return;
    gesture.current = { x: event.clientX, y: event.clientY, axis: null };
    dragged.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = gesture.current;
    if (!start) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    // Lock to whichever axis the gesture commits to first, so a swipe does not smear
    // diagonally across the screen.
    if (!start.axis) {
      if (Math.abs(x) < dragSlop && Math.abs(y) < dragSlop) return;
      start.axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
      dragged.current = true;
    }
    setDrag(start.axis === "x" ? { x, y: 0 } : { x: 0, y });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!start?.axis) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (start.axis === "x" && Math.abs(x) > swipeStep) step(x < 0 ? 1 : -1);
    if (start.axis === "y" && Math.abs(y) > swipeDismiss) onClose();
  };

  const endGesture = () => {
    gesture.current = null;
    setDrag(null);
  };

  // Only clicks that land on the backdrop close, not the photo or the controls.
  const onClick = (event: React.MouseEvent) => {
    if (dragged.current) return;
    if (event.target instanceof Element && event.target.closest("img, button, [data-gallery-rail]")) return;
    onClose();
  };

  const offset = drag ?? { x: 0, y: 0 };
  const showRail = images.length > 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // The drawer's dismissable layer sets pointer-events none on the body.
      className="pointer-events-auto fixed inset-0 z-[60] touch-none overflow-hidden bg-black select-none"
      style={{ opacity: 1 - Math.min(Math.abs(offset.y) / 600, 0.45) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endGesture}
      onClick={onClick}
    >
      <div
        className={cn("flex h-full", !drag && "transition-transform duration-300 ease-out")}
        style={{ transform: `translate3d(calc(${-index * 100}% + ${offset.x}px), ${offset.y}px, 0)` }}
      >
        {images.map((image, i) => (
          <div key={image.src} className="flex h-full w-full shrink-0 items-center justify-center px-4 pt-14 pb-28 md:px-16 md:pb-32">
            <Photo image={image} eager={Math.abs(i - index) <= 1} />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between px-4">
        <span className="font-mono text-xs">
          {pad(index + 1)} <span className="text-dimmer">/ {pad(images.length)}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="glass relative flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/10"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {index > 0 && <GalleryArrow side="left" onClick={() => step(-1)} />}
      {index < images.length - 1 && <GalleryArrow side="right" onClick={() => step(1)} />}

      {current?.alt && (
        <p className={cn("absolute left-5 max-w-[60%] text-sm text-dim", showRail ? "bottom-22 md:bottom-24" : "bottom-5")}>
          {current.alt}
        </p>
      )}

      {showRail && <GalleryRail images={images} index={index} onPick={onIndexChange} />}
    </div>,
    document.body,
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "glass absolute top-1/2 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-40 transition-opacity hover:opacity-100 md:flex",
        side === "left" ? "left-3.5" : "right-3.5",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Thumbnails of the whole set along the bottom edge, so the current position is
 * always visible and any image is one click away. The rail keeps the active
 * thumbnail in view as the gallery is stepped through by any other means.
 */
function GalleryRail({ images, index, onPick }: { images: GalleryImage[]; index: number; onPick: (index: number) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLButtonElement>(null);

  // Centre the active thumbnail by scrolling the rail itself. scrollIntoView would
  // also scroll the gallery root, which the slide track overflows.
  useEffect(() => {
    const thumb = active.current;
    if (!rail.current || !thumb) return;
    rail.current.scrollTo({
      left: thumb.offsetLeft - (rail.current.clientWidth - thumb.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [index]);

  return (
    <div
      ref={rail}
      data-gallery-rail
      className="absolute inset-x-0 bottom-0 touch-pan-x overflow-x-auto bg-linear-to-t from-black to-transparent px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* w-max keeps the set centred until it outgrows the screen, and scrollable from
          the first thumbnail once it does. */}
      <div className="mx-auto flex w-max gap-2">
        {images.map((image, i) => (
          <button
            key={image.src}
            ref={i === index ? active : null}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Image ${i + 1}`}
            aria-current={i === index}
            className={cn(
              "size-11 shrink-0 cursor-pointer overflow-hidden rounded-md border transition-opacity md:size-14",
              i === index ? "border-white/35 opacity-100" : "border-transparent opacity-45 hover:opacity-80",
            )}
          >
            <Image src={image.src} alt="" width={112} height={112} sizes="56px" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The optimizer's srcSet on a plain `img`, so the element box hugs the photo. With
 * next/image's `fill` the box would cover the whole slide and clicks in the
 * letterboxing beside the photo would never reach the backdrop.
 */
function Photo({ image, eager }: { image: GalleryImage; eager: boolean }) {
  const { props } = getImageProps({
    src: image.src,
    alt: image.alt,
    fill: true,
    sizes: "100vw",
    loading: eager ? "eager" : "lazy",
  });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optimized through getImageProps above
    <img
      src={props.src}
      srcSet={props.srcSet}
      sizes={props.sizes}
      loading={props.loading}
      decoding={props.decoding}
      alt={image.alt}
      draggable={false}
      className="max-h-full max-w-full rounded-sm object-contain"
    />
  );
}
