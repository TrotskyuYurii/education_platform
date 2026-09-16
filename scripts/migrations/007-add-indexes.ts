import { logger } from '../../server/modules/core/logger.js';
import { User, Progress } from '../../server/models.js';
import { CertificateRecord } from '../../server/modules/learning/models.js';

// Крок 14 (продуктивність): Mongoose builds indexes declared on a schema
// automatically in the background on connect, but we call createIndexes()
// explicitly here so the build is synchronous, verifiable, and recorded in
// migration history rather than a silent background operation.
export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 007-add-indexes`);

  if (isDryRun) {
    logger.info('[DRY-RUN] Would ensure indexes on User (departmentId, managerId), Progress (userId), CertificateRecord (status+expiresAt)');
    return;
  }

  await User.createIndexes();
  await Progress.createIndexes();
  await CertificateRecord.createIndexes();

  logger.info('Migration 007-add-indexes completed — indexes built for User, Progress, CertificateRecord.');
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 007-add-indexes: no-op (dropping indexes is not worth the risk of a bad rollback).`);
}
