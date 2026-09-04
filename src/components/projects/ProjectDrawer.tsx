"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, CodeXml } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerTitle } from "~/components/ui/drawer";
import type { Project } from "~/lib/projects";

// Reads window/navigator at module scope, so keep it out of the server bundle.
const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

type Props = { project: Project; onClose: () => void };

/**
 * Project writeup in a bottom drawer. Cover strip on top with the title on
 * its blur fade, MDX body scrolls, links pinned in the footer. Mounting with
 * `open` true makes vaul play the slide-up; closing flips the state so it
 * slides down, and `onClose` fires once that animation has finished.
 */
export function ProjectDrawer({ project, onClose }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <Drawer open={open} onOpenChange={setOpen} onAnimationEnd={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="mx-auto max-w-3xl overflow-hidden rounded-t-2xl border-white/10 bg-[#0a0a0a] data-[vaul-drawer-direction=bottom]:max-h-[92vh]">
        <div className="relative mt-3 h-44 shrink-0 overflow-hidden bg-black md:h-52">
          <Image src={project.coverImage} alt="" fill sizes="768px" className="object-cover" priority />
          {/* Liquid-glass title band. The library centres its pane on top/left via a -50% translate,
              so it sits at 50%/50% of a wrapper sized to match, and the wrapper is masked so the
              refraction fades out up the cover. The [&_.glass] resets undo this site's own `glass`
              utility, which the library's inner element happens to share a class name with. */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-28 [mask-image:linear-gradient(to_top,#000_45%,transparent)] md:h-32 [&_.glass]:border-0 [&_.glass]:bg-transparent [&_.glass]:shadow-none [&_.glass]:backdrop-blur-none">
            <LiquidGlass
              style={{ position: "absolute", top: "50%", left: "50%" }}
              cornerRadius={0}
              padding="0"
              elasticity={0}
              displacementScale={48}
              blurAmount={0.35}
              saturation={130}
              aberrationIntensity={1.5}
            >
              <div className="flex h-28 w-screen max-w-3xl items-end justify-between gap-4 px-6 pb-4 md:h-32">
                <DrawerTitle className="text-3xl font-semibold tracking-tight">{project.title}</DrawerTitle>
                <span className="font-mono text-xs text-white/70">
                  {project.publishedAt}
                  {project.updatedAt && project.updatedAt !== project.publishedAt && ` · updated ${project.updatedAt}`}
                </span>
              </div>
            </LiquidGlass>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 pt-3 pb-4">
          <DrawerDescription className="text-[15px] text-dim">{project.description}</DrawerDescription>
          <span className="font-mono text-xs text-dimmer">{project.tech.join(" · ")}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <article className="prose prose-invert prose-neutral max-w-none py-6 prose-headings:tracking-tight prose-a:no-underline prose-img:rounded-lg">
            <project.Component />
          </article>
        </div>

        <DrawerFooter className="flex-row items-center justify-between border-t px-6">
          <div className="flex gap-2">
            {project.projectLink && (
              <Button asChild size="sm" className="rounded-lg">
                <a href={project.projectLink} target="_blank" rel="noopener">
                  Live <ArrowUpRight />
                </a>
              </Button>
            )}
            {project.codeLink && (
              <Button asChild size="sm" variant="outline" className="glass rounded-lg">
                <a href={project.codeLink} target="_blank" rel="noopener">
                  <CodeXml /> Source
                </a>
              </Button>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="sm" className="rounded-lg">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
