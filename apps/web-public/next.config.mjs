/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Single-service deployment (scripts/single-server.mjs) serves this app's assets under /_cards.
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  async headers() {
    return [
      {
        source: '/c/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/public/c/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
