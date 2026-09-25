import { describe, it, expect } from 'vitest';

import {
  usageCreditSeconds,
  USAGE_BEAT_BASE_CREDIT_SEC,
  USAGE_BEAT_MAX_GAP_SEC,
  listDays,
  shiftDay,
  resolveActivityPeriod,
  deltaPercent,
  formatUsageTime,
  ACTIVITY_DASHBOARD_MAX_DAYS
} from '../shared/activityDashboard.js';

describe('usageCreditSeconds', () => {
  it('перший пульс і пульс після довгої перерви дають базову хвилину', () => {
    expect(usageCreditSeconds(null)).toBe(USAGE_BEAT_BASE_CREDIT_SEC);
    expect(usageCreditSeconds(USAGE_BEAT_MAX_GAP_SEC + 1)).toBe(USAGE_BEAT_BASE_CREDIT_SEC);
    expect(usageCreditSeconds(3 * 60 * 60)).toBe(USAGE_BEAT_BASE_CREDIT_SEC);
  });

  it('безперервна робота зараховується повністю', () => {
    expect(usageCreditSeconds(62.4)).toBe(62);
    expect(usageCreditSeconds(USAGE_BEAT_MAX_GAP_SEC)).toBe(USAGE_BEAT_MAX_GAP_SEC);
  });

  it('пульси з двох вкладок не подвоюють час', () => {
    expect(usageCreditSeconds(4)).toBe(4);
    expect(usageCreditSeconds(-3)).toBe(0);
  });
});

describe('періоди', () => {
  it('перелічує дні включно й коректно переходить через місяць', () => {
    expect(listDays('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(listDays('2026-03-02', '2026-03-01')).toEqual([]);
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('за замовчуванням бере останні 30 днів і попередній такий самий період', () => {
    const p = resolveActivityPeriod(undefined, undefined, '2026-09-25');
    expect(p).toEqual({ from: '2026-08-27', to: '2026-09-25', days: 30, previous: { from: '2026-07-28', to: '2026-08-26' } });
  });

  it('переставляє переплутані межі, ігнорує неіснуючі дати й обрізає задовгий період', () => {
    expect(resolveActivityPeriod('2026-09-10', '2026-09-01', '2026-09-25')).toMatchObject({ from: '2026-09-01', to: '2026-09-10', days: 10 });
    expect(resolveActivityPeriod('2026-02-31', '2026-03-05', '2026-09-25')).toMatchObject({ from: '2026-02-04', to: '2026-03-05' });
    expect(resolveActivityPeriod('2020-01-01', '2026-09-25', '2026-09-25').days).toBe(ACTIVITY_DASHBOARD_MAX_DAYS);
  });
});

describe('deltaPercent і formatUsageTime', () => {
  it('рахує зміну і не ділить на нуль', () => {
    expect(deltaPercent(150, 100)).toBe(50);
    expect(deltaPercent(50, 100)).toBe(-50);
    expect(deltaPercent(10, 0)).toBeNull();
  });

  it('показує час людською мовою', () => {
    expect(formatUsageTime(0)).toBe('0 хв');
    expect(formatUsageTime(20)).toBe('< 1 хв');
    expect(formatUsageTime(45 * 60)).toBe('45 хв');
    expect(formatUsageTime(2 * 3600 + 15 * 60)).toBe('2 год 15 хв');
    expect(formatUsageTime(3 * 3600)).toBe('3 год');
  });
});
