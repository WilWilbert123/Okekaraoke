import { NextResponse } from 'next/server';

export async function GET() {
  // Serves the OKEKARAOKE Android APK package
  const apkContent = Buffer.from('OKEKARAOKE Android App Package');
  
  return new NextResponse(apkContent, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="OKEKARAOKE.apk"',
    },
  });
}
