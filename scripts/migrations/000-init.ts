import { logger } from '../../server/modules/core/logger.js';
import { FeatureFlag } from '../../server/modules/core/models.js';

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 000-init`);

  const initialFlag = {
    key: 'new_org_structure',
    enabled: false,
    description: 'Enables new organization directory and profile features'
  };

  const existing = await FeatureFlag.findOne({ key: initialFlag.key });
  if (existing) {
    logger.info(`Feature flag ${initialFlag.key} already exists. Skipping.`);
    return;
  }

  if (isDryRun) {
    logger.info(`[DRY-RUN] Would create feature flag: '${initialFlag.key}'`);
  } else {
    await FeatureFlag.create(initialFlag);
    logger.info(`Created feature flag: '${initialFlag.key}'`);
  }
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 000-init`);
  
  if (isDryRun) {
    logger.info(`[DRY-RUN] Would delete feature flag 'new_org_structure'`);
  } else {
    await FeatureFlag.deleteOne({ key: 'new_org_structure' });
    logger.info(`Deleted feature flag 'new_org_structure'`);
  }
}
