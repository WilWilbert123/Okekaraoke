'use client';

// ============================================================
// OKEKARAOKE — Super Admin Login
// URL: /admin/admin/admin/admin/admin/login
// Uses Supabase email + password authentication
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, KeyRound, Loader2, ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !data.session) {
        setError(authError?.message ?? 'Invalid credentials. Access denied.');
        return;
      }

      // Mark admin session
      localStorage.setItem('okekaraoke_admin_auth', 'true');
      localStorage.setItem('okekaraoke_admin_email', email.trim().toLowerCase());

      router.push('/admin/dashboard');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      <div
        className="relative w-full max-w-md p-8 rounded-3xl"
        style={{
          background: 'rgba(10, 10, 18, 0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(124,58,237,0.25))',
              border: '1px solid rgba(99,102,241,0.4)',
              boxShadow: '0 0 30px rgba(99,102,241,0.15)',
            }}
          >
            <ShieldCheck size={30} className="text-indigo-400" />
          </div>

          <h1
            className="text-2xl font-black text-white tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            OKEKARAOKE ADMIN
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium tracking-wide uppercase">
            Secure Admin Portal
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-6 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <Lock size={14} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Admin Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-white placeholder-slate-600 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-11 py-3.5 rounded-xl text-white placeholder-slate-600 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="admin-login-submit"
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 mt-2"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer hint */}
        <p className="text-[11px] text-slate-700 text-center mt-6">
          🔒 Restricted access — admin accounts only
        </p>
      </div>
    </div>
  );
}
