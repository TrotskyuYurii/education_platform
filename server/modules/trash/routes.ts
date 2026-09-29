import { Router } from 'express';
import { z } from 'zod';
import { requireAdminRole } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { TrashService } from './service.js';

/**
 * «Адміністрування → Матеріали → Корзина». Перегляд, відновлення та остаточне
 * видалення — лише роль «Адміністратор».
 */
export const trashRouter = Router();
trashRouter.use(requireAdminRole);

trashRouter.get('/', async (req, res, next) => {
  try {
    const { kind, search, from, to, deletedBy, page, limit } = req.query as Record<string, string>;
    res.json(await TrashService.list({ kind, search, from, to, deletedBy, page: Number(page), limit: Number(limit) }));
  } catch (err) { next(err); }
});

trashRouter.get('/count', async (req, res, next) => {
  try {
    res.json({ total: await TrashService.count() });
  } catch (err) { next(err); }
});

const IdsSchema = z.object({
  body: z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(500) })
});

const audit = (req: any, action: string, entityId: string) => auditService.log({
  actorId: req.user?._id?.toString(),
  action,
  entityType: 'TrashItem',
  entityId,
  ip: req.ip,
  userAgent: req.get?.('user-agent')
});

trashRouter.post('/restore', validateRequest(IdsSchema), async (req: any, res, next) => {
  try {
    const restored: any[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const id of req.body.ids as string[]) {
      try {
        restored.push(await TrashService.restore(id));
        await audit(req, 'trash.restore', id);
      } catch (err: any) {
        if (!err?.status) throw err;
        failed.push({ id, error: err.message });
      }
    }
    res.json({ restored, failed });
  } catch (err) { next(err); }
});

trashRouter.post('/purge', validateRequest(IdsSchema), async (req: any, res, next) => {
  try {
    let purged = 0;
    for (const id of req.body.ids as string[]) {
      if (await TrashService.purge(id)) {
        purged += 1;
        await audit(req, 'trash.purge', id);
      }
    }
    res.json({ purged });
  } catch (err) { next(err); }
});

// «Очистити корзину»: остаточно видаляє все, що в ній лежить.
trashRouter.post('/empty', async (req: any, res, next) => {
  try {
    const ids = await TrashService.allIds();
    let purged = 0;
    for (const id of ids) if (await TrashService.purge(id)) purged += 1;
    await audit(req, 'trash.empty', String(purged));
    res.json({ purged });
  } catch (err) { next(err); }
});
