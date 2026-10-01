'use client';

// ============================================================
// OKEKARAOKE — TV Announcement & Advertisement Banner Component
// Renders running text ticker, side ad card, bottom bar, or interstitial popup
// Supports multi-image ads and real-time live updates
// ============================================================

import { useState, useEffect } from 'react';
import { Megaphone, X, Sparkles } from 'lucide-react';

export interface TVBannerProps {
  bannerEnabled: boolean;
  bannerType?: 'ticker' | 'side_card' | 'bottom_bar' | 'popup';
  bannerText: string;
  bannerImageUrl?: string;
  bannerImages?: string[];
  bannerSpeed?: number;
}

export function TVBanner({
  bannerEnabled,
  bannerType = 'ticker',
  bannerText,
  bannerImageUrl,
  bannerImages,
  bannerSpeed = 20,
}: TVBannerProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [dismissedPopup, setDismissedPopup] = useState(false);

  // Combine images array or fallback to single bannerImageUrl
  const imagesList = (bannerImages && bannerImages.length > 0)
    ? bannerImages.filter(img => Boolean(img?.trim()))
    : (bannerImageUrl?.trim() ? [bannerImageUrl.trim()] : []);

  // Reset popup dismissal if banner settings or text change
  useEffect(() => {
    setDismissedPopup(false);
  }, [bannerText, bannerImageUrl, bannerImages, bannerType, bannerEnabled]);

  // Slideshow timer for multi-images in side_card and popup
  useEffect(() => {
    if (imagesList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % imagesList.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [imagesList.length]);

  if (!bannerEnabled) return null;

  const currentImage = imagesList[activeImageIndex] || imagesList[0];

  // ============================================================
  // TYPE 1: Top Running Ticker (Header Bar Marquee)
  // ============================================================
  if (bannerType === 'ticker') {
    const content = (
      <div className="inline-flex items-center gap-3 sm:gap-6 px-6 sm:px-24 md:px-36 shrink-0">
        {imagesList.map((img, idx) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={idx}
            src={img}
            alt={`Ad Banner ${idx + 1}`}
            className="h-4 sm:h-7 md:h-10 object-contain rounded shadow-md shrink-0 bg-white/10 p-0.5"
          />
        ))}
        {bannerText && (
          <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-white tracking-wider shrink-0" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {bannerText}
          </span>
        )}
      </div>
    );

    return (
      <div
        className={`relative w-full overflow-hidden z-30 shrink-0 flex items-center bg-zinc-950/90 border-b border-zinc-800 transition-all ${
          imagesList.length > 0 ? 'h-7 sm:h-11 md:h-14' : 'h-6 sm:h-8 md:h-9.5'
        }`}
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
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

  // ============================================================
  // TYPE 2: Bottom Edge Marquee Ticker Bar
  // ============================================================
  if (bannerType === 'bottom_bar') {
    const content = (
      <div className="inline-flex items-center gap-3 sm:gap-6 px-6 sm:px-24 md:px-36 shrink-0">
        {imagesList.map((img, idx) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={idx}
            src={img}
            alt={`Ad Banner ${idx + 1}`}
            className="h-4 sm:h-6 md:h-8 object-contain rounded shadow-md shrink-0 bg-white/10 p-0.5"
          />
        ))}
        {bannerText && (
          <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-amber-300 tracking-wider shrink-0" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {bannerText}
          </span>
        )}
      </div>
    );

    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-30 overflow-hidden flex items-center bg-zinc-950/95 border-t border-amber-500/40 shadow-2xl py-1"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
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

  // ============================================================
  // TYPE 3: Floating Side Ad Box (Top Right Card below header)
  // ============================================================
  if (bannerType === 'side_card') {
    return (
      <div className="fixed top-14 sm:top-16 right-4 sm:right-6 z-30 max-w-[240px] sm:max-w-[280px] p-2.5 sm:p-3 rounded-2xl bg-zinc-950/90 border border-indigo-500/40 backdrop-blur-xl shadow-2xl text-white animate-fade-in pointer-events-auto">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 uppercase tracking-wider">
            <Megaphone size={13} className="text-indigo-400 animate-pulse" />
            <span>SPECIAL PROMO</span>
          </div>
          {imagesList.length > 1 && (
            <div className="flex items-center gap-1">
              {imagesList.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeImageIndex ? 'bg-indigo-400 w-3' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>

        {currentImage && (
          <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden mb-2 bg-black/50 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage}
              alt="Advertisement"
              className="w-full h-full object-cover transition-all duration-700 hover:scale-105"
            />
          </div>
        )}

        {bannerText && (
          <p className="text-[11px] sm:text-xs font-bold text-zinc-100 line-clamp-3 leading-relaxed">
            {bannerText}
          </p>
        )}
      </div>
    );
  }

  // ============================================================
  // TYPE 4: Center Floating Interstitial Card (Popup Ad Modal)
  // ============================================================
  if (bannerType === 'popup') {
    if (dismissedPopup) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in pointer-events-auto">
        <div className="relative w-full max-w-sm sm:max-w-md p-5 rounded-3xl bg-zinc-950/95 border border-indigo-500/50 backdrop-blur-2xl shadow-2xl text-white flex flex-col items-center text-center">
          <button
            onClick={() => setDismissedPopup(true)}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all active:scale-95"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 mb-3 shadow-lg">
            <Sparkles size={20} />
          </div>

          <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">ANNOUNCEMENT</p>

          {currentImage && (
            <div className="relative w-full h-36 sm:h-44 rounded-2xl overflow-hidden my-3 bg-black/60 border border-white/10 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage}
                alt="Ad Banner"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {bannerText && (
            <p className="text-xs sm:text-sm font-extrabold text-white leading-snug my-2">
              {bannerText}
            </p>
          )}

          {imagesList.length > 1 && (
            <div className="flex items-center gap-1.5 mt-2">
              {imagesList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === activeImageIndex ? 'bg-indigo-400 w-4' : 'bg-white/30 w-1.5'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
