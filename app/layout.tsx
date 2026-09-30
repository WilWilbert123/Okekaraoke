import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OKEKARAOKE — Your Party. Your Songs. Your Screen.',
  description: 'TV-first karaoke system. Control from your phone. Sing from your screen.',
  keywords: ['karaoke', 'videoke', 'party', 'songs', 'sing', 'music'],
  authors: [{ name: 'OKEKARAOKE' }],
  applicationName: 'OKEKARAOKE',
  manifest: '/manifest.json',
  icons: {
    icon: '/okekaraokelogo.png',
    shortcut: '/okekaraokelogo.png',
    apple: '/okekaraokelogo.png',
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
    images: [{ url: '/okekaraokelogo.png' }],
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
        <link rel="apple-touch-icon" href="/okekaraokelogo.png" />
        <link rel="icon" type="image/png" href="/okekaraokelogo.png" />
        <link rel="shortcut icon" href="/okekaraokelogo.png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
