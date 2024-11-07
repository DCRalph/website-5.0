import { allProjectMDXes } from "contentlayer/generated";

import { NextApiRequest, NextApiResponse } from "next";

export async function getServerSideProps({
  req,
  res,
}: {
  req: NextApiRequest;
  res: NextApiResponse;
}) {
  // Get the protocol and host from the request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // Set the content type to text/xml
  res.setHeader("Content-Type", "text/xml");

  const now = new Date()
  now.setHours(0)
  now.setMinutes(0)
  now.setSeconds(0)
  now.setMilliseconds(0)

  const nowS = now.toISOString()

  // Generate dynamic URL entries from projects
  const projectUrls = allProjectMDXes
    .map((project) => {
      // Adjust the path based on your routing setup

      const pageUrlPrams = new URLSearchParams();
      pageUrlPrams.set("project", project.title);

      const url = `${baseUrl}?${pageUrlPrams.toString()}`;

      // Manually parse the date string
      const dateParts = project.publishedAt.split("/");
      const month = parseInt(dateParts[0], 10);
      const day = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);

      // Create a Date object
      const date = new Date(year, month - 1, day);

      let lastMod = null;
      if (isNaN(date.getTime())) {
        console.error("Invalid date in project:", project);
        // Handle invalid date, e.g., set a default date or skip this project
        lastMod = new Date().toISOString(); // Default to current date
      } else {
        lastMod = date.toISOString();
      }

      // console.log("lastMod:", lastMod);

      return `
    <url>
      <loc>${url}</loc>
      <lastmod>${lastMod}</lastmod>
      <priority>0.8</priority>
    </url>`;
    })
    .join("");

  // Generate the sitemap content
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Homepage -->
    <url>
      <loc>${baseUrl}/</loc>
      <lastmod>${nowS}</lastmod>
      <priority>1.0</priority>
    </url>
    <!-- Project URLs -->
    ${projectUrls}
  </urlset>`;

  // Send the sitemap content
  res.write(sitemapXml.trim());
  res.end();

  // Return empty props to prevent Next.js errors
  return {
    props: {},
  };
}

// Default export to prevent Next.js errors
export default function Sitemap() {
  return null;
}
