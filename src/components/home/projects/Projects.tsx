"use client";

import { useSearchParams } from "next/navigation"; // Import useSearchParams for query params
import { SectionHeader } from "~/components/utils/SectionHeader";
import { Project } from "./Project";
import type { ProjectDoc } from "./Project";
import type React from "react";

// Import MDX documents directly. Keep this list in sync with files in `src/content`.
import Website, { frontmatter as WebsiteFrontmatter } from "../../../content/website.mdx";
import BoxThing, { frontmatter as BoxThingFrontmatter } from "../../../content/box thing.mdx";
import Burgerfuel, { frontmatter as BurgerfuelFrontmatter } from "../../../content/burgerfuel.mdx";
import CardsAgainstHumanity, { frontmatter as CardsAgainstHumanityFrontmatter } from "../../../content/cards against humanity.mdx";
import DCRalphEnterprise, { frontmatter as DCRalphEnterpriseFrontmatter } from "../../../content/dcralph enterprise.mdx";
import Esp32Remote, { frontmatter as Esp32RemoteFrontmatter } from "../../../content/esp32_remote.mdx";
import Esp32CarLedController, { frontmatter as Esp32CarLedControllerFrontmatter } from "../../../content/esp32-car-led-controller.mdx";
import Race360, { frontmatter as Race360Frontmatter } from "../../../content/race360.mdx";

// Helper to build a `ProjectDoc` from MDX component + frontmatter

type Frontmatter = {
  title: string;
  publishedAt: string;
  updatedAt?: string;
  coverImage: string;
  projectLink?: string;
  codeLink?: string;
  description: string;
  tech?: string;
}

const toProjectDoc = (
  Component: React.ComponentType,
  fm: Frontmatter
): ProjectDoc => {
  let techArr: string[] = []
  if (fm.tech) {
    techArr = String(fm.tech)
      .replaceAll("\\\\", "[BACKSLASH]")
      .split("\\")
      .map((s: string) => s.trim().replaceAll("[BACKSLASH]", "\\"));
  }

  // console.log(fm)

  return {
    title: fm.title,
    publishedAt: fm.publishedAt,
    updatedAt: fm.updatedAt,
    coverImage: fm.coverImage,
    projectLink: fm.projectLink,
    codeLink: fm.codeLink,
    description: fm.description,
    tech: fm.tech ?? "",
    techArr,
    Component,
  };

};

const parseDate = (dateString: string): Date => {
  const parts = dateString.split("/") as [string, string, string];

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  const date = new Date(year, month, day);

  return date;
};

export const Projects = () => {
  const params = useSearchParams();
  const projectQueryParam = params ? params.get("project") : null;

  const projects = [
    toProjectDoc(Website, WebsiteFrontmatter as Frontmatter),
    toProjectDoc(BoxThing, BoxThingFrontmatter as Frontmatter),
    toProjectDoc(Burgerfuel, BurgerfuelFrontmatter as Frontmatter),
    toProjectDoc(CardsAgainstHumanity, CardsAgainstHumanityFrontmatter as Frontmatter),
    toProjectDoc(DCRalphEnterprise, DCRalphEnterpriseFrontmatter as Frontmatter),
    toProjectDoc(Esp32Remote, Esp32RemoteFrontmatter as Frontmatter),
    toProjectDoc(Esp32CarLedController, Esp32CarLedControllerFrontmatter as Frontmatter),
    toProjectDoc(Race360, Race360Frontmatter as Frontmatter),
  ]

  return (
    <section className="section-wrapper" id="projects">
      <SectionHeader title="Projects" dir="r" />

      <div className={"grid grid-cols-1 gap-8 lg:grid-cols-2"}>
        {
          projects.sort((a: ProjectDoc, b: ProjectDoc) => {
            if (
              parseDate(a.publishedAt).getTime() >
              parseDate(b.publishedAt).getTime()
            ) {
              return -1;
            }
            return 1;
          })
            .map((project: ProjectDoc) => {
              const shouldOpen = projectQueryParam === project.title;
              return (
                <Project
                  key={project.title}
                  project={project}
                  shouldOpen={shouldOpen}
                />
              );
            })}
      </div>
    </section>
  );
};
