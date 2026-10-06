import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OfflineBanner } from '@/components/OfflineBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'OKEKARAOKE — Your Party. Your Songs. Your Screen.',
  description: 'TV-first karaoke system. Control from your phone. Sing from your screen.',
  keywords: ['karaoke', 'videoke', 'party', 'songs', 'sing', 'music'],
  authors: [{ name: 'OKEKARAOKE' }],
  applicationName: 'OKEKARAOKE',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-512.png',
    shortcut: '/icon-192.png',
    apple: '/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OKEKARAOKE',
  },
  openGraph: {
    title: 'OKEKARAOKE',
    description: 'TV-first karaoke system controlled from your phone.',
    type: 'website',
    images: [{ url: '/icon-512.png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#050508',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="shortcut icon" href="/icon-512.png" />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegister />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}

