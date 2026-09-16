import { Router } from 'express';
import { Role, User } from '../../models.js';
import { requirePermission } from '../core/permissions.js';
import { PERMISSIONS_CATALOG, SCOPE_LABELS, PermissionScope } from './catalog.js';
import { auditService } from '../core/audit.js';
import { z } from 'zod';
import { validateRequest } from '../core/validation.js';

export const rolesRouter = Router();

// Zod schemas
const CreateRoleSchema = z.object({
  body: z.object({
    key: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Ключ ролі повинен містити лише латинські літери, цифри, дефіс або підкреслення'),
    title: z.string().min(2, 'Назва ролі обов’язкова'),
    description: z.string().optional(),
    permissions: z.array(z.object({
      permission: z.string().min(1),
      scope: z.enum(['self', 'team', 'department', 'all'])
    })).default([])
  })
});

const UpdateRoleSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Назва ролі обов’язкова'),
    description: z.string().optional(),
    permissions: z.array(z.object({
      permission: z.string().min(1),
      scope: z.enum(['self', 'team', 'department', 'all'])
    }))
  })
});

// 1. Get list of available system permissions metadata
rolesRouter.get('/permissions', requirePermission('roles.manage'), (req, res) => {
  res.json({
    permissions: PERMISSIONS_CATALOG,
    scopes: SCOPE_LABELS
  });
});

// 2. Get all roles with user counts
rolesRouter.get('/roles', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const roles = await Role.find({}).sort({ isSystem: -1, title: 1 });

    // Крок 14: count via aggregation instead of loading every User document into
    // memory just to tally roleKeys in JS — same fallback logic as before
    // (empty roleKeys → ['admin'] or ['employee']), just computed in Mongo.
    const counts = await User.aggregate([
      {
        $project: {
          keys: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$roleKeys', []] } }, 0] },
              '$roleKeys',
              { $cond: [{ $eq: ['$role', 'admin'] }, ['admin'], ['employee']] }
            ]
          }
        }
      },
      { $unwind: '$keys' },
      { $group: { _id: '$keys', count: { $sum: 1 } } }
    ]);
    const userCountByRole: Record<string, number> = {};
    counts.forEach((c: any) => { userCountByRole[c._id] = c.count; });

    const enrichedRoles = roles.map((r: any) => ({
      ...r.toObject(),
      userCount: userCountByRole[r.key] || 0
    }));

    res.json({ roles: enrichedRoles });
  } catch (err) {
    next(err);
  }
});

// 3. Create a custom role
rolesRouter.post('/roles', requirePermission('roles.manage'), validateRequest(CreateRoleSchema), async (req, res, next) => {
  try {
    const { key, title, description, permissions } = req.body;

    const normalizedKey = key.trim();
    const existing = await Role.findOne({ key: normalizedKey });
    if (existing) {
      return res.status(400).json({ error: `Роль з ідентифікатором "${normalizedKey}" вже існує` });
    }

    const newRole = await Role.create({
      key: normalizedKey,
      title: title.trim(),
      description: description?.trim() || '',
      permissions: permissions || [],
      isSystem: false,
      createdAt: new Date()
    });

    await auditService.log({
      actorId: (req as any).user._id,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: newRole._id.toString(),
      after: newRole.toObject()
    });

    res.status(201).json({ role: newRole, message: 'Роль успішно створено' });
  } catch (err) {
    next(err);
  }
});

// 4. Update an existing role
rolesRouter.put('/roles/:key', requirePermission('roles.manage'), validateRequest(UpdateRoleSchema), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { title, description, permissions } = req.body;

    const existing = await Role.findOne({ key });
    if (!existing) {
      return res.status(404).json({ error: 'Роль не знайдено' });
    }

    const before = existing.toObject();

    existing.title = title.trim();
    if (description !== undefined) existing.description = description.trim();
    existing.permissions = permissions;

    await existing.save();

    await auditService.log({
      actorId: (req as any).user._id,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: existing._id.toString(),
      before,
      after: existing.toObject()
    });

    res.json({ role: existing, message: 'Роль успішно оновлено' });
  } catch (err) {
    next(err);
  }
});

// 5. Delete a custom role
rolesRouter.delete('/roles/:key', requirePermission('roles.manage'), async (req, res, next) => {
  try {
    const { key } = req.params;

    const role = await Role.findOne({ key });
    if (!role) {
      return res.status(404).json({ error: 'Роль не знайдено' });
    }

    if (role.isSystem) {
      return res.status(400).json({ error: 'Системні ролі не можуть бути видалені' });
    }

    const before = role.toObject();
    await Role.deleteOne({ key });

    // Clean up users that have this roleKey
    const affectedUsers = await User.find({ roleKeys: key });
    for (const u of affectedUsers) {
      u.roleKeys = (u.roleKeys || []).filter((k: string) => k !== key);
      if (u.roleKeys.length === 0) {
        u.roleKeys = ['employee'];
      }
      await u.save();
    }

    await auditService.log({
      actorId: (req as any).user._id,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: role._id.toString(),
      before
    });

    res.json({ success: true, message: `Роль "${role.title}" видалено` });
  } catch (err) {
    next(err);
  }
});
