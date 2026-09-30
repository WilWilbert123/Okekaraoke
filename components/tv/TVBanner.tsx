'use client';

// ============================================================
// OKEKARAOKE — TV Announcement Ticker Banner Component
// Renders running text ticker or advertisement banner
// ============================================================

interface TVBannerProps {
  bannerEnabled: boolean;
  bannerText: string;
  bannerImageUrl?: string;
  bannerSpeed?: number;
}

export function TVBanner({ bannerEnabled, bannerText, bannerImageUrl, bannerSpeed = 20 }: TVBannerProps) {
  if (!bannerEnabled) return null;

  const content = (
    <div className="inline-flex items-center gap-4 px-24 md:px-36 shrink-0">
      {bannerImageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={bannerImageUrl}
          alt="Banner AD"
          className="h-9 md:h-10 object-contain rounded-lg shadow-md shrink-0 bg-white/10 p-0.5"
        />
      )}
      {bannerText && (
        <span className="text-sm font-extrabold text-white tracking-wider shrink-0" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {bannerText}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="relative w-full overflow-hidden z-30 shrink-0 flex items-center bg-zinc-950/90 border-b border-zinc-800"
      style={{
        height: bannerImageUrl ? '56px' : '38px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Running Ticker Content */}
      <div className="flex-1 overflow-hidden relative flex items-center">
        <div
          className="whitespace-nowrap inline-flex items-center"
          style={{
            animation: `marquee ${bannerSpeed}s linear infinite`,
          }}
        >
          {content}
          {content}
          {content}
          {content}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
