// import { withContentlayer } from 'next-contentlayer'
const { withContentlayer } = require('next-contentlayer')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// export default withContentlayer(nextConfig)
module.exports = withContentlayer(nextConfig)

