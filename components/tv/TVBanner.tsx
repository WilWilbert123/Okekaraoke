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
    <div className="inline-flex items-center gap-4 px-12 shrink-0">
      {bannerImageUrl && (
        <img
          src={bannerImageUrl}
          alt="Banner AD"
          className="h-7 object-contain rounded shadow-sm shrink-0"
        />
      )}
      {bannerText && (
        <span className="text-xs font-bold text-slate-200 tracking-wide shrink-0">
          {bannerText}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="relative w-full overflow-hidden z-30 shrink-0 flex items-center"
      style={{
        height: bannerImageUrl ? '48px' : '36px',
        background: 'rgba(15, 15, 25, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
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
