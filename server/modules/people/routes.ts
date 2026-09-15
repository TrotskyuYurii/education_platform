import { Router } from 'express';
import { User } from '../../models.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { PeopleListQuerySchema, SelfServiceUpdateSchema } from './validation.js';
import { PeopleService } from './service.js';

export const peopleRouter = Router();

// Company directory: open to every authenticated user (same precedent as
// GET /v2/org/departments) — everyone can browse basic colleague info,
// only the "full profile" fields are scope-gated (see PeopleService.getProfile).
peopleRouter.get('/', validateRequest(PeopleListQuerySchema), async (req, res, next) => {
  try {
    // validateRequest only validates req.query, it does not write the coerced
    // (numeric) result back — parse limit/skip ourselves, same convention as
    // server/modules/search/routes.ts.
    const { q, departmentId, positionId, locationId } = req.query as any;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip, 10) : 0;
    const result = await PeopleService.list({ q, departmentId, positionId, locationId, limit, skip });
    res.json(result);
  } catch (err) { next(err); }
});

peopleRouter.get('/org-chart', async (req, res, next) => {
  try {
    const chart = await PeopleService.orgChart();
    res.json({ items: chart });
  } catch (err) { next(err); }
});

// Self-service profile edit — no permission check beyond being authenticated,
// deliberately limited to non-sensitive contact fields via SelfServiceUpdateSchema.
// Org-managed fields (position/department/manager) stay on PUT /api/admin/users/:id.
peopleRouter.patch('/me', validateRequest(SelfServiceUpdateSchema), async (req, res, next) => {
  try {
    const viewer = (req as any).user;
    const { phone, avatarUrl, customFields } = req.body;
    const before = { phone: viewer.phone, avatarUrl: viewer.avatarUrl, customFields: viewer.customFields };

    const updateData: any = {};
    if (phone !== undefined) updateData.phone = phone;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (customFields !== undefined) updateData.customFields = customFields;

    const updated = await User.findByIdAndUpdate(viewer._id, updateData, { new: true })
      .select('fullName avatarUrl phone customFields');

    await auditService.log({
      actorId: viewer._id,
      action: 'PEOPLE_SELF_PROFILE_UPDATED',
      entityType: 'User',
      entityId: String(viewer._id),
      before,
      after: { phone: updated?.phone, avatarUrl: updated?.avatarUrl, customFields: updated?.customFields }
    });

    res.json({ user: updated });
  } catch (err) { next(err); }
});

// Must come after the more specific '/org-chart' and '/me' routes.
peopleRouter.get('/:id', async (req, res, next) => {
  try {
    const profile = await PeopleService.getProfile((req as any).user, req.params.id);
    if (!profile) return res.status(404).json({ error: 'Користувача не знайдено' });
    res.json(profile);
  } catch (err) { next(err); }
});
