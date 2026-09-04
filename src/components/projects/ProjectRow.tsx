import Image from "next/image";
import type { Project } from "~/lib/projects";

type Props = { project: Project; onOpen: () => void };

export function ProjectRow({ project, onOpen }: Props) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group glass grid w-full cursor-pointer grid-cols-[110px_1fr] items-center gap-5 rounded-xl p-3 text-left transition-colors hover:bg-white/[0.07] md:grid-cols-[150px_1fr]"
      >
        <span className="block aspect-[3/2] overflow-hidden rounded-lg bg-[#0a0a0a]">
          {project.coverImage && (
            <Image
              src={project.coverImage}
              alt=""
              width={480}
              height={320}
              sizes="150px"
              className="size-full object-cover opacity-80 grayscale transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:grayscale-0"
            />
          )}
        </span>
        <span className="pr-1">
          <span className="flex justify-between text-[17px] font-medium tracking-tight transition-colors group-hover:text-brand">
            {project.title}
            <span className="font-mono text-xs font-normal text-dimmer">{project.year}</span>
          </span>
          <span className="mt-0.5 block text-dim">{project.description}</span>
          <span className="mt-1 block font-mono text-xs text-dimmer">{project.tech.join(" · ")}</span>
        </span>
      </button>
    </li>
  );
}
