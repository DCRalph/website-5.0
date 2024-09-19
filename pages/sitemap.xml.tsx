import { allProjectMDXes } from 'contentlayer/generated';

import { NextApiRequest, NextApiResponse } from 'next';

export async function getServerSideProps({ req, res }: { req: NextApiRequest, res: NextApiResponse }) {
  // Get the protocol and host from the request
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // Set the content type to text/xml
  res.setHeader('Content-Type', 'text/xml');

  // Generate dynamic URL entries from projects
  const projectUrls = allProjectMDXes
    .map((project) => {
      // Adjust the path based on your routing setup

      const pageUrlPrams = new URLSearchParams();
      pageUrlPrams.set('project', project.title);

      const url = `${baseUrl}?${pageUrlPrams.toString()}`;
      const lastMod = new Date(project.publishedAt)

      return `
    <url>
      <loc>${url}</loc>
      <lastmod>${lastMod}</lastmod>
      <priority>0.8</priority>
    </url>`;
    })
    .join('');

  // Generate the sitemap content
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Homepage -->
    <url>
      <loc>${baseUrl}/</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
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
