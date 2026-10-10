import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/app/',
        '/customer',
        '/request',
        '/login',
        '/auth/',
        '/platform',
        '/api/',
      ],
    },
  };
}
