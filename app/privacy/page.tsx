import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, Mic, Globe, Cpu } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | OKEKARAOKE',
  description: 'Privacy Policy and Data Safety information for OKEKARAOKE Mobile & TV App.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-8 md:p-12 selection:bg-teal-500 selection:text-black">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to OKEKARAOKE
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <ShieldCheck size={16} className="text-teal-400" />
            <span>Effective Date: October 2026</span>
          </div>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-400/10 border border-teal-500/20 text-teal-400 text-xs font-bold">
            <Lock size={12} />
            <span>Data Protection & Privacy Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            OKEKARAOKE Privacy Policy
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This Privacy Policy describes how OKEKARAOKE (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and safeguards information when you use our web application, mobile remote app, and TV player located at{' '}
            <a href="https://www.okekaraoke.sbs" className="text-teal-400 underline">
              https://www.okekaraoke.sbs
            </a>.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <Mic className="text-teal-400" size={20} />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Audio & Mic</h2>
            <p className="text-xs text-zinc-400">Microphone permission is strictly used for real-time karaoke shoutouts and voice controls.</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <Globe className="text-teal-400" size={20} />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">No Password Required</h2>
            <p className="text-xs text-zinc-400">We use room code sessions. No mandatory personal sign-up or phone number tracking.</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <Cpu className="text-teal-400" size={20} />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Live Sync</h2>
            <p className="text-xs text-zinc-400">Song queue selections are synchronized instantly across TV display and mobile controllers.</p>
          </div>
        </div>

        {/* Policy Content Sections */}
        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed border-t border-zinc-800/80 pt-6">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
            <p className="text-zinc-400">
              When you create or join a karaoke room, OKEKARAOKE processes basic session information necessary to operate real-time song queues:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong>Session Identifiers:</strong> Randomly generated guest IDs and room codes (e.g. 6-digit room PINs).</li>
              <li><strong>Song Queue Selections:</strong> Titles, artists, and YouTube video IDs of requested songs.</li>
              <li><strong>Optional Nicknames:</strong> Display names chosen when reserving songs in a room.</li>
              <li><strong>Temporary Voice Audio:</strong> Short live audio broadcasts when using optional karaoke shoutout features.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">2. Device Permissions Required</h2>
            <p className="text-zinc-400">
              The OKEKARAOKE Android APK and Web App request the following device permissions solely for core functionality:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
              <li><strong>Internet & Network State:</strong> Needed to connect mobile remotes to TV player rooms over WebSockets.</li>
              <li><strong>Audio Settings & Record Audio:</strong> Used only when activating the microphone button for karaoke shoutouts. Audio streams are broadcast live to the room and are not stored permanently.</li>
              <li><strong>Keep Screen Awake (Wake Lock):</strong> Prevents your TV or phone screen from turning off during active karaoke playback.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">3. Third-Party Services</h2>
            <p className="text-zinc-400">
              OKEKARAOKE integrates with YouTube for video stream playback. Video playback operates in compliance with YouTube API Terms of Service. No personal Google user data is accessed or harvested by OKEKARAOKE.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">4. Data Retention & Security</h2>
            <p className="text-zinc-400">
              Room sessions, queues, and guest connections are automatically cleared when a karaoke room expires or is reset by the room host. We do not sell or rent user data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">5. Children&apos;s Privacy</h2>
            <p className="text-zinc-400">
              OKEKARAOKE does not knowingly collect personal identifiable information from children under the age of 13.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">6. Contact Us</h2>
            <p className="text-zinc-400">
              If you have any questions or feedback regarding this Privacy Policy or app security, contact us at:
            </p>
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-teal-400">
              Email: support@okekaraoke.sbs<br />
              Website: https://www.okekaraoke.sbs
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/80 pt-6 text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} OKEKARAOKE. All rights reserved.
        </div>
      </div>
    </div>
  );
}
