import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads go through a server action; let a file over the 10 MB limit reach check 1 rather than fail in transit.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
