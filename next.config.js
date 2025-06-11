// import { withContentlayer } from 'next-contentlayer'
const { withContentlayer } = require("next-contentlayer");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Improved performance and compatibility with Next.js 15
  swcMinify: true,
  // Ensure compatibility with modern bundling
  experimental: {
    // Enable newer optimizations
    optimizePackageImports: ["react-icons"],
  },
  // Configure webpack for better compatibility
  webpack: (config, { isServer }) => {
    // Ensure proper handling of contentlayer files
    config.infrastructureLogging = {
      level: "error",
    };
    return config;
  },
};

// export default withContentlayer(nextConfig)
module.exports = withContentlayer(nextConfig);
