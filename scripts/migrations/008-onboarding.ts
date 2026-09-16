import { logger } from '../../server/modules/core/logger.js';
import { Role } from '../../server/models.js';
import { NotificationTemplate } from '../../server/modules/notifications/models.js';
import {
  OnboardingTemplate,
  OnboardingAssignment,
  OnboardingStepProgress
} from '../../server/modules/onboarding/models.js';

/**
 * Онбординг співробітника: шаблони сповіщень, права для наявних ролей
 * та індекси колекцій. Ідемпотентна — повторний запуск лише доповнює.
 */

const ONBOARDING_TEMPLATES = [
  {
    type: 'onboarding_assigned',
    title: 'Призначено онбординг',
    titleTemplate: 'Вам призначено онбординг',
    bodyTemplate: '🚀 Вітаємо в команді! Вам призначено онбординг «{{templateName}}»: {{stepsCount}} кроків, завершити до {{dueDate}}. Відкрийте розділ «Онбординг», щоб почати.',
    defaultChannels: ['in_app', 'email'],
    isCritical: true
  },
  {
    type: 'onboarding_buddy_assigned',
    title: 'Вас призначено наставником',
    titleTemplate: 'Вас призначено наставником',
    bodyTemplate: '🤝 Вас призначено наставником для {{employeeName}} на час онбордінгу «{{templateName}}». Ваші кроки з\'являться у розділі «Мій день».',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'onboarding_step_unlocked',
    title: 'Відкрито новий крок онбордінгу',
    titleTemplate: 'Відкрито новий крок онбордінгу',
    bodyTemplate: '✅ Наступний крок доступний: «{{stepTitle}}» ({{templateName}}). Виконати до {{dueDate}}.',
    defaultChannels: ['in_app'],
    isCritical: false
  },
  {
    type: 'onboarding_step_task',
    title: 'Задача з онбордінгу для вас',
    titleTemplate: 'Задача з онбордінгу',
    bodyTemplate: '📌 Для {{employeeName}} потрібно виконати крок «{{stepTitle}}» ({{templateName}}). Строк: {{dueDate}}.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'onboarding_step_due',
    title: 'Наближається дедлайн кроку онбордінгу',
    titleTemplate: 'Наближається дедлайн кроку',
    bodyTemplate: '🔔 Крок «{{stepTitle}}» ({{templateName}}) треба завершити до {{dueDate}}.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'onboarding_overdue',
    title: 'Онбординг прострочено',
    titleTemplate: 'Онбординг прострочено',
    bodyTemplate: '⏰ Строк онбордінгу «{{templateName}}» минув, а частина кроків ще не завершена. Будь ласка, завершіть їх найближчим часом.',
    defaultChannels: ['in_app', 'email'],
    isCritical: true
  },
  {
    type: 'onboarding_overdue_manager',
    title: 'Онбординг співробітника прострочено',
    titleTemplate: 'Онбординг співробітника прострочено',
    bodyTemplate: '⚠️ Онбординг «{{templateName}}» для {{employeeName}} прострочено. Варто з\'ясувати, що заважає завершити адаптацію.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'onboarding_completed',
    title: 'Онбординг завершено',
    titleTemplate: 'Онбординг завершено',
    bodyTemplate: '🎉 Вітаємо! Ви повністю завершили онбординг «{{templateName}}». Успіхів у роботі!',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'onboarding_completed_manager',
    title: 'Співробітник завершив онбординг',
    titleTemplate: 'Співробітник завершив онбординг',
    bodyTemplate: '🎯 {{employeeName}} завершив(ла) онбординг «{{templateName}}».',
    defaultChannels: ['in_app'],
    isCritical: false
  },
  {
    type: 'onboarding_survey_request',
    title: 'Опитування про адаптацію',
    titleTemplate: 'Поділіться враженнями про адаптацію',
    bodyTemplate: '💬 Минуло {{dayOffset}} дн. від початку онбордінгу «{{templateName}}». Будь ласка, пройдіть коротке опитування — це займе хвилину і допоможе покращити адаптацію наступних новачків.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  }
];

// Хто за замовчуванням отримує нові права. Адміністратор має все через bypass.
const ROLE_PERMISSION_GRANTS: Record<string, { permission: string; scope: string }[]> = {
  hr: [
    { permission: 'onboarding.template.manage', scope: 'all' },
    { permission: 'onboarding.assignment.create', scope: 'all' },
    { permission: 'onboarding.assignment.view', scope: 'all' }
  ],
  manager: [
    { permission: 'onboarding.assignment.create', scope: 'team' },
    { permission: 'onboarding.assignment.view', scope: 'team' }
  ],
  employee: [
    { permission: 'onboarding.assignment.view', scope: 'self' }
  ]
};

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 008-onboarding`);

  let templatesCreated = 0;
  for (const tpl of ONBOARDING_TEMPLATES) {
    const existing = await NotificationTemplate.findOne({ type: tpl.type });
    if (existing) continue;
    if (isDryRun) {
      logger.info(`[DRY-RUN] Would create notification template '${tpl.type}'`);
    } else {
      await NotificationTemplate.create(tpl);
    }
    templatesCreated++;
  }
  logger.info(`Notification templates created: ${templatesCreated}`);

  let grantsAdded = 0;
  for (const [roleKey, grants] of Object.entries(ROLE_PERMISSION_GRANTS)) {
    const role = await Role.findOne({ key: roleKey });
    if (!role) {
      logger.warn(`Role '${roleKey}' not found, skipping onboarding grants`);
      continue;
    }
    for (const grant of grants) {
      const alreadyHas = (role.permissions || []).some((p: any) => p.permission === grant.permission);
      if (alreadyHas) continue;
      if (isDryRun) {
        logger.info(`[DRY-RUN] Would grant ${grant.permission}:${grant.scope} to role '${roleKey}'`);
      } else {
        role.permissions.push(grant);
      }
      grantsAdded++;
    }
    if (!isDryRun && role.isModified('permissions')) {
      await role.save();
    }
  }
  logger.info(`Onboarding permission grants added: ${grantsAdded}`);

  if (!isDryRun) {
    await OnboardingTemplate.syncIndexes();
    await OnboardingAssignment.syncIndexes();
    await OnboardingStepProgress.syncIndexes();
    logger.info('Onboarding indexes synced');
  }

  logger.info('Migration 008-onboarding completed.');
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 008-onboarding`);
  const types = ONBOARDING_TEMPLATES.map(t => t.type);
  const onboardingPermissions = [
    'onboarding.template.manage',
    'onboarding.assignment.create',
    'onboarding.assignment.view'
  ];

  if (isDryRun) {
    const count = await NotificationTemplate.countDocuments({ type: { $in: types } });
    logger.info(`[DRY-RUN] Would delete ${count} onboarding notification templates and revoke onboarding grants`);
    return;
  }

  await NotificationTemplate.deleteMany({ type: { $in: types } });
  await Role.updateMany(
    {},
    { $pull: { permissions: { permission: { $in: onboardingPermissions } } } }
  );
  logger.info('Rolled back 008-onboarding (onboarding data collections left intact)');
}
