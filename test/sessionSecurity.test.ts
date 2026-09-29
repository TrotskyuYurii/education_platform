import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { sessionCookieOptions, resolveJwtSecret, issueSessionCookie } from '../server/modules/core/session.js';
import { describeDbError, nextRetryDelay } from '../server/db.js';

const req = (opts: { secure?: boolean; proto?: string } = {}) =>
  ({ secure: Boolean(opts.secure), headers: opts.proto ? { 'x-forwarded-proto': opts.proto } : {} }) as any;

describe('session cookie options', () => {
  it('is SameSite=Lax and httpOnly (no cross-site CSRF)', () => {
    const o = sessionCookieOptions(req({ secure: true }), {});
    expect(o.sameSite).toBe('lax');
    expect(o.httpOnly).toBe(true);
  });

  it('sets Secure over https and behind an https proxy', () => {
    expect(sessionCookieOptions(req({ secure: true }), {}).secure).toBe(true);
    expect(sessionCookieOptions(req({ proto: 'https' }), {}).secure).toBe(true);
  });

  it('omits Secure over plain http so the browser keeps the cookie', () => {
    expect(sessionCookieOptions(req(), {}).secure).toBe(false);
    expect(sessionCookieOptions(req({ proto: 'http' }), {}).secure).toBe(false);
  });

  it('honours COOKIE_SECURE override', () => {
    expect(sessionCookieOptions(req(), { COOKIE_SECURE: 'true' }).secure).toBe(true);
    expect(sessionCookieOptions(req({ secure: true }), { COOKIE_SECURE: 'false' }).secure).toBe(false);
  });
});

describe('JWT secret', () => {
  it('uses a strong configured secret', () => {
    const s = 'x'.repeat(40);
    expect(resolveJwtSecret({ JWT_SECRET: s })).toBe(s);
  });

  it('refuses to start in production without a strong secret', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow();
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow();
  });

  it('never falls back to a hard-coded secret in development', () => {
    const a = resolveJwtSecret({});
    const b = resolveJwtSecret({});
    expect(a).not.toBe('fallback_secret_key');
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(a).not.toBe(b);
  });
});

describe('DB connection diagnostics', () => {
  it('recognises SRV DNS failures', () => {
    expect(describeDbError({ code: 'ECONNREFUSED', message: 'querySrv ECONNREFUSED _mongodb._tcp.cluster0.x.mongodb.net' }))
      .toMatch(/DNS/);
  });

  it('recognises unreachable cluster / IP access list', () => {
    expect(describeDbError({ name: 'MongooseServerSelectionError', message: 'Could not connect to any servers' }))
      .toMatch(/Network Access/);
  });

  it('recognises bad credentials', () => {
    expect(describeDbError({ message: 'bad auth : Authentication failed.' })).toMatch(/логін/);
  });

  it('backs off exponentially up to a cap', () => {
    expect(nextRetryDelay(1)).toBe(5000);
    expect(nextRetryDelay(2)).toBe(10000);
    expect(nextRetryDelay(3)).toBe(20000);
    expect(nextRetryDelay(10)).toBe(60000);
  });
});

describe('Set-Cookie header', () => {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/login', (req, res) => {
    issueSessionCookie(res, { _id: '64b000000000000000000001', role: 'user' });
    res.json({ ok: true });
  });

  it('plain http (internal IP, no TLS): cookie without Secure, SameSite=Lax', async () => {
    const res = await request(app).post('/login');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('https via reverse proxy: cookie with Secure', async () => {
    const res = await request(app).post('/login').set('X-Forwarded-Proto', 'https');
    expect(String(res.headers['set-cookie'])).toMatch(/Secure/);
  });
});
