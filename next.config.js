import createMDX from '@next/mdx'

/** @type {import("next").NextConfig} */
const config = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // Lets `next dev` accept HMR/asset requests from this LAN hostname
  allowedDevOrigins: ['spicy-dev'],
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

// Turbopack requires MDX plugins as serializable strings, not imported functions.
const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      'remark-frontmatter',
      ['remark-mdx-frontmatter', { name: 'frontmatter' }],
    ],
    rehypePlugins: [
      ['rehype-pretty-code', { theme: 'github-dark', keepBackground: false }],
    ],
  },
})

export default withMDX(config);
