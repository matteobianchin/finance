import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/openbb/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6900"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
