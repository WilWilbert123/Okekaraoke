'use client';

// ============================================================
// OKEKARAOKE — TV Announcement & Advertisement Banner Component
// Renders running text ticker, side ad card, bottom bar, or interstitial popup
// Supports multi-image ads and real-time live updates
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { Megaphone, X, Sparkles } from 'lucide-react';
import { DEFAULT_BANNER_PRESET_TEXTS } from '@/lib/constants/bannerPresets';

export interface TVBannerProps {
  bannerEnabled: boolean;
  bannerType?: 'ticker' | 'side_card' | 'bottom_bar' | 'popup';
  bannerText: string;
  bannerImageUrl?: string;
  bannerImages?: string[];
  bannerSpeed?: number;
  bannerRotateEnabled?: boolean;
  bannerRotateInterval?: number;
  bannerRotateMode?: 'random' | 'sequential';
  bannerPool?: string[];
  bannerRepeatCount?: number;
  bannerMaxCycles?: number;
}

export function TVBanner({
  bannerEnabled,
  bannerType = 'ticker',
  bannerText,
  bannerImageUrl,
  bannerImages,
  bannerSpeed = 20,
  bannerRotateEnabled = false,
  bannerRotateInterval = 15,
  bannerRotateMode = 'random',
  bannerPool,
  bannerRepeatCount = 1,
  bannerMaxCycles = 0,
}: TVBannerProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [dismissedPopup, setDismissedPopup] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [stoppedAfterMax, setStoppedAfterMax] = useState(false);

  const shownCountRef = useRef(1);
  const totalSwitchesRef = useRef(0);
  const repeatCountPerBanner = Math.max(1, bannerRepeatCount || 1);
  const maxTotalCycles = bannerMaxCycles || 0; // 0 = infinite / continuous

  // One accurate unified speed for both ticker scroll duration and card display interval
  const effectiveSpeed = Math.max(12, bannerSpeed || bannerRotateInterval || 35);

  // Combine images array or fallback to single bannerImageUrl
  const imagesList = (bannerImages && bannerImages.length > 0)
    ? bannerImages.filter(img => Boolean(img?.trim()))
    : (bannerImageUrl?.trim() ? [bannerImageUrl.trim()] : []);

  // Build the effective pool of text quotes for rotation
  const textPool = useMemo(() => {
    const base = (bannerPool && bannerPool.length > 0)
      ? bannerPool.filter(t => Boolean(t?.trim()))
      : DEFAULT_BANNER_PRESET_TEXTS;

    const trimmedMain = bannerText?.trim();
    if (trimmedMain && !base.includes(trimmedMain)) {
      return [trimmedMain, ...base];
    }
    return base.length > 0 ? base : (trimmedMain ? [trimmedMain] : []);
  }, [bannerPool, bannerText]);

  // Sync active text index if admin manually changes bannerText preset or input
  useEffect(() => {
    if (bannerText) {
      const idx = textPool.indexOf(bannerText.trim());
      if (idx !== -1) {
        setCurrentTextIndex(idx);
      }
    }
  }, [bannerText, textPool]);

  // Reset popup dismissal if banner settings change
  useEffect(() => {
    setDismissedPopup(false);
  }, [bannerText, bannerImageUrl, bannerImages, bannerType, bannerEnabled]);

  // Reset repetition counters if settings or pool change
  useEffect(() => {
    shownCountRef.current = 1;
    totalSwitchesRef.current = 0;
    setStoppedAfterMax(false);
  }, [bannerRotateEnabled, effectiveSpeed, bannerRotateMode, repeatCountPerBanner, maxTotalCycles, textPool]);

  // Slideshow timer for multi-images in side_card and popup
  useEffect(() => {
    if (imagesList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % imagesList.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [imagesList.length]);

  // Advance to next quote when marquee completes a full off-screen pass across the screen
  const handleMarqueeCycle = () => {
    if (!bannerRotateEnabled || textPool.length <= 1 || stoppedAfterMax) return;

    if (shownCountRef.current < repeatCountPerBanner) {
      shownCountRef.current += 1;
      return; // Keep current banner for next pass
    }

    shownCountRef.current = 1;
    totalSwitchesRef.current += 1;

    if (maxTotalCycles > 0 && totalSwitchesRef.current >= maxTotalCycles * textPool.length) {
      setStoppedAfterMax(true);
      return;
    }

    setCurrentTextIndex((prev) => {
      if (bannerRotateMode === 'sequential') {
        return (prev + 1) % textPool.length;
      }
      let next = Math.floor(Math.random() * textPool.length);
      if (next === prev && textPool.length > 1) {
        next = (prev + 1) % textPool.length;
      }
      return next;
    });
  };

  // Auto-rotation timer ONLY for static display types (side_card & popup)
  // Marquee types (ticker & bottom_bar) use handleMarqueeCycle off-screen so they NEVER fade in the center!
  useEffect(() => {
    if (bannerType === 'ticker' || bannerType === 'bottom_bar') return;
    if (!bannerRotateEnabled || textPool.length <= 1 || stoppedAfterMax) return;

    const interval = setInterval(() => {
      if (shownCountRef.current < repeatCountPerBanner) {
        shownCountRef.current += 1;
        return;
      }

      shownCountRef.current = 1;
      totalSwitchesRef.current += 1;

      if (maxTotalCycles > 0 && totalSwitchesRef.current >= maxTotalCycles * textPool.length) {
        setStoppedAfterMax(true);
        return;
      }

      setIsFading(true);
      setTimeout(() => {
        setCurrentTextIndex((prev) => {
          if (bannerRotateMode === 'sequential') {
            return (prev + 1) % textPool.length;
          }
          let next = Math.floor(Math.random() * textPool.length);
          if (next === prev && textPool.length > 1) {
            next = (prev + 1) % textPool.length;
          }
          return next;
        });
        setIsFading(false);
      }, 400);
    }, effectiveSpeed * 1000);

    return () => clearInterval(interval);
  }, [bannerType, bannerRotateEnabled, effectiveSpeed, bannerRotateMode, repeatCountPerBanner, maxTotalCycles, textPool, stoppedAfterMax]);

  if (!bannerEnabled) return null;

  const currentImage = imagesList[activeImageIndex] || imagesList[0];
  const currentBannerText = bannerRotateEnabled && textPool.length > 0
    ? (textPool[currentTextIndex] || bannerText)
    : bannerText;

  // ============================================================
  // TYPE 1: Top Running Ticker (Header Bar Marquee)
  // Glides smoothly off-screen right (100vw) to off-screen left (-100%)
  // Transitions between jokes only when off-screen — NO mid-screen fade!
  // ============================================================
  if (bannerType === 'ticker') {
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
        <div className="flex-1 overflow-hidden relative flex items-center w-full">
          <div
            className="whitespace-nowrap inline-flex items-center will-change-transform"
            style={{
              animation: `marquee-glide ${effectiveSpeed}s linear infinite`,
            }}
            onAnimationIteration={handleMarqueeCycle}
          >
            <div className="inline-flex items-center gap-3 sm:gap-6 px-6 sm:px-12 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] sm:text-xs font-black text-indigo-300 uppercase tracking-widest shrink-0">
                <Megaphone size={12} className="text-amber-400 animate-pulse" />
                ANNOUNCEMENT
              </span>
              {imagesList.map((img, idx) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={idx}
                  src={img}
                  alt={`Ad Banner ${idx + 1}`}
                  className="h-4 sm:h-7 md:h-10 object-contain rounded shadow-md shrink-0 bg-white/10 p-0.5"
                />
              ))}
              {currentBannerText && (
                <span
                  className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-wider shrink-0"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {currentBannerText}
                </span>
              )}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes marquee-glide {
            0% {
              transform: translateX(100vw);
            }
            100% {
              transform: translateX(-100%);
            }
          }
        `}</style>
      </div>
    );
  }

  // ============================================================
  // TYPE 2: Bottom Edge Marquee Ticker Bar
  // Glides smoothly along the bottom edge of the TV screen
  // ============================================================
  if (bannerType === 'bottom_bar') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-30 overflow-hidden flex items-center bg-zinc-950/95 border-t border-amber-500/40 shadow-2xl py-1.5"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex-1 overflow-hidden relative flex items-center w-full">
          <div
            className="whitespace-nowrap inline-flex items-center will-change-transform"
            style={{
              animation: `marquee-glide-bottom ${effectiveSpeed}s linear infinite`,
            }}
            onAnimationIteration={handleMarqueeCycle}
          >
            <div className="inline-flex items-center gap-3 sm:gap-6 px-6 sm:px-12 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] sm:text-xs font-black text-amber-300 uppercase tracking-widest shrink-0">
                <Sparkles size={12} className="text-amber-400 animate-pulse" />
                INUMAN CHRONICLES
              </span>
              {imagesList.map((img, idx) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={idx}
                  src={img}
                  alt={`Ad Banner ${idx + 1}`}
                  className="h-4 sm:h-6 md:h-8 object-contain rounded shadow-md shrink-0 bg-white/10 p-0.5"
                />
              ))}
              {currentBannerText && (
                <span
                  className="text-xs sm:text-sm md:text-base font-extrabold text-amber-300 tracking-wider shrink-0"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {currentBannerText}
                </span>
              )}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes marquee-glide-bottom {
            0% {
              transform: translateX(100vw);
            }
            100% {
              transform: translateX(-100%);
            }
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

        {currentBannerText && (
          <p
            className={`text-[11px] sm:text-xs font-bold text-zinc-100 line-clamp-3 leading-relaxed transition-opacity duration-300 ${
              isFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {currentBannerText}
          </p>
        )}
      </div>
    );
  }

  // ============================================================
  // TYPE 4: Slow Bouncing Floating Announcement Card
  // Bounces slowly & smoothly across the TV screen without blocking playback
  // ============================================================
  if (bannerType === 'popup') {
    if (dismissedPopup) return null;

    return (
      <div className="fixed z-40 pointer-events-auto animate-slow-bounce transition-all">
        <div className="relative w-[180px] sm:w-[210px] aspect-square p-3 rounded-2xl bg-black/40 border border-white/20 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-white flex flex-col justify-between items-center text-center">
          <button
            onClick={() => setDismissedPopup(true)}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white transition-all active:scale-95 z-10"
            aria-label="Dismiss banner"
          >
            <X size={12} />
          </button>

          <div className="flex items-center gap-1 mb-1">
            <Sparkles size={12} className="text-indigo-400" />
            <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">ANNOUNCEMENT</span>
          </div>

          {currentImage && (
            <div className="relative w-full flex-1 max-h-[110px] sm:max-h-[130px] rounded-xl overflow-hidden my-1 bg-transparent flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage}
                alt="Ad Banner"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          )}

          {currentBannerText && (
            <p
              className={`text-[11px] font-bold text-zinc-100 line-clamp-2 leading-tight px-0.5 transition-opacity duration-300 ${
                isFading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {currentBannerText}
            </p>
          )}

          {imagesList.length > 1 && (
            <div className="flex items-center gap-1 mt-1">
              {imagesList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-1 rounded-full transition-all ${idx === activeImageIndex ? 'bg-indigo-400 w-3' : 'bg-white/40 w-1'}`}
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
