import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';

/**
 * Сесія з таймаутом бездіяльності.
 *
 * Токен тепер живе рівно стільки, скільки дозволено простоювати (за замовчуванням
 * 30 хв), а не 7 днів. Продовжує його лише явний «пульс» (`POST /auth/heartbeat`),
 * який клієнт шле у відповідь на реальні дії людини. Це принципово: у застосунку
 * є фонові опитування кожні 15 секунд, тож якби сесію оновлював будь-який запит,
 * відкрита вкладка тримала б вхід вічно — саме те, від чого таймаут і захищає.
 */

/**
 * Секрет підпису токенів. Раніше без JWT_SECRET підставлявся відомий усім рядок
 * з коду — будь-хто міг підробити токен адміністратора. Тепер у продакшені без
 * секрету сервер не стартує, а в розробці генерується випадковий на час процесу
 * (сесії просто скинуться після перезапуску).
 */
export const resolveJwtSecret = (env: NodeJS.ProcessEnv = process.env): string => {
  const secret = env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters — refusing to start in production.');
  }
  if (secret) {
    console.warn('⚠️ JWT_SECRET is shorter than 32 characters. Use a long random value in production.');
    return secret;
  }
  console.warn('⚠️ JWT_SECRET is not set — using a random per-process secret (sessions reset on restart).');
  return crypto.randomBytes(48).toString('hex');
};

const JWT_SECRET = resolveJwtSecret();

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

/**
 * Параметри cookie сесії під конкретний запит.
 *
 * - `sameSite: 'lax'` — фронтенд і API живуть на одному домені, тож cookie не
 *   потрібна в чужих контекстах. Колишнє `'none'` дозволяло стороннім сайтам
 *   слати POST-запити від імені залогіненої людини (CSRF).
 * - `secure` визначається протоколом: раніше він був завжди `true`, і браузер
 *   мовчки відкидав cookie, коли портал відкривали по http (внутрішня IP-адреса
 *   без сертифіката) — вхід «проходив», але наступний запит отримував 401.
 *   Примусово задати можна через COOKIE_SECURE=true|false.
 */
export const sessionCookieOptions = (req?: Request, env: NodeJS.ProcessEnv = process.env) => {
  const override = env.COOKIE_SECURE?.trim().toLowerCase();
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = override === 'true' ? true
    : override === 'false' ? false
    : Boolean(req?.secure || forwardedProto === 'https');
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/'
  };
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
    ...sessionCookieOptions(res.req),
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS * 1000
  });
  return token;
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(res.req));
};

export { JWT_SECRET };
