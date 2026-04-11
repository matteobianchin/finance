/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/domain/:path*",
        destination: `${process.env.DOMAIN_API_URL ?? "http://localhost:6901"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
