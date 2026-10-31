import type { MetadataRoute } from 'next';

// Web app manifest: the BandUp window (Edge --app / installed app) shows the logo and name.
// Icons are generated from app/icon.svg by `npm run icons`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BandUp',
    short_name: 'BandUp',
    description: 'Luyện thi IELTS',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f6f8', // check-tokens: allow (= --background, light)
    theme_color: '#1F5E4B', // check-tokens: allow (logo fill, app/icon.svg)
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
