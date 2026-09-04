import { SectionLabel } from "~/components/SectionLabel";
import { experience } from "~/lib/experience";
import { cn } from "~/lib/utils";

export function Work() {
  return (
    <section className="relative z-10">
      <SectionLabel>Work</SectionLabel>
      <ol className="border-l border-hair-strong pl-7">
        {experience.map((role, i) => {
          const isCurrent = i === 0;
          return (
            <li key={role.position} className="relative pb-9 last:pb-2">
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 -left-8 size-[7px] rounded-full border",
                  isCurrent ? "border-brand bg-brand" : "border-dimmer bg-black",
                )}
              />
              <span className={cn("mb-1 block font-mono text-xs", isCurrent ? "text-brand" : "text-dimmer")}>
                {role.time}
              </span>
              <h3 className="text-xl font-medium tracking-tight">{role.position}</h3>
              <p className="mt-1 max-w-[520px] text-dim">
                {role.company}. {role.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
