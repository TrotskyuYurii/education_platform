import { Request, Response, NextFunction } from 'express';
import { Role, User } from '../../models.js';
import { PermissionScope, SCOPE_LABELS } from '../roles/catalog.js';

export const resolveUserRoleKeys = (user: any): string[] => {
  if (user && Array.isArray(user.roleKeys) && user.roleKeys.length > 0) {
    return user.roleKeys;
  }
  if (user && user.role === 'admin') {
    return ['admin'];
  }
  return ['employee'];
};

export const isAdministrator = (user: any): boolean =>
  Boolean(user) && (user.role === 'admin' || resolveUserRoleKeys(user).includes('admin'));

/**
 * Доступ лише для ролі «Адміністратор» — без права, яке можна видати іншій ролі
 * через матрицю. Для даних, що стосуються стеження за людьми (журнал дій),
 * навмисно не даємо делегувати перегляд керівникам чи HR.
 */
export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isAdministrator(user)) {
    return res.status(403).json({ error: 'Доступ дозволено лише користувачам з роллю «Адміністратор»' });
  }
  next();
};

export const requirePermission = (permission: string, minScope?: PermissionScope) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const roleKeys = resolveUserRoleKeys(user);

      // Superadmin bypass
      if (user.role === 'admin' || roleKeys.includes('admin')) {
        return next();
      }

      const roles = await Role.find({ key: { $in: roleKeys } });
      
      const scopeRank: Record<PermissionScope, number> = {
        self: 1,
        team: 2,
        department: 3,
        all: 4
      };

      let maxGrantedRank = 0;
      for (const r of roles) {
        for (const p of r.permissions || []) {
          if (p.permission === permission) {
            const rank = scopeRank[p.scope as PermissionScope] || 0;
            if (rank > maxGrantedRank) {
              maxGrantedRank = rank;
            }
          }
        }
      }

      if (maxGrantedRank === 0) {
        return res.status(403).json({ 
          error: `Доступ заборонено. Відсутнє право: ${permission}`,
          permission 
        });
      }

      if (minScope) {
        const requiredRank = scopeRank[minScope] || 1;
        if (maxGrantedRank < requiredRank) {
          return res.status(403).json({ 
            error: `Недостатній рівень доступу для: ${permission}. Потрібен: ${SCOPE_LABELS[minScope]?.label || minScope}`,
            permission,
            minScope 
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const getUserEffectivePermissions = async (user: any) => {
  const roleKeys = resolveUserRoleKeys(user);
  const isAdmin = user.role === 'admin' || roleKeys.includes('admin');

  if (isAdmin) {
    return {
      isAdmin: true,
      roleKeys,
      permissions: {
        'admin.access': 'all',
        'roles.manage': 'all',
        'users.profile.view': 'all',
        'users.profile.edit': 'all',
        'org.manage': 'all',
        'knowledge.article.publish': 'all',
        'learning.assignment.view': 'all',
        'learning.assignment.create': 'all',
        'onboarding.template.manage': 'all',
        'onboarding.assignment.create': 'all',
        'onboarding.assignment.view': 'all',
        'analytics.report.view': 'all',
        'certificate.revoke': 'all'
      }
    };
  }

  const roles = await Role.find({ key: { $in: roleKeys } });
  const permissions: Record<string, PermissionScope> = {};
  
  const scopeRank: Record<PermissionScope, number> = {
    self: 1,
    team: 2,
    department: 3,
    all: 4
  };

  for (const r of roles) {
    for (const p of r.permissions || []) {
      const currentScope = permissions[p.permission];
      if (!currentScope || (scopeRank[p.scope as PermissionScope] || 0) > (scopeRank[currentScope] || 0)) {
        permissions[p.permission] = p.scope as PermissionScope;
      }
    }
  }

  return {
    isAdmin: false,
    roleKeys,
    permissions
  };
};

export const scopeFilter = async (user: any, permission: string) => {
  const roleKeys = resolveUserRoleKeys(user);
  if (user.role === 'admin' || roleKeys.includes('admin')) {
    return {}; // All access
  }

  const roles = await Role.find({ key: { $in: roleKeys } });
  
  const scopes: PermissionScope[] = ['self', 'team', 'department', 'all'];
  let maxScopeIdx = -1;

  for (const r of roles) {
    for (const p of r.permissions || []) {
      if (p.permission === permission) {
        const idx = scopes.indexOf(p.scope as PermissionScope);
        if (idx > maxScopeIdx) maxScopeIdx = idx;
      }
    }
  }

  if (maxScopeIdx === -1) return { _id: null }; // No access
  const maxScope = scopes[maxScopeIdx];

  switch (maxScope) {
    case 'all': 
      return {};
    case 'department': 
      return user.departmentId ? { departmentId: user.departmentId } : { _id: null };
    case 'team': 
      // User can see themselves and anyone who has them as manager
      return { $or: [{ _id: user._id }, { managerId: user._id }] };
    case 'self': 
      return { _id: user._id };
    default: 
      return { _id: null };
  }
};

// Same scope logic as scopeFilter, evaluated against a single already-loaded target
// document instead of turned into a Mongo query. Used where the target is fetched
// once and we need a plain boolean (e.g. deciding what to render/allow for it).
export const isUserInScope = async (viewer: any, target: any, permission: string): Promise<boolean> => {
  const roleKeys = resolveUserRoleKeys(viewer);
  if (viewer.role === 'admin' || roleKeys.includes('admin')) return true;

  // No blanket "it's my own record" shortcut here: whether a viewer may act on
  // themselves must come from an actual granted scope for `permission` (mirrors
  // scopeFilter, where 'self' scope's {_id: viewer._id} filter is what makes
  // self-access work — a role with NO grant for this permission, e.g. the plain
  // 'employee' role and 'users.profile.edit', must not be treated as in-scope
  // just because the target happens to be the viewer).
  const roles = await Role.find({ key: { $in: roleKeys } });
  const scopes: PermissionScope[] = ['self', 'team', 'department', 'all'];
  let maxScopeIdx = -1;
  for (const r of roles) {
    for (const p of r.permissions || []) {
      if (p.permission === permission) {
        const idx = scopes.indexOf(p.scope as PermissionScope);
        if (idx > maxScopeIdx) maxScopeIdx = idx;
      }
    }
  }
  if (maxScopeIdx === -1) return false;
  const maxScope = scopes[maxScopeIdx];

  switch (maxScope) {
    case 'all':
      return true;
    case 'department':
      return Boolean(viewer.departmentId) && String(viewer.departmentId) === String(target.departmentId);
    case 'team':
      return String(target._id) === String(viewer._id) || (Boolean(target.managerId) && String(target.managerId) === String(viewer._id));
    case 'self':
      return String(target._id) === String(viewer._id);
    default:
      return false;
  }
};

export const getProgressScopeFilter = async (user: any, permission: string) => {
  const userFilter = await scopeFilter(user, permission);
  
  // If userFilter is empty, means all access
  if (Object.keys(userFilter).length === 0) {
    return {};
  }
  
  // If userFilter explicitly denies
  if (userFilter._id === null) {
    return { userId: null };
  }

  // If filtered to self
  if (userFilter._id && Object.keys(userFilter).length === 1) {
    return { userId: userFilter._id };
  }

  // Otherwise query matching user IDs
  const matchingUsers = await User.find(userFilter).select('_id');
  const userIds = matchingUsers.map(u => u._id);
  return { userId: { $in: userIds } };
};
