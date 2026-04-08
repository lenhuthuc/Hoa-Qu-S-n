/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3000";
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
