"use client";

import Image from "next/image";
import { GradientBlur } from "~/components/GradientBlur";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import type { Project } from "~/lib/projects";

type Props = { project: Project; onClose: () => void };

/** Full writeup for a project, rendered from its MDX file. */
export function ProjectModal({ project, onClose }: Props) {
  const links = [
    project.codeLink && { label: "Source", href: project.codeLink },
    project.projectLink && { label: "Live", href: project.projectLink },
  ].filter((l) => l !== undefined && l !== "");

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <div className="relative aspect-[16/7] overflow-hidden bg-[#0a0a0a]">
          <Image
            src={project.coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover opacity-80"
            priority
          />
          <GradientBlur direction="bottom" className="absolute inset-x-0 top-1/2 bottom-0" />
          <div className="absolute inset-0 bg-black/60 [mask-image:linear-gradient(to_top,#000_20%,transparent_70%)]" />
        </div>

        <div className="px-6 pb-8 md:px-8">
          <div className="-mt-8 relative flex items-baseline justify-between gap-4">
            <DialogTitle className="text-3xl font-semibold tracking-tight">{project.title}</DialogTitle>
            <span className="font-mono text-xs text-dim">
              {project.publishedAt}
              {project.updatedAt && project.updatedAt !== project.publishedAt && ` · updated ${project.updatedAt}`}
            </span>
          </div>
          <DialogDescription className="mt-1 text-dim">{project.description}</DialogDescription>
          <p className="mt-2 font-mono text-xs text-dimmer">{project.tech.join(" · ")}</p>

          {links.length > 0 && (
            <p className="mt-4 flex gap-5 text-sm">
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener" className="underline underline-offset-4 decoration-[#444] hover:decoration-brand">
                  {l.label} ↗
                </a>
              ))}
            </p>
          )}

          <article className="prose prose-invert prose-neutral mt-8 max-w-none prose-headings:tracking-tight prose-a:no-underline">
            <project.Component />
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
