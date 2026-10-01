import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const apkPath = path.join(process.cwd(), 'public', 'OKEKARAOKE.apk');

  if (fs.existsSync(apkPath)) {
    const fileBuffer = fs.readFileSync(apkPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="OKEKARAOKE.apk"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  }

  return new NextResponse('APK file not found.', { status: 404 });
}
