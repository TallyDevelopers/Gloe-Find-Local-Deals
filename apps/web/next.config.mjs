/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repo lives on an iCloud-synced Desktop. iCloud races the dev
  // server's writes to .next (conflict copies like "page 2.js", transient
  // ENOENT → 500s). Folders named *.nosync are excluded from iCloud sync,
  // so dev builds go there; production (Railway/CI) keeps the default .next.
  distDir: process.env.NODE_ENV === 'development' ? '.next.nosync' : '.next',
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
