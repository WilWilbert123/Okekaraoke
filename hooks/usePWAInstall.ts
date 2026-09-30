'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstallable(false);
          setDeferredPrompt(null);
        }
        return;
      } catch (err) {
        console.error('Install prompt failed:', err);
      }
    }

    // Fallback guidance if deferredPrompt is not available (e.g. Android Chrome without prompt or iOS Safari)
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      alert("To Install OKEKARAOKE App on Android:\n\n1. Tap the Chrome Menu (3 dots top-right ⋮)\n2. Tap 'Add to Home screen' or 'Install app'");
    } else if (isIOS) {
      alert("To Install OKEKARAOKE App on iPhone/iPad:\n\n1. Tap the Share button at the bottom (⎋)\n2. Scroll down and tap 'Add to Home Screen'");
    } else {
      alert("To Install App:\n\nUse your browser menu (⋮ or ⋯) and select 'Add to Home screen' or 'Install App'.");
    }
  };

  return { isInstallable, isStandalone, installApp };
}
