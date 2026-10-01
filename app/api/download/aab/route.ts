import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const aabPath = path.join(process.cwd(), 'public', 'OKEKARAOKE.aab');
  if (fs.existsSync(aabPath)) {
    const fileBuffer = fs.readFileSync(aabPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="OKEKARAOKE.aab"',
      },
    });
  }
  return new NextResponse('AAB file not found.', { status: 404 });
}
