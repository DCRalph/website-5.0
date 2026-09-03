import { cn } from "~/lib/utils";

const blurs = [0.5, 1, 2, 4, 8, 16, 32, 64];

type Props = {
  className?: string;
  /** Edge where the blur is strongest. */
  direction?: "top" | "bottom";
};

/**
 * Progressive backdrop blur, ported from the atmos site. Eight stacked
 * backdrop-filter layers, each masked to a band, so the blur ramps smoothly
 * instead of stopping at a hard line. Pure CSS, nothing repaints.
 */
export function GradientBlur({ className, direction = "top" }: Props) {
  const to = direction === "top" ? "to top" : "to bottom";

  return (
    <div className={cn("pointer-events-none", className)} aria-hidden>
      {blurs.map((blur, i) => {
        const start = i * 12.5;
        const stops = [`transparent ${start}%`, `#000 ${Math.min(start + 12.5, 100)}%`];
        if (start + 25 <= 100) stops.push(`#000 ${start + 25}%`);
        if (start + 37.5 <= 100) stops.push(`transparent ${start + 37.5}%`);
        const mask = `linear-gradient(${to}, ${stops.join(", ")})`;

        return (
          <div
            key={blur}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
    </div>
  );
}
