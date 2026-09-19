import jwt from 'jsonwebtoken';
import type { Response } from 'express';

/**
 * Сесія з таймаутом бездіяльності.
 *
 * Токен тепер живе рівно стільки, скільки дозволено простоювати (за замовчуванням
 * 30 хв), а не 7 днів. Продовжує його лише явний «пульс» (`POST /auth/heartbeat`),
 * який клієнт шле у відповідь на реальні дії людини. Це принципово: у застосунку
 * є фонові опитування кожні 15 секунд, тож якби сесію оновлював будь-який запит,
 * відкрита вкладка тримала б вхід вічно — саме те, від чого таймаут і захищає.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

const readNumber = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
};

/** Скільки хвилин бездіяльності до автоматичного виходу. */
export const SESSION_IDLE_TIMEOUT_MINUTES = readNumber(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES,
  30,
  1,
  24 * 60
);

export const SESSION_IDLE_TIMEOUT_SECONDS = SESSION_IDLE_TIMEOUT_MINUTES * 60;

/**
 * За скільки секунд до виходу показати попередження. Не може з'їсти весь інтервал,
 * інакше вікно «Ви ще тут?» висіло б із першої секунди простою.
 */
export const SESSION_WARNING_SECONDS = Math.min(
  readNumber(process.env.SESSION_IDLE_WARNING_SECONDS, 60, 10, 15 * 60),
  Math.max(10, Math.floor(SESSION_IDLE_TIMEOUT_SECONDS / 2))
);

export const SESSION_COOKIE_NAME = 'token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/'
};

/** Параметри таймауту для клієнта — щоб фронтенд не дублював числа у себе. */
export const sessionPolicy = () => ({
  idleTimeoutSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
  warningSeconds: SESSION_WARNING_SECONDS
});

/** Видає (або продовжує) сесійну куку на повний інтервал бездіяльності. */
export const issueSessionCookie = (res: Response, user: { _id: any; role?: string }) => {
  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: SESSION_IDLE_TIMEOUT_SECONDS
  });
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS * 1000
  });
  return token;
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
};

export { JWT_SECRET };
