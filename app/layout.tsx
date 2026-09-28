import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OKEKARAOKE — Your Party. Your Songs. Your Screen.',
  description: 'TV-first karaoke system. Control from your phone. Sing from your screen.',
  keywords: ['karaoke', 'videoke', 'party', 'songs', 'sing', 'music'],
  authors: [{ name: 'OKEKARAOKE' }],
  applicationName: 'OKEKARAOKE',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OKEKARAOKE',
  },
  openGraph: {
    title: 'OKEKARAOKE',
    description: 'TV-first karaoke system controlled from your phone.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#050508',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
