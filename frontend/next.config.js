/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
const apiBase = isDev ? (process.env.DEV_API_URL || 'http://localhost:8000') : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')

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
  // pdfjs-dist pide 'canvas' (solo para Node); en el navegador no se usa
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
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
