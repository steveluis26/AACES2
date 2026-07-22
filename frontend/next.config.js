/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
const apiBase = isDev ? 'http://127.0.0.1:8000' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000')

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'trae-api-us.mchost.guru' },
      { protocol: 'https', hostname: 'html.tailus.io' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'randomuser.me' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: apiBase,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'AACES',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
