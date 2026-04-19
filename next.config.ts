import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
