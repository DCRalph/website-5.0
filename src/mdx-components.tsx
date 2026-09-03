// Next.js looks for this file to supply components to every compiled MDX module.
// Without it, Next falls back to @mdx-js/react, which breaks in server-only routes (sitemap).
export { useMDXComponents } from "~/components/utils/MDX";
