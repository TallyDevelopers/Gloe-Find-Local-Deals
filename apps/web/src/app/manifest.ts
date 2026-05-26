import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gloē',
    short_name: 'Gloē',
    description: 'Beauty + wellness, beautifully booked.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF5F2',
    theme_color: '#C89A8C',
    icons: [
      { src: '/brand/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
