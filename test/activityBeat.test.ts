import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import 'dotenv/config';
import { UserDailyUsage } from '../server/modules/activity/models.js';
import { ActivityDashboardService } from '../server/modules/activity/dashboard.js';
import { USAGE_BEAT_BASE_CREDIT_SEC } from '../shared/activityDashboard.js';

/**
 * Пульс сесії записує час у UserDailyUsage одним pipeline-оновленням. Mongoose 9
 * такі оновлення без updatePipeline відхиляє, а recordBeat помилку ковтає — тож
 * без цього тесту облік часу мовчки перестає працювати.
 */
const TEST_DB_NAME = 'viatec_activity_beat_test';

function withDatabase(uri: string, dbName: string): string {
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${dbName}${query ? `?${query}` : ''}`;
}

const mongoUri = process.env.MONGODB_URI;
const hasDatabase = Boolean(mongoUri);

beforeAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connect(withDatabase(mongoUri!, TEST_DB_NAME));
  await mongoose.connection.db!.dropDatabase();
}, 30000);

afterAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connection.db!.dropDatabase();
  await mongoose.connection.close();
}, 30000);

beforeEach(async () => {
  if (!hasDatabase) return;
  await UserDailyUsage.deleteMany({});
});

describe.skipIf(!hasDatabase)('ActivityDashboardService.recordBeat', () => {
  it('створює запис дня з базовим зарахуванням на першому пульсі', async () => {
    const userId = new mongoose.Types.ObjectId();
    await ActivityDashboardService.recordBeat(userId);

    const usage = await UserDailyUsage.findOne({ userId }).lean() as any;
    expect(usage).toBeTruthy();
    expect(usage.beats).toBe(1);
    expect(usage.seconds).toBe(USAGE_BEAT_BASE_CREDIT_SEC);
    expect(usage.lastBeatAt).toBeInstanceOf(Date);
  });

  it('наступні пульси додаються до того самого запису', async () => {
    const userId = new mongoose.Types.ObjectId();
    await ActivityDashboardService.recordBeat(userId);
    await ActivityDashboardService.recordBeat(userId);

    const docs = await UserDailyUsage.find({ userId }).lean() as any[];
    expect(docs).toHaveLength(1);
    expect(docs[0].beats).toBe(2);
    expect(docs[0].seconds).toBeGreaterThanOrEqual(USAGE_BEAT_BASE_CREDIT_SEC);
  });
});
