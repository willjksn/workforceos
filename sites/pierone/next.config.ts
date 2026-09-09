import path from "node:path";

import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
  outputFileTracingRoot: root,
  async redirects() {
    return [
      {
        source: "/workforce-development",
        destination: "/services/workforce-pipeline-assessment",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
