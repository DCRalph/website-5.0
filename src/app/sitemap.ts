import type { MetadataRoute } from "next";

// Import frontmatter from MDX files to build project URLs
import { frontmatter as WebsiteFrontmatter } from "../content/website.mdx";
import { frontmatter as BoxThingFrontmatter } from "../content/box thing.mdx";
import { frontmatter as BurgerfuelFrontmatter } from "../content/burgerfuel.mdx";
import { frontmatter as CardsAgainstHumanityFrontmatter } from "../content/cards against humanity.mdx";
import { frontmatter as DCRalphEnterpriseFrontmatter } from "../content/dcralph enterprise.mdx";
import { frontmatter as Esp32RemoteFrontmatter } from "../content/esp32_remote.mdx";
import { frontmatter as Esp32CarLedControllerFrontmatter } from "../content/esp32-car-led-controller.mdx";
import { frontmatter as Race360Frontmatter } from "../content/race360.mdx";

type Frontmatter = {
  title: string;
  publishedAt: string; // in d/m/yyyy
  updatedAt?: string;
};

const parseDate = (dateString: string): Date => {
  const parts = dateString.split("/") as [string, string, string];
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const projects: Frontmatter[] = [
    WebsiteFrontmatter as Frontmatter,
    BoxThingFrontmatter as Frontmatter,
    BurgerfuelFrontmatter as Frontmatter,
    CardsAgainstHumanityFrontmatter as Frontmatter,
    DCRalphEnterpriseFrontmatter as Frontmatter,
    Esp32RemoteFrontmatter as Frontmatter,
    Esp32CarLedControllerFrontmatter as Frontmatter,
    Race360Frontmatter as Frontmatter,
  ];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      priority: 1,
    },
    ...projects.map((proj) => {
      const params = new URLSearchParams();
      params.set("project", proj.title);
      const url = `${baseUrl}/?${params.toString()}`;

      const dt = parseDate(proj.updatedAt ?? proj.publishedAt);

      return {
        url,
        lastModified: isNaN(dt.getTime()) ? now : dt,
        priority: 0.8,
      };
    }),
  ];

  return entries;
}


