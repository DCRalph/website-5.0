import Image from "next/image";
import type { Project } from "~/lib/projects";

type Props = { project: Project; onOpen: () => void };

export function ProjectRow({ project, onOpen }: Props) {
  return (
    <li className="border-t border-hair last:border-b">
      <button
        type="button"
        onClick={onOpen}
        className="group grid w-full cursor-pointer grid-cols-[110px_1fr] items-center gap-5 py-4 text-left md:grid-cols-[150px_1fr]"
      >
        <span className="block aspect-[3/2] overflow-hidden bg-[#0a0a0a]">
          <Image
            src={project.coverImage}
            alt=""
            width={480}
            height={320}
            sizes="150px"
            className="size-full object-cover opacity-80 grayscale transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:grayscale-0"
          />
        </span>
        <span>
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
