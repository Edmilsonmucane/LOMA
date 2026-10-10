import type { MetadataRoute } from 'next';
import { getSite } from '@/lib/portal/server';
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSite();
  return {
    id: '/',
    name: site?.name ?? 'LOMA',
    short_name: site?.name.slice(0, 20) ?? 'LOMA',
    description: site?.site.intro,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'pt-MZ',
    background_color: '#F6F5F2',
    theme_color: site?.accent ?? '#0E5A4A',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
