import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      latestVersion: '1.1.4',
      versionCode: 7,
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.okekaraoke.app&hl=en',
      marketUrl: 'market://details?id=com.okekaraoke.app',
      releaseNotes: 'Smooth chat keyboard experience, smart TV remote navigation & performance improvements',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}

