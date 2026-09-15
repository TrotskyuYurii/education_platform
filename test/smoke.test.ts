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

// Use a temporary database name for testing
const TEST_MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_test';

describe('Smoke Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_MONGO_URI);
    await FeatureFlag.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

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
