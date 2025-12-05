import createMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

/** @type {import("next").NextConfig} */
const config = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "**",
      },
    ],
  },
  rewrites: async () => {
    return [
      {
        source: "/fuckoffaddblockers/:match*",
        destination: "https://https://williamgiles.co.nz/_vercel/insights/:match*",
      },
      {
        source: "/fuckoffaddblocker/script.js",
        destination: "https://https://williamgiles.co.nz/_vercel/insights/script.js",
      },
    ];
  },
};

const rehype = {
  theme: 'github-dark',
  keepBackground: false,
  /** @param {import('hast').Element} node */
  onVisitLine(node) {
    if (node.children.length === 0) {
      node.children = [
        {
          type: 'text',
          value: ' ',
        },
      ]
    }
  },
}

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      //     remarkGfm,
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: 'frontmatter' }],
    ],
    // Cast to any to avoid vfile/unified type mismatch warnings in tooling
    rehypePlugins: ([
      [
        /** @type {any} */ (rehypePrettyCode),
        rehype,
      ],
    ]),
  },
})

export default withMDX(config);
