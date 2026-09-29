'use client';

// ============================================================
// OKEKARAOKE — Admin Route Guard & Redirection
// ============================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const isAuth = localStorage.getItem('okekaraoke_admin_auth');
    if (isAuth) {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/admin/login');
    }
  }, [router]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 font-medium text-xs">REDIRECTING TO ADMIN PORTAL...</p>
    </div>
  );
}
