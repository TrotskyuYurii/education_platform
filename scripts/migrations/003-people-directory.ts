import { logger } from '../../server/modules/core/logger.js';
import { User } from '../../server/models.js';

// Крок 10 (Люди: довідник і оргструктура): `isActive`/`customFields` were added to
// the User schema in an earlier step but never backfilled onto existing documents.
// Mongoose applies schema defaults in-memory on read, but raw aggregations/exports
// only see fields that are actually stored — this backfill makes them real.
export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 003-people-directory`);

  const usersMissingIsActive = await User.find({ isActive: { $exists: false } });
  const usersMissingCustomFields = await User.find({ customFields: { $exists: false } });

  logger.info(`Found ${usersMissingIsActive.length} users missing isActive, ${usersMissingCustomFields.length} missing customFields`);

  if (!isDryRun) {
    if (usersMissingIsActive.length > 0) {
      await User.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
    }
    if (usersMissingCustomFields.length > 0) {
      await User.updateMany({ customFields: { $exists: false } }, { $set: { customFields: {} } });
    }
  }

  logger.info(`Migration 003-people-directory completed. Backfilled ${usersMissingIsActive.length} isActive, ${usersMissingCustomFields.length} customFields.`);
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 003-people-directory`);
  logger.info('No-op: backfilling safe defaults is not reverted.');
}
