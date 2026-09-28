import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OKEKARAOKE',
    short_name: 'OKEKARAOKE',
    description: 'TV-first karaoke system. Control from your phone.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050508',
    theme_color: '#050508',
    orientation: 'any',
    categories: ['entertainment', 'music'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: 'Create Room',
        url: '/create',
        description: 'Start a new OKEKARAOKE room',
      },
      {
        name: 'Join Room',
        url: '/join',
        description: 'Join an existing room',
      },
    ],
  };
}
