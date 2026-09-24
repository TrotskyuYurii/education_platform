import { Router } from 'express';
import { z } from 'zod';
import { requireAdminRole } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { activityTrackRateLimiter } from '../core/rateLimit.js';
import { CLIENT_ACTIVITY_TYPES } from './models.js';
import { ActivityService } from './service.js';

export const activityRouter = Router();

const TrackSchema = z.object({
  body: z.object({
    type: z.enum(CLIENT_ACTIVITY_TYPES),
    // Ключ розділу: 'catalog', 'management:users' тощо.
    page: z.string().trim().min(1).max(64).regex(/^[\w:.-]+$/),
    title: z.string().trim().max(200).optional()
  })
});

// Браузер повідомляє про переходи між розділами. Будь-який користувач пише
// лише про себе: автор події береться із сесії, а не з тіла запиту.
activityRouter.post('/track', activityTrackRateLimiter, validateRequest(TrackSchema), (req, res) => {
  const { type, page, title } = req.body;
  ActivityService.capture({ type, page, title, user: (req as any).user, req });
  res.status(202).json({ success: true });
});

// Перегляд журналу — лише роль «Адміністратор».
activityRouter.get('/', requireAdminRole, async (req, res, next) => {
  try {
    const { userId, type, from, to, search, page, limit } = req.query as Record<string, string>;
    res.json(await ActivityService.list({ userId, type, from, to, search, page: Number(page), limit: Number(limit) }));
  } catch (err) { next(err); }
});
