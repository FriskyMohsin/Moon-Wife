/**
 * PWA plumbing for the Pari AI client panel: service-worker registration,
 * install-prompt capture, and standalone-mode detection.
 * Plain TypeScript, no React — safe to import from anywhere.
 */

let installPromptEvent: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isSecureEnoughForSW(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.isSecureContext || window.location.hostname === 'localhost')
  );
}

/**
 * Register /sw.js. Returns the registration on success, null when SWs are
 * unsupported, unavailable (non-secure context), or registration failed.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isSecureEnoughForSW()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch {
    return null;
  }
}

function captureInstallPrompt(event: Event): void {
  installPromptEvent = event as BeforeInstallPromptEvent;
  // Keep the browser's mini-infobar hidden so the app can show its own prompt.
  event.preventDefault();
}

let listenerAttached = false;

/**
 * Start capturing the browser's beforeinstallprompt event.
 * Call once at app startup, then use promptInstall() from your own UI.
 */
export function getInstallPromptEvent(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', captureInstallPrompt);
  listenerAttached = true;
}

/** True if a captured install prompt is ready to be shown. */
export function canPromptInstall(): boolean {
  return installPromptEvent !== null;
}

/**
 * Show the captured install prompt. Resolves true if the user accepted.
 * Returns false when no prompt was captured or the prompt failed.
 */
export async function promptInstall(): Promise<boolean> {
  const event = installPromptEvent;
  if (!event) return false;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  } finally {
    installPromptEvent = null;
  }
}

/** True when the app is running installed (standalone / fullscreen / iOS standalone). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
