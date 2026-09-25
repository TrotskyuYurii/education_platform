/**
 * Дашборд «Активність»: правила обліку часу в застосунку і розрахунок періодів.
 *
 * Спільні для сервера (облік і агрегація) та екрана (підписи, порівняння з
 * попереднім періодом), щоб обидві сторони однаково розуміли «день» і «час».
 */

/**
 * Скільки секунд зараховує один «пульс» сесії, якщо попереднього не було або
 * він був давно. Пульс клієнт шле не частіше ніж раз на хвилину і лише у
 * відповідь на реальні дії людини, тож один пульс ≈ хвилина роботи.
 */
export const USAGE_BEAT_BASE_CREDIT_SEC = 60;

/**
 * Найбільша перерва між пульсами, яку ще вважаємо безперервною роботою:
 * людина може кілька хвилин читати інструкцію, нічого не натискаючи. Довша
 * пауза — вона відійшла, і проміжок не рахуємо.
 */
export const USAGE_BEAT_MAX_GAP_SEC = 5 * 60;

/**
 * Скільки часу зарахувати за черговий пульс.
 *
 * Рахуємо від попереднього пульсу того самого користувача, а не від вкладки,
 * тож дві відкриті вкладки не подвоюють час.
 */
export function usageCreditSeconds(gapSec: number | null | undefined): number {
  if (gapSec === null || gapSec === undefined || !Number.isFinite(gapSec) || gapSec > USAGE_BEAT_MAX_GAP_SEC) {
    return USAGE_BEAT_BASE_CREDIT_SEC;
  }
  return Math.max(0, Math.round(gapSec));
}

/** Найдовший період, який можна вибрати за раз, — більше просто не вміститься на графіку. */
export const ACTIVITY_DASHBOARD_MAX_DAYS = 366;

const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayToUtc = (day: string): number | null => {
  if (!DAY_RX.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  // Відсіює «2026-02-31», яке Date.UTC мовчки перенесло б на березень.
  return new Date(ms).toISOString().slice(0, 10) === day ? ms : null;
};

const utcToDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Зсуває календарну дату 'YYYY-MM-DD' на n днів. */
export function shiftDay(day: string, days: number): string {
  const ms = dayToUtc(day);
  if (ms === null) throw new Error(`Invalid day: ${day}`);
  return utcToDay(ms + days * DAY_MS);
}

/** Усі дати від from до to включно. */
export function listDays(from: string, to: string): string[] {
  const start = dayToUtc(from);
  const end = dayToUtc(to);
  if (start === null || end === null || end < start) return [];
  const out: string[] = [];
  for (let ms = start; ms <= end && out.length < ACTIVITY_DASHBOARD_MAX_DAYS; ms += DAY_MS) out.push(utcToDay(ms));
  return out;
}

export interface ActivityPeriod {
  from: string;
  to: string;
  days: number;
  /** Такий самий за довжиною період безпосередньо перед обраним — для порівняння. */
  previous: { from: string; to: string };
}

/**
 * Нормалізує період із запиту: неправильні дати замінює на «останні 30 днів
 * до сьогодні», переставляє переплутані межі й обрізає задовгий діапазон.
 */
export function resolveActivityPeriod(from: string | undefined, to: string | undefined, today: string): ActivityPeriod {
  let end = to && dayToUtc(to) !== null ? to : today;
  let start = from && dayToUtc(from) !== null ? from : shiftDay(end, -29);
  if (start > end) [start, end] = [end, start];
  if (listDays(start, end).length >= ACTIVITY_DASHBOARD_MAX_DAYS) start = shiftDay(end, -(ACTIVITY_DASHBOARD_MAX_DAYS - 1));
  const days = listDays(start, end).length;
  return {
    from: start,
    to: end,
    days,
    previous: { from: shiftDay(start, -days), to: shiftDay(start, -1) }
  };
}

/**
 * Зміна відносно попереднього періоду у відсотках. null — порівнювати нема з
 * чим (попередній період порожній), і тоді екран не малює «+∞ %».
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** «2 год 15 хв», «45 хв», «< 1 хв» — для підсумків часу в застосунку. */
export function formatUsageTime(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || !Number.isFinite(totalSec) || totalSec <= 0) return '0 хв';
  const minutesTotal = Math.round(totalSec / 60);
  if (minutesTotal < 1) return '< 1 хв';
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours === 0) return `${minutes} хв`;
  return minutes > 0 ? `${hours} год ${minutes} хв` : `${hours} год`;
}
