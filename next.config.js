// import { withContentlayer } from 'next-contentlayer'
const { withContentlayer } = require('next-contentlayer')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // experimental: {
  //   fontLoaders: [
  //     { loader: '@next/font/google', options: { subsets: ['latin'] } },
  //   ],
  // },
}

// export default withContentlayer(nextConfig)
module.exports = withContentlayer(nextConfig)

// export default nextConfig

// module.exports = nextConfig;
