import { Router } from 'express';
import { z } from 'zod';
import { requireAdminRole } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { logger } from '../core/logger.js';
import { activityTrackRateLimiter } from '../core/rateLimit.js';
import { CLIENT_ACTIVITY_TYPES } from './models.js';
import { ActivityService, ACTIVITY_EXPORT_MAX_ROWS } from './service.js';

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

// Вивантаження вибірки в Excel з тими самими фільтрами, що й на екрані.
activityRouter.get('/export', requireAdminRole, async (req, res, next) => {
  const { userId, type, from, to, search } = req.query as Record<string, string>;
  const params = { userId, type, from, to, search };
  try {
    const total = await ActivityService.countForExport(params);
    if (total === 0) {
      return res.status(404).json({ error: 'За обраними фільтрами подій немає — вивантажувати нічого' });
    }
    if (total > ACTIVITY_EXPORT_MAX_ROWS) {
      return res.status(400).json({
        error: `Забагато записів для одного файлу (${total}). Звузьте період або оберіть конкретного користувача — максимум ${ACTIVITY_EXPORT_MAX_ROWS}.`
      });
    }

    // Журнал дій — персональні дані, тож саме вивантаження теж лишає слід.
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'USER_ACTIVITY_EXPORTED',
      entityType: 'UserActivity',
      entityId: `${from || 'start'}..${to || 'now'}`,
      after: { ...params, rows: total }
    });

    // У заголовок потрапляють лише справжні дати — інакше рядок із запиту міг би зламати Content-Disposition.
    const period = [from, to].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).join('_') || 'all';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="activity-log-${period}.xlsx"`);
    await ActivityService.writeXlsx(params, res);
  } catch (err) {
    // Файл уже почав іти клієнту — JSON з помилкою не надішлеш, лише обірвати з'єднання,
    // щоб браузер показав збій завантаження, а не «битий» xlsx.
    if (res.headersSent) {
      logger.error({ err }, 'User activity export failed mid-stream');
      res.destroy(err as Error);
      return;
    }
    next(err);
  }
});
