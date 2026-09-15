import { logger } from '../../server/modules/core/logger.js';
import { NotificationTemplate } from '../../server/modules/notifications/models.js';

// Крок 11 (Сповіщення як сервіс): seeds the default NotificationTemplate for every
// type NotificationService.send() can be called with. Idempotent — upserts by `type`,
// so re-running only fills in templates that are still missing.
const DEFAULT_TEMPLATES = [
  {
    type: 'assignment_new',
    title: 'Нове призначення навчання',
    titleTemplate: 'Нове призначення навчання',
    bodyTemplate: 'Вам призначено навчання: «{{title}}». Дедлайн: до {{dueDate}}.{{notesLine}}',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'assignment_reminder',
    title: 'Наближається дедлайн навчання',
    titleTemplate: 'Наближається дедлайн навчання',
    bodyTemplate: '🔔 Нагадування{{senderLine}}: наближається дедлайн вивчення «{{title}}» (до {{dueDate}}). Будь ласка, завершіть матеріал!',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'assignment_overdue',
    title: 'Прострочено навчальне завдання',
    titleTemplate: 'Прострочено навчальне завдання',
    bodyTemplate: '⏰ Термін виконання «{{title}}» минув. Будь ласка, завершіть навчання якнайшвидше.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'course_completed',
    title: 'Курс завершено',
    titleTemplate: 'Курс завершено',
    bodyTemplate: '🎉 Вітаємо! Ви успішно завершили курс «{{courseTitle}}».',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'certificate_issued',
    title: 'Сертифікат видано',
    titleTemplate: 'Сертифікат видано',
    bodyTemplate: '🏆 Вам видано сертифікат за курс «{{courseTitle}}».',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'certificate_expiring',
    title: 'Сертифікат незабаром спливає',
    titleTemplate: 'Сертифікат незабаром спливає',
    bodyTemplate: '⚠️ Ваш сертифікат за курс «{{courseTitle}}» спливає через {{daysLeft}} дн. Будь ласка, пройдіть переатестацію.',
    defaultChannels: ['in_app', 'email'],
    isCritical: false
  },
  {
    type: 'certificate_revoked',
    title: 'Сертифікат анульовано',
    titleTemplate: 'Сертифікат анульовано',
    bodyTemplate: 'Ваш сертифікат за курс «{{courseTitle}}» був анульований адміністратором.',
    defaultChannels: ['in_app', 'email'],
    isCritical: true
  },
  {
    type: 'acknowledgement_confirmed',
    title: 'Ознайомлення підтверджено',
    titleTemplate: 'Ознайомлення підтверджено',
    bodyTemplate: '✅ Дякуємо! Ваше ознайомлення з внутрішніми правилами зафіксовано.',
    defaultChannels: ['in_app'],
    isCritical: false
  }
];

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 004-notification-templates`);

  let created = 0;
  let alreadyExisted = 0;

  for (const tpl of DEFAULT_TEMPLATES) {
    const existing = await NotificationTemplate.findOne({ type: tpl.type });
    if (existing) {
      alreadyExisted++;
      continue;
    }
    if (isDryRun) {
      logger.info(`[DRY-RUN] Would create template: '${tpl.type}'`);
    } else {
      await NotificationTemplate.create(tpl);
      logger.info(`Created template: '${tpl.type}'`);
    }
    created++;
  }

  logger.info(`Migration 004-notification-templates completed. Created ${created}, already existed ${alreadyExisted}.`);
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 004-notification-templates`);
  const types = DEFAULT_TEMPLATES.map(t => t.type);
  if (isDryRun) {
    const count = await NotificationTemplate.countDocuments({ type: { $in: types } });
    logger.info(`[DRY-RUN] Would delete ${count} default templates`);
  } else {
    await NotificationTemplate.deleteMany({ type: { $in: types } });
    logger.info('Deleted default templates');
  }
}
