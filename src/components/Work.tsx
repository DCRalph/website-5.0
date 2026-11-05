import { SectionLabel } from "~/components/SectionLabel";
import { experience, sideGigs } from "~/lib/experience";
import { cn } from "~/lib/utils";

export function Work() {
  return (
    <section className="relative z-10">
      <SectionLabel>Work</SectionLabel>
      <RoleTimeline roles={experience} variant="main" />
      {sideGigs.length > 0 && (
        <>
          <h3 className="mt-7 mb-4 font-mono text-xs tracking-[.08em] text-dimmer uppercase">On the side</h3>
          <RoleTimeline roles={sideGigs} variant="side" />
        </>
      )}
    </section>
  );
}

type Role = (typeof experience)[number] | (typeof sideGigs)[number];

/**
 * Vertical timeline of roles. "main" marks the first role as current with a
 * solid red dot. "side" roles are all ongoing, shown with hollow red dots.
 */
function RoleTimeline({ roles, variant }: { roles: readonly Role[]; variant: "main" | "side" }) {
  return (
    <ol className="border-l border-hair-strong pl-7">
      {roles.map((role, i) => {
        const isCurrent = variant === "side" || i === 0;
        return (
          <li key={role.position} className="relative pb-9 last:pb-2">
            <span
              aria-hidden
              className={cn(
                "absolute top-2 -left-8 size-[7px] rounded-full border",
                !isCurrent && "border-dimmer bg-black",
                isCurrent && (variant === "side" ? "border-brand bg-black" : "border-brand bg-brand"),
              )}
            />
            <span className={cn("mb-1 block font-mono text-xs", isCurrent ? "text-brand" : "text-dimmer")}>
              {role.time}
            </span>
            <h3 className="text-xl font-medium tracking-tight">{role.position}</h3>
            <p className="mt-1 max-w-[520px] text-dim">
              {role.company}.{role.description && ` ${role.description}`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
