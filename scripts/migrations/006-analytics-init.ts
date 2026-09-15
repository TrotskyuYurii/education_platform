import { logger } from '../../server/modules/core/logger.js';

// Крок 12 (Аналітика та звіти): no data to backfill — `SearchQueryLog` starts
// empty and `Section.viewsCount` defaults to 0 for every document via the
// schema default (Mongoose applies it on read even for pre-existing docs).
// This migration exists only to mark the step as applied in migration history.
export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Migration 006-analytics-init: nothing to backfill, marking as applied.`);
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 006-analytics-init: no-op.`);
}
