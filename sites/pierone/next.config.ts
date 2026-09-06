import path from "node:path";

import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
  outputFileTracingRoot: root,
};

export default nextConfig;
