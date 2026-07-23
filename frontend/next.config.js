/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
// En dev el frontend usa rutas relativas (/api/v1/...) que Next reenvía via
// rewrite al backend (server-side). Así el navegador NO hace llamadas cross-origin
// directas a :8000 (evita el "Load failed" por CORS de Safari).
// En prod se usa la URL real del backend (Render).
const apiBase = isDev ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000')
const rewriteTarget = isDev ? 'http://127.0.0.1:8000' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000')

const nextConfig = {
  output: 'standalone',
  // Permitir que el navegador abra en 127.0.0.1 y los assets/_next se sirvan
  // sin bloqueo CORS de Safari (error "Load failed" al cargar la página).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
        destination: `${rewriteTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
