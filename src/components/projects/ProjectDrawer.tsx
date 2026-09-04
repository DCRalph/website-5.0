"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, CodeXml } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerTitle } from "~/components/ui/drawer";
import type { Project } from "~/lib/projects";

type Props = { project: Project; onClose: () => void };

/** Blur radius per layer and the band (in % of cover height) where that layer fades in. */
const coverBlurs = [
  { blur: 2, from: 45, to: 62 },
  { blur: 4, from: 52, to: 70 },
  { blur: 8, from: 60, to: 78 },
  { blur: 16, from: 68, to: 88 },
  { blur: 32, from: 78, to: 100 },
];

/**
 * Project writeup in a bottom drawer. Cover strip on top with the title on
 * its blur fade, MDX body scrolls, links pinned in the footer. Mounting with
 * `open` true makes vaul play the slide-up; closing flips the state so it
 * slides down, and `onClose` fires once that animation has finished.
 */
export function ProjectDrawer({ project, onClose }: Props) {
  const [open, setOpen] = useState(true);
  const cover = project.coverImage;

  return (
    <Drawer open={open} onOpenChange={setOpen} onAnimationEnd={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="mx-auto max-w-3xl overflow-hidden rounded-t-2xl border-white/10 bg-[#0a0a0a] data-[vaul-drawer-direction=bottom]:max-h-[92vh]">
        <div className="relative h-44 shrink-0 overflow-hidden bg-black md:h-52">
          {/* Drag handle sits on the cover so the image runs to the drawer's top edge. */}
          <div className="absolute top-3 left-1/2 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
          {cover && (
            <>
              <Image src={cover} alt="" fill sizes="768px" className="object-cover" priority />
              {/* Progressive blur built from blurred copies of the cover, each masked to a band so the
                  blur ramps up towards the title. Chromium drops mask-image on backdrop-filter layers
                  inside the vaul drawer, so this stays on plain filters, which also render the same in
                  Firefox and Safari. Copies are scaled up slightly to hide the blur's transparent edge. */}
              {coverBlurs.map(({ blur, from, to }) => (
                <Image
                  key={blur}
                  src={cover}
                  alt=""
                  fill
                  sizes="768px"
                  aria-hidden
                  className="scale-110 object-cover"
                  style={{
                    filter: `blur(${blur}px)`,
                    maskImage: `linear-gradient(to bottom, transparent ${from}%, #000 ${to}%)`,
                    WebkitMaskImage: `linear-gradient(to bottom, transparent ${from}%, #000 ${to}%)`,
                  }}
                />
              ))}
            </>
          )}
          {/* Darkening that ramps with the blur, plus a hairline on the band's bottom edge. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_45%,rgba(10,10,10,0.2)_62%,rgba(10,10,10,0.45)_80%,rgba(10,10,10,0.7))]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
          <div className="absolute inset-x-6 bottom-4 z-10 flex items-baseline justify-between gap-4">
            <DrawerTitle className="text-3xl font-semibold tracking-tight">{project.title}</DrawerTitle>
            <span className="font-mono text-xs text-dim">
              {project.publishedAt}
              {project.updatedAt && project.updatedAt !== project.publishedAt && ` · updated ${project.updatedAt}`}
            </span>
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
