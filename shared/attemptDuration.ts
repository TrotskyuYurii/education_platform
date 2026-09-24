/**
 * Тривалість проходження тесту: від натискання «Розпочати тестування» до
 * завершення (кнопкою або автоматично, коли вичерпався ліміт часу).
 */

/** Довше за добу спроба не триває — таке значення вважаємо збоєм годинника. */
export const MAX_ATTEMPT_DURATION_SEC = 24 * 60 * 60;

/** Перевіряє тривалість, що прийшла з браузера: ціле число секунд або undefined. */
export function sanitizeDurationSec(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.round(n), MAX_ATTEMPT_DURATION_SEC);
}

/** «45 с», «4 хв 12 с», «1 год 3 хв». */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || !Number.isFinite(totalSec) || totalSec < 0) return '—';
  const sec = Math.round(totalSec);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return minutes > 0 ? `${hours} год ${minutes} хв` : `${hours} год`;
  if (minutes > 0) return seconds > 0 ? `${minutes} хв ${seconds} с` : `${minutes} хв`;
  return `${seconds} с`;
}
