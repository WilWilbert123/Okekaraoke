// ============================================================
// OKEKARAOKE — POST /api/admin/login
// Validates admin password and returns auth cookie/token
// ============================================================

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    // Secret password from environment variable, default to 'admin'
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (!password || String(password).trim() !== expectedPassword.trim()) {
      return apiError('INVALID_CREDENTIALS', 'Incorrect password. Access denied.', 401);
    }

    const response = apiSuccess({ authenticated: true });

    // Set secure HTTP-only admin session cookie
    response.cookies.set('okekaraoke_admin_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Error in /api/admin/login:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
