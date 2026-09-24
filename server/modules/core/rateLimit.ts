import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Крок 14: /api/auth/* had zero throttling before this — the 2FA code (8 chars,
// 5-minute expiry) and password login were both brute-forceable. Key by
// IP + the account identifier (not IP alone) so one shared office IP can't
// get every employee locked out over a single person's typos. Must go through
// ipKeyGenerator (not raw req.ip) so IPv6 addresses get normalized consistently.
const keyByIpAndIdentifier = (identifierField: string) => (req: any) => {
  const identifier = (req.body?.[identifierField] || '').toString().toLowerCase().trim();
  return `${ipKeyGenerator(req.ip)}:${identifier}`;
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndIdentifier('email'),
  message: { error: 'Забагато спроб входу. Спробуйте ще раз через 15 хвилин.' }
});

export const verifyCodeRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndIdentifier('email'),
  message: { error: 'Забагато спроб введення коду. Спробуйте ще раз через 5 хвилин.' }
});

export const resendCodeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndIdentifier('email'),
  message: { error: 'Забагато запитів нового коду. Спробуйте ще раз через 15 хвилин.' }
});

// Журнал дій: браузер шле подію на кожен перехід між розділами. Ліміт з
// великим запасом для живої людини, але не дає скрипту засмітити журнал.
// Ключ — користувач (маршрут стоїть за requireAuth), а не IP офісу.
export const activityTrackRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => (req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip)),
  message: { error: 'Забагато подій журналу. Спробуйте пізніше.' }
});
