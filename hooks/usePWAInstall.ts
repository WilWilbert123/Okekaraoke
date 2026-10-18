'use client';

import { useState, useEffect } from 'react';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.okekaraoke.app&hl=en';

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setIsInstallable(false);
      }
    };

    checkStandalone();
  }, []);

  const installApp = () => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

    if (isIOS) {
      alert("To Install OKEKARAOKE on iPhone/iPad:\n\n1. Tap the Share button at the bottom (⎋)\n2. Scroll down and select 'Add to Home Screen'");
      return;
    }

    // Redirect to official Google Play Store app listing
    try {
      const win = window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = PLAY_STORE_URL;
      }
    } catch {
      window.location.href = PLAY_STORE_URL;
    }
  };

  return { isInstallable, isStandalone, installApp };
}
