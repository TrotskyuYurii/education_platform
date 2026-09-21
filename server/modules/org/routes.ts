import { Router } from 'express';
import { Department, Position, Location } from '../../models.js';
import { z } from 'zod';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';

export const orgRouter = Router();

// Zod schemas for validation
const DepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    parentId: z.string().optional(),
    headUserId: z.string().optional(),
    isActive: z.boolean().default(true),
    order: z.number().default(0)
  })
});

const PositionSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    departmentId: z.string().optional(),
    grade: z.string().optional(),
    isActive: z.boolean().default(true)
  })
});

const LocationSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    city: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    isActive: z.boolean().default(true)
  })
});

import { requirePermission } from '../core/permissions.js';
import { DEFAULT_DEPARTMENT, isDefaultDepartment } from '../../../shared/departments.js';

const requireOrgManage = requirePermission('org.manage');

/**
 * «Всі підрозділи» — системний запис.
 *
 * Його створює ініціалізація бази, на нього спирається перевірка «бачить усі
 * матеріали» (server/routes.ts) і до нього потрапляють інструкції, підрозділ
 * яких не вдалося зіставити з довідником. Тому його не можна ані видалити,
 * ані перейменувати — інакше ці зв'язки мовчки розірвуться.
 */
const SYSTEM_DEPARTMENT_ERROR = `«${DEFAULT_DEPARTMENT}» — системний підрозділ: його не можна змінювати або видаляти.`;

// --- Departments ---
orgRouter.get('/departments', async (req, res) => {
  const items = await Department.find({}).sort({ order: 1, name: 1 }).populate('headUserId', 'fullName email');
  // Адмінка ховає дії редагування й видалення для системного запису.
  res.json(items.map((item: any) => ({
    ...item.toObject(),
    isSystem: isDefaultDepartment(item.name)
  })));
});

orgRouter.post('/departments', requireOrgManage, validateRequest(DepartmentSchema), async (req, res, next) => {
  try {
    if (isDefaultDepartment(req.body?.name)) {
      return res.status(400).json({ error: `Підрозділ «${DEFAULT_DEPARTMENT}» уже існує — він створюється системою.` });
    }
    const item = await Department.create(req.body);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: item._id.toString(),
      after: item.toObject()
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

orgRouter.patch('/departments/:id', requireOrgManage, validateRequest(z.object({ body: DepartmentSchema.shape.body.partial() })), async (req, res, next) => {
  try {
    const before = await Department.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    if (isDefaultDepartment(before.name)) {
      return res.status(400).json({ error: SYSTEM_DEPARTMENT_ERROR });
    }
    if (req.body?.name !== undefined && isDefaultDepartment(req.body.name)) {
      return res.status(400).json({ error: `Назву «${DEFAULT_DEPARTMENT}» зарезервовано за системним підрозділом.` });
    }

    const item = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: item._id.toString(),
      before: before.toObject(),
      after: item.toObject()
    });
    res.json(item);
  } catch (err) { next(err); }
});

orgRouter.delete('/departments/:id', requireOrgManage, async (req, res, next) => {
  try {
    // Крок 15: ported from the now-removed legacy /api/admin/departments route —
    // this default department is relied on elsewhere (e.g. GET /api/content's
    // "sees everything" check) as a magic string, so deleting it must stay blocked.
    const existing = await Department.findById(req.params.id);
    if (isDefaultDepartment(existing?.name)) {
      return res.status(400).json({ error: SYSTEM_DEPARTMENT_ERROR });
    }

    const item = await Department.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'Department',
      entityId: item._id.toString(),
      before: item.toObject()
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Positions ---
orgRouter.get('/positions', async (req, res) => {
  const items = await Position.find({}).populate('departmentId', 'name');
  res.json(items);
});

orgRouter.post('/positions', requireOrgManage, validateRequest(PositionSchema), async (req, res, next) => {
  try {
    const item = await Position.create(req.body);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'POSITION_CREATED',
      entityType: 'Position',
      entityId: item._id.toString(),
      after: item.toObject()
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

orgRouter.patch('/positions/:id', requireOrgManage, validateRequest(z.object({ body: PositionSchema.shape.body.partial() })), async (req, res, next) => {
  try {
    const before = await Position.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });

    const item = await Position.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'POSITION_UPDATED',
      entityType: 'Position',
      entityId: item._id.toString(),
      before: before.toObject(),
      after: item.toObject()
    });
    res.json(item);
  } catch (err) { next(err); }
});

orgRouter.delete('/positions/:id', requireOrgManage, async (req, res, next) => {
  try {
    const item = await Position.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'POSITION_DELETED',
      entityType: 'Position',
      entityId: item._id.toString(),
      before: item.toObject()
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Locations ---
orgRouter.get('/locations', async (req, res) => {
  const items = await Location.find({});
  res.json(items);
});

orgRouter.post('/locations', requireOrgManage, validateRequest(LocationSchema), async (req, res, next) => {
  try {
    const item = await Location.create(req.body);
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'LOCATION_CREATED',
      entityType: 'Location',
      entityId: item._id.toString(),
      after: item.toObject()
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

orgRouter.patch('/locations/:id', requireOrgManage, validateRequest(z.object({ body: LocationSchema.shape.body.partial() })), async (req, res, next) => {
  try {
    const before = await Location.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });

    const item = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'LOCATION_UPDATED',
      entityType: 'Location',
      entityId: item._id.toString(),
      before: before.toObject(),
      after: item.toObject()
    });
    res.json(item);
  } catch (err) { next(err); }
});

orgRouter.delete('/locations/:id', requireOrgManage, async (req, res, next) => {
  try {
    const item = await Location.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'LOCATION_DELETED',
      entityType: 'Location',
      entityId: item._id.toString(),
      before: item.toObject()
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});
