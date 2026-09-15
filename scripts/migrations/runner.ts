import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../server/modules/core/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const MigrationRunSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  runAt: { type: Date, default: Date.now }
});

const MigrationRun = mongoose.models.MigrationRun || mongoose.model('MigrationRun', MigrationRunSchema);

async function runMigrations() {
  const isDryRun = process.argv.includes('--dry-run');
  logger.info(`Starting migrations... Dry run: ${isDryRun}`);

  if (!process.env.MONGODB_URI) {
    logger.error('No MONGODB_URI provided in environment');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to database.');

  const migrationsDir = path.join(process.cwd(), 'scripts', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.ts') && f !== 'runner.ts')
    .sort();

  for (const file of files) {
    const migrationName = file.replace(/\.ts$/, '');
    const alreadyRun = await MigrationRun.findOne({ name: migrationName });

    if (alreadyRun) {
      logger.info(`Skipping ${migrationName}, already run.`);
      continue;
    }

    logger.info(`Running migration: ${migrationName}`);
    try {
      const migrationModule = await import(path.join(migrationsDir, file));
      if (migrationModule.up) {
        await migrationModule.up(isDryRun);
        if (!isDryRun) {
          await MigrationRun.create({ name: migrationName });
          logger.info(`Migration ${migrationName} completed and recorded.`);
        } else {
          logger.info(`[DRY-RUN] Migration ${migrationName} completed. Not recording.`);
        }
      }
    } catch (err) {
      logger.error({ err }, `Error running migration ${migrationName}`);
      process.exit(1);
    }
  }

  logger.info('All migrations finished.');
  process.exit(0);
}

runMigrations();
