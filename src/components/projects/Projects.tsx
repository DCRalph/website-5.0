"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { SectionLabel } from "~/components/SectionLabel";
import { projects } from "~/lib/projects";
import { ProjectDrawer } from "./ProjectDrawer";
import { ProjectRow } from "./ProjectRow";

/**
 * Project list plus the writeup drawer. `?project=<title>` opens a project
 * directly (used by the sitemap).
 */
export function Projects() {
  const param = useSearchParams().get("project");

  const [selected, setSelected] = useState(param);

  // Follow later changes to the query param without an effect.
  const [prevParam, setPrevParam] = useState(param);
  if (param !== prevParam) {
    setPrevParam(param);
    setSelected(param);
  }

  const active = projects.find((p) => p.title === selected);

  return (
    <section>
      <SectionLabel>Projects</SectionLabel>
      <ul>
        {projects.map((p) => (
          <ProjectRow
            key={p.title}
            project={p}
            onOpen={() => setSelected(p.title)}
          />
        ))}
      </ul>
      {active && <ProjectDrawer project={active} onClose={() => setSelected(null)} />}
    </section>
  );
}
