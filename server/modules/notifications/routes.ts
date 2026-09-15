import { Router } from 'express';
import { requirePermission } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { NotificationTemplate } from './models.js';
import { NotificationService } from './service.js';
import { UpdateSettingsSchema, UpdateTemplateSchema } from './validation.js';

export const notificationsRouter = Router();

// Self-service settings — every authenticated user manages their own.
notificationsRouter.get('/settings', async (req, res, next) => {
  try {
    const settings = await NotificationService.getSettings((req as any).user._id);
    res.json(settings);
  } catch (err) { next(err); }
});

notificationsRouter.patch('/settings', validateRequest(UpdateSettingsSchema), async (req, res, next) => {
  try {
    const settings = await NotificationService.updateSettings((req as any).user._id, req.body.disabledEmailTypes);
    res.json(settings);
  } catch (err) { next(err); }
});

// Admin-only template management.
notificationsRouter.get('/templates', requirePermission('admin.access'), async (req, res, next) => {
  try {
    const templates = await NotificationTemplate.find({}).sort({ type: 1 });
    res.json({ templates });
  } catch (err) { next(err); }
});

notificationsRouter.patch('/templates/:type', requirePermission('admin.access'), validateRequest(UpdateTemplateSchema), async (req, res, next) => {
  try {
    const before = await NotificationTemplate.findOne({ type: req.params.type });
    if (!before) return res.status(404).json({ error: 'Шаблон не знайдено' });

    const updated = await NotificationTemplate.findOneAndUpdate(
      { type: req.params.type },
      { $set: { ...req.body, updatedBy: (req as any).user._id, updatedAt: new Date() } },
      { new: true }
    );

    await auditService.log({
      actorId: (req as any).user._id,
      action: 'NOTIFICATION_TEMPLATE_UPDATED',
      entityType: 'NotificationTemplate',
      entityId: String(req.params.type),
      before: before.toObject(),
      after: updated?.toObject()
    });

    res.json(updated);
  } catch (err) { next(err); }
});
