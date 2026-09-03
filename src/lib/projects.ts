import type { ComponentType } from "react";

// MDX writeups are imported directly. Keep this list in sync with `src/content`.
import Website, { frontmatter as website } from "../content/website.mdx";
import BoxThing, { frontmatter as boxThing } from "../content/box thing.mdx";
import Burgerfuel, { frontmatter as burgerfuel } from "../content/burgerfuel.mdx";
import CardsAgainstHumanity, { frontmatter as cardsAgainstHumanity } from "../content/cards against humanity.mdx";
import DCRalphEnterprise, { frontmatter as dcralphEnterprise } from "../content/dcralph enterprise.mdx";
import Esp32Remote, { frontmatter as esp32Remote } from "../content/esp32_remote.mdx";
import Esp32CarLedController, { frontmatter as esp32CarLedController } from "../content/esp32-car-led-controller.mdx";
import Race360, { frontmatter as race360 } from "../content/race360.mdx";

type Frontmatter = {
  title: string;
  publishedAt: string; // d/m/yyyy
  updatedAt?: string;
  coverImage: string;
  projectLink?: string;
  codeLink?: string;
  description: string;
  tech?: string; // backslash or comma separated, e.g. "Swift\ iOS\ Node.js"
};

export type Project = Omit<Frontmatter, "tech"> & {
  year: string;
  tech: string[];
  Component: ComponentType;
};

const parseDate = (dmy: string) => {
  const [d = "1", m = "1", y = "1970"] = dmy.split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const toProject = (Component: ComponentType, fm: Frontmatter): Project => ({
  ...fm,
  year: fm.publishedAt.split("/").at(-1) ?? "",
  tech: (fm.tech ?? "")
    .split(/[\\,]/)
    .map((s) => s.trim())
    .filter(Boolean),
  Component,
});

// Newest first.
export const projects: Project[] = [
  toProject(Website, website as Frontmatter),
  toProject(BoxThing, boxThing as Frontmatter),
  toProject(Burgerfuel, burgerfuel as Frontmatter),
  toProject(CardsAgainstHumanity, cardsAgainstHumanity as Frontmatter),
  toProject(DCRalphEnterprise, dcralphEnterprise as Frontmatter),
  toProject(Esp32Remote, esp32Remote as Frontmatter),
  toProject(Esp32CarLedController, esp32CarLedController as Frontmatter),
  toProject(Race360, race360 as Frontmatter),
].sort((a, b) => parseDate(b.publishedAt).getTime() - parseDate(a.publishedAt).getTime());
