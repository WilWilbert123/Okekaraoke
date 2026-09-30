// ============================================================
// OKEKARAOKE — Location Utilities
// Resolves client IP, City, and Country automatically
// ============================================================

import { NextRequest } from 'next/server';

export interface LocationInfo {
  ip: string;
  city: string;
  country: string;
}

export function extractLocationFromRequest(request: NextRequest): LocationInfo {
  // Extract client IP from proxy/CDN headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');

  let ip = '127.0.0.1';
  if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  } else if (cfIp) {
    ip = cfIp.trim();
  }

  // Extract location from CDN headers if available (Cloudflare / Vercel / Netlify)
  const cfCountry = request.headers.get('cf-ipcountry');
  const vercelCountry = request.headers.get('x-vercel-ip-country');
  const vercelCity = request.headers.get('x-vercel-ip-city');

  let country = 'Philippines';
  let city = 'Local Area';

  if (cfCountry && cfCountry !== 'XX') {
    country = cfCountry;
  } else if (vercelCountry) {
    country = vercelCountry;
  }

  if (vercelCity) {
    city = decodeURIComponent(vercelCity);
  }

  // If IP is local, label cleanly
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    city = 'Local Network';
    country = 'Philippines';
  }

  return { ip, city, country };
}
