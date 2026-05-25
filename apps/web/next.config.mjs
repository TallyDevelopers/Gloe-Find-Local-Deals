/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile our shared workspace packages (they ship raw TS)
  transpilePackages: ['@gloe/api-client', '@gloe/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Supabase Storage public URLs (project ref varies per env).
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
