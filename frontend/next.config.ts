import type { NextConfig } from 'next';

// Rewrites are evaluated at build time: API_ORIGIN is frozen into the build output (rebuild after changing it).
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:40000';
if (!/^https?:\/\/[^/]+$/.test(apiOrigin)) {
  throw new Error(`API_ORIGIN không hợp lệ: "${apiOrigin}" (ví dụ: http://127.0.0.1:40000)`);
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // E2E builds into its own folder so a running `next dev` (.next/dev) is never touched.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Self-contained server bundle for the Docker image (frontend/Dockerfile). No effect on `next dev`.
  output: 'standalone',
  // The dev-mode "N" badge sits on top of the exam question navigator (bottom-left).
  devIndicators: false,
  // Same-origin API: the browser calls /api/v1/* on the web origin, so httpOnly cookies just work (no CORS).
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
