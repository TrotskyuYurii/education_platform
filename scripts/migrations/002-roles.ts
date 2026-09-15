import { logger } from '../../server/modules/core/logger.js';
import { User, Role } from '../../server/models.js';

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 002-roles`);

  const rolesToCreate = [
    {
      key: 'admin',
      title: 'Адміністратор',
      isSystem: true,
      permissions: [
        { permission: 'admin.access', scope: 'all' },
        { permission: 'users.profile.edit', scope: 'all' },
        { permission: 'knowledge.article.publish', scope: 'all' },
        { permission: 'learning.assignment.create', scope: 'all' },
        { permission: 'analytics.report.view', scope: 'all' },
        { permission: 'certificate.revoke', scope: 'all' }
      ]
    },
    {
      key: 'employee',
      title: 'Співробітник',
      isSystem: true,
      permissions: [
        { permission: 'users.profile.view', scope: 'self' },
        { permission: 'learning.assignment.view', scope: 'self' }
      ]
    },
    {
      key: 'manager',
      title: 'Керівник',
      isSystem: false,
      permissions: [
        { permission: 'users.profile.view', scope: 'team' },
        { permission: 'analytics.report.view', scope: 'team' },
        { permission: 'learning.assignment.create', scope: 'team' }
      ]
    },
    {
      key: 'hr',
      title: 'HR',
      isSystem: false,
      permissions: [
        { permission: 'users.profile.edit', scope: 'all' },
        { permission: 'analytics.report.view', scope: 'all' },
        { permission: 'certificate.revoke', scope: 'all' }
      ]
    },
    {
      key: 'contentManager',
      title: 'Контент-менеджер',
      isSystem: false,
      permissions: [
        { permission: 'knowledge.article.publish', scope: 'all' }
      ]
    }
  ];

  let rolesCreated = 0;
  for (const roleDef of rolesToCreate) {
    const existing = await Role.findOne({ key: roleDef.key });
    if (!existing) {
      if (isDryRun) {
        logger.info(`[DRY-RUN] Would create role: ${roleDef.key}`);
      } else {
        await Role.create(roleDef);
        logger.info(`Created role: ${roleDef.key}`);
      }
      rolesCreated++;
    }
  }

  // Migrate existing users
  const users = await User.find({});
  let usersMigrated = 0;

  for (const u of users as any[]) {
    let changed = false;
    if (!u.roleKeys || u.roleKeys.length === 0) {
      if (u.role === 'admin') {
        u.roleKeys = ['admin'];
      } else {
        u.roleKeys = ['employee'];
      }
      changed = true;
    }

    if (changed) {
      if (isDryRun) {
        logger.info(`[DRY-RUN] Would map user ${u.email} to roleKeys: ${u.roleKeys.join(', ')}`);
      } else {
        await u.save();
      }
      usersMigrated++;
    }
  }

  logger.info(`Migration 002-roles completed. Created ${rolesCreated} roles, migrated ${usersMigrated} users.`);
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 002-roles`);
  
  if (isDryRun) {
    logger.info(`[DRY-RUN] Would remove roleKeys from all users and delete roles`);
  } else {
    await User.updateMany({}, { $unset: { roleKeys: "" } });
    await Role.deleteMany({});
    logger.info(`Removed roleKeys and all roles`);
  }
}
