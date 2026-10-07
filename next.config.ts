import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./prisma/dev.db"],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;