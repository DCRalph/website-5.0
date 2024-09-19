import { GetServerSideProps } from 'next';
import { NextApiResponse } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ res, req }) => {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // Set the content type to text/plain
  res.setHeader('Content-Type', 'text/plain');

  // Define the robots.txt content
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

  // Send the robots.txt content
  res.write(robotsTxt);
  res.end();

  // Return empty props to prevent Next.js errors
  return {
    props: {},
  };
}

// Default export to prevent Next.js errors
export default function Robots() {
  return null;
}