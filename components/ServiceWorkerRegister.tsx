'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => {
            console.log('OKEKARAOKE Service worker registered successfully:', reg.scope);
          },
          (err) => {
            console.warn('Service worker registration failed:', err);
          }
        );
      });
    }
  }, []);

  return null;
}
