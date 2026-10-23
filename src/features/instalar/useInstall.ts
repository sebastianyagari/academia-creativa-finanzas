import { useEffect, useState } from 'react';

/** Evento de Chrome/Android para ofrecer "Instalar app" desde un botón propio. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'otro';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac con pantalla táctil.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  return /Android/.test(ua) ? 'android' : 'otro';
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// El navegador lo dispara una sola vez y puede ser antes de que React monte.
let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

/** Estado de instalación (SPEC 9.4 y 10): ya instalada, botón directo o pasos manuales. */
export function useInstall() {
  const [installed, setInstalled] = useState(isStandalone);
  const [canPrompt, setCanPrompt] = useState(() => deferred !== null);
  const platform = detectPlatform();

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => {
      deferred = null;
      setInstalled(true);
      setCanPrompt(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setCanPrompt(false);
    return outcome === 'accepted';
  }

  return { installed, canPrompt, platform, install };
}
