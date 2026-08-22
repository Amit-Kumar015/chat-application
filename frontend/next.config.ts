import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: process.env.NEXT_PRIVATE_STANDALONE ? "standalone" : undefined,
};

export default nextConfig;
