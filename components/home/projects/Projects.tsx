import { SectionHeader } from "@/components/utils/SectionHeader";
import { Project } from "./Project";

import { projects } from "@/lib/projects";

export const Projects = () => {
  return (
    <section className="section-wrapper" id="projects">
      <SectionHeader title="Projects" dir="r" />

      <div className={"grid grid-cols-1 lg:grid-cols-2 gap-8"}>
        {projects.map((project) => {
          return <Project key={project.title} {...project} />;
        })}
      </div>
    </section>
  );
};

