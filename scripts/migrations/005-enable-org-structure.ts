import { logger } from '../../server/modules/core/logger.js';
import { FeatureFlag } from '../../server/modules/core/models.js';

// Довідники підрозділів/посад/локацій (Крок 1) давно стабільні й від них уже
// напряму залежить розділ "Люди" (Крок 10) — тримати екран керування ними
// вимкненим за флагом більше не має сенсу. Вмикаємо його як стандартну
// функціональність. Сам компонент (OrganizationSettings.tsx) більше не
// перевіряє цей флаг, це вмикання — лише щоб не залишати БД у застарілому
// стані ("enabled: false"), якщо щось інше колись на нього спиратиметься.
const FLAG_KEY = 'new_org_structure';

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 005-enable-org-structure`);

  const existing = await FeatureFlag.findOne({ key: FLAG_KEY });

  if (!existing) {
    if (isDryRun) {
      logger.info(`[DRY-RUN] Would create feature flag '${FLAG_KEY}' as enabled`);
    } else {
      await FeatureFlag.create({ key: FLAG_KEY, enabled: true, description: 'Enables the organization directory and profile features' });
      logger.info(`Created feature flag '${FLAG_KEY}' as enabled`);
    }
    return;
  }

  if (existing.enabled) {
    logger.info(`Feature flag '${FLAG_KEY}' is already enabled. Skipping.`);
    return;
  }

  if (isDryRun) {
    logger.info(`[DRY-RUN] Would enable feature flag '${FLAG_KEY}'`);
  } else {
    await FeatureFlag.updateOne({ key: FLAG_KEY }, { $set: { enabled: true } });
    logger.info(`Enabled feature flag '${FLAG_KEY}'`);
  }
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 005-enable-org-structure`);
  if (isDryRun) {
    logger.info(`[DRY-RUN] Would disable feature flag '${FLAG_KEY}'`);
  } else {
    await FeatureFlag.updateOne({ key: FLAG_KEY }, { $set: { enabled: false } });
    logger.info(`Disabled feature flag '${FLAG_KEY}'`);
  }
}
