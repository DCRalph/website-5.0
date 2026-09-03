"use client";

import Image from "next/image";
import { ArrowUpRight, CodeXml } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { Project } from "~/lib/projects";

type Props = { project: Project; onClose: () => void };

/** Project writeup in a bottom drawer: thumbnail and meta in the header, MDX body scrolls, links pinned in the footer. */
export function ProjectDrawer({ project, onClose }: Props) {
  return (
    <Drawer open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="mx-auto max-w-3xl data-[vaul-drawer-direction=bottom]:max-h-[92vh]">
        <DrawerHeader className="gap-3 px-6 text-left">
          <div className="grid grid-cols-[72px_1fr] items-center gap-4">
            <span className="relative block aspect-square overflow-hidden bg-[#0a0a0a]">
              <Image src={project.coverImage} alt="" fill sizes="72px" className="object-cover" />
            </span>
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <DrawerTitle className="text-2xl font-semibold tracking-tight">{project.title}</DrawerTitle>
                <span className="font-mono text-xs text-dim">
                  {project.publishedAt}
                  {project.updatedAt && project.updatedAt !== project.publishedAt && ` · updated ${project.updatedAt}`}
                </span>
              </div>
              <DrawerDescription className="mt-0.5 text-dim">{project.description}</DrawerDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.tech.map((t) => (
              <Badge key={t} variant="outline" className="font-mono text-[11px] font-normal text-dim">
                {t}
              </Badge>
            ))}
          </div>
        </DrawerHeader>

        <ScrollArea className="min-h-0 flex-1 border-t px-6">
          <article className="prose prose-invert prose-neutral max-w-none py-6 prose-headings:tracking-tight prose-a:no-underline">
            <project.Component />
          </article>
        </ScrollArea>

        <DrawerFooter className="flex-row items-center justify-between border-t px-6">
          <div className="flex gap-2">
            {project.projectLink && (
              <Button asChild size="sm">
                <a href={project.projectLink} target="_blank" rel="noopener">
                  Live <ArrowUpRight />
                </a>
              </Button>
            )}
            {project.codeLink && (
              <Button asChild size="sm" variant="outline">
                <a href={project.codeLink} target="_blank" rel="noopener">
                  <CodeXml /> Source
                </a>
              </Button>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="sm">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
