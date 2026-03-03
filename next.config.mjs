/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Evita que webpack intente empaquetar módulos de Node.js (ws, net, tls)
  // que @supabase/supabase-js incluye para el realtime en el servidor.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
    }
    return config
  },
};

export default nextConfig;
