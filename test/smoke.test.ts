import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { FeatureFlag } from '../server/modules/core/models.js';
import mongoose from 'mongoose';
import 'dotenv/config';

// Simple mock app for testing core endpoints
const app = express();
app.use(express.json());

app.get('/api/core/features', async (req, res) => {
  try {
    const flags = await FeatureFlag.find({});
    const flagsMap = flags.reduce((acc: any, flag) => {
      acc[flag.key] = flag.enabled;
      return acc;
    }, {});
    res.json({ flags: flagsMap });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/**
 * Тест чистить колекції, тому він МУСИТЬ працювати у власній базі.
 * MONGODB_URI вказує на робочий кластер (і зазвичай взагалі без імені бази —
 * тоді драйвер бере базу за замовчуванням, тобто саме ту, де живуть інструкції),
 * тож ім'я бази підставляємо самі, а не покладаємось на оточення.
 */
const TEST_DB_NAME = 'viatec_smoke_test';

function testDatabaseUri(): string {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${TEST_DB_NAME}${query ? `?${query}` : ''}`;
}

describe('Smoke Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(testDatabaseUri());

    // Остання лінія оборони: не чистити нічого, крім своєї бази
    const dbName = mongoose.connection.db?.databaseName;
    if (dbName !== TEST_DB_NAME) {
      throw new Error(`Тест відмовляється працювати з базою "${dbName}" — очікувалась "${TEST_DB_NAME}"`);
    }

    await FeatureFlag.deleteMany({});
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.db?.databaseName === TEST_DB_NAME) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.connection.close();
  }, 30000);

  it('should return 200 and empty flags map', async () => {
    const res = await request(app).get('/api/core/features');
    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual({});
  });

  it('should return feature flags when they exist', async () => {
    await FeatureFlag.create({ key: 'test_flag', enabled: true, description: 'test' });
    const res = await request(app).get('/api/core/features');
    expect(res.status).toBe(200);
    expect(res.body.flags.test_flag).toBe(true);
  });
});
