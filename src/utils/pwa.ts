/**
 * PWA: реєстрація service worker, підготовка оболонки до офлайну та
 * встановлення додатку на пристрій.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach(fn => fn());

/** Викликається один раз із main.tsx, ще до першого рендеру. */
export function initPwa() {
  if (typeof window === 'undefined') return;

  // Подія приходить дуже рано — ловимо її до того, як змонтується меню профілю.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstall();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

export const isStandaloneApp = (): boolean =>
  typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );

export const canPromptInstall = () => deferredInstallPrompt !== null;

export function subscribeInstallAvailability(fn: () => void) {
  installListeners.add(fn);
  return () => { installListeners.delete(fn); };
}

/** Показує системний діалог встановлення. Повертає true, якщо людина погодилась. */
export async function promptInstall(): Promise<boolean> {
  const evt = deferredInstallPrompt;
  if (!evt) return false;
  deferredInstallPrompt = null;
  notifyInstall();
  await evt.prompt();
  const choice = await evt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  return choice.outcome === 'accepted';
}

/**
 * Готує оболонку до роботи без мережі: підвантажує чанки розділів, доступних
 * офлайн, і передає воркеру список усіх уже отриманих файлів. На першому візиті
 * воркер ще не контролював сторінку, тож ці запити пройшли повз його кеш.
 */
export async function primeOfflineShell() {
  if (!('serviceWorker' in navigator) || !navigator.onLine) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await Promise.all([
      import('../components/CourseCatalog'),
      import('../components/InstructionViewer'),
      import('../components/AboutApp'),
      import('../components/Offline/OfflineLibraryModal')
    ]);
    const urls = performance
      .getEntriesByType('resource')
      .map(e => e.name)
      .filter(name => {
        try {
          const u = new URL(name);
          return u.origin === location.origin && u.pathname.startsWith('/assets/');
        } catch {
          return false;
        }
      });
    reg.active?.postMessage({ type: 'CACHE_URLS', urls: ['/', ...new Set(urls)] });
  } catch {
    // Без кешу оболонки додаток просто не відкриється офлайн — не критично.
  }
}
