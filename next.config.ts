import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export is only needed for S3/CloudFront deployment.
  // During local dev (npm run dev) we skip it so that Route Handlers
  // (e.g. /api/games) work natively instead of proxying to Lambda.
  ...(process.env.NEXT_EXPORT === "1" ? { output: "export" } : {}),
  // next/image can't use server-side optimization in a static export.
  images: { unoptimized: true },
};

export default nextConfig;
