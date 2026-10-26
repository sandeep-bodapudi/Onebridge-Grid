/**
 * Hosted prototype (D-DEMO-HOSTING): when API_PROXY_TARGET is set, the admin
 * app proxies /svc/<service>/* to the single demo API service, so the browser
 * only ever talks to this origin and the httpOnly refresh cookie stays
 * first-party. Locally (pnpm dev) the app calls the services on :4001-4003.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    const base = target.replace(/\/+$/, '');
    return ['identity', 'organization', 'cards', 'profiles'].map((service) => ({
      source: `/svc/${service}/:path*`,
      destination: `${base}/${service}/:path*`,
    }));
  },
};

export default nextConfig;
