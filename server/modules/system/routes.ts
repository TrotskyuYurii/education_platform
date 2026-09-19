import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { SYSTEM_LOG_STATUSES } from './models.js';
import { SystemLogService } from './service.js';

export const systemRouter = Router();

const IdsSchema = z.object({
  body: z.object({
    ids: z.array(z.string().min(1)).min(1, 'Оберіть хоча б один запис'),
    status: z.enum(SYSTEM_LOG_STATUSES).optional(),
    resolutionNote: z.string().max(2000).optional()
  })
});

// Читання журналу — окреме право, щоб черговий адміністратор міг бачити проблеми,
// не маючи повного доступу до налаштувань системи.
systemRouter.get('/logs', requirePermission('system.logs.view'), async (req, res, next) => {
  try {
    const { level, source, status, search, page, limit } = req.query as Record<string, string>;
    res.json(await SystemLogService.list({ level, source, status, search, page: Number(page), limit: Number(limit) }));
  } catch (err) { next(err); }
});

// Зведення для індикатора тривоги. Легкий запит — фронт смикає його при вході
// та періодично, тож тут лише лічильники, без вибірки самих записів.
systemRouter.get('/logs/summary', requirePermission('system.logs.view'), async (req, res, next) => {
  try {
    res.json(await SystemLogService.summary());
  } catch (err) { next(err); }
});

systemRouter.patch('/logs/status', requirePermission('system.logs.manage'), validateRequest(IdsSchema), async (req, res, next) => {
  try {
    const { ids, status, resolutionNote } = req.body;
    if (!status) return res.status(400).json({ error: 'Не вказано новий статус' });

    const result = await SystemLogService.setStatus(ids, status, (req as any).user._id, resolutionNote);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'SYSTEM_LOG_STATUS_CHANGED',
      entityType: 'SystemLog',
      entityId: ids.join(','),
      after: { status, resolutionNote, count: result.updated }
    });
    res.json(result);
  } catch (err) { next(err); }
});

systemRouter.post('/logs/delete', requirePermission('system.logs.manage'), validateRequest(IdsSchema), async (req, res, next) => {
  try {
    const result = await SystemLogService.remove(req.body.ids);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'SYSTEM_LOG_DELETED',
      entityType: 'SystemLog',
      entityId: req.body.ids.join(','),
      before: { count: result.deleted }
    });
    res.json(result);
  } catch (err) { next(err); }
});

systemRouter.post('/logs/purge', requirePermission('system.logs.manage'), async (req, res, next) => {
  try {
    const olderThanDays = Math.max(0, Number(req.body?.olderThanDays) || 0);
    const result = await SystemLogService.purgeResolved(olderThanDays);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'SYSTEM_LOG_PURGED',
      entityType: 'SystemLog',
      entityId: `resolved:${olderThanDays}d`,
      before: { count: result.deleted }
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Перевірка, що журнал справді ловить збої: пише тестовий запис.
systemRouter.post('/logs/test', requirePermission('system.logs.manage'), async (req, res, next) => {
  try {
    await SystemLogService.record({
      level: 'info',
      source: 'system',
      event: 'SYSTEM_LOG_TEST',
      message: `Тестовий запис журналу, створив ${(req as any).user.fullName || (req as any).user.email}`,
      details: { createdBy: (req as any).user.email },
      dedupeKey: `test-${Date.now()}`
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});
