import { describe, it, expect } from 'vitest';

import { formatDuration, sanitizeDurationSec, MAX_ATTEMPT_DURATION_SEC } from '../shared/attemptDuration.js';

describe('formatDuration', () => {
  it('показує секунди, хвилини й години людською мовою', () => {
    expect(formatDuration(45)).toBe('45 с');
    expect(formatDuration(252)).toBe('4 хв 12 с');
    expect(formatDuration(300)).toBe('5 хв');
    expect(formatDuration(3780)).toBe('1 год 3 хв');
    expect(formatDuration(7200)).toBe('2 год');
  });

  it('для старих спроб без тривалості показує прочерк', () => {
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('sanitizeDurationSec', () => {
  it('округлює і приймає числа з рядка', () => {
    expect(sanitizeDurationSec(12.6)).toBe(13);
    expect(sanitizeDurationSec('90')).toBe(90);
  });

  it('відкидає некоректні значення', () => {
    expect(sanitizeDurationSec(-5)).toBeUndefined();
    expect(sanitizeDurationSec('abc')).toBeUndefined();
    expect(sanitizeDurationSec(undefined)).toBeUndefined();
    expect(sanitizeDurationSec(Infinity)).toBeUndefined();
  });

  it('обмежує тривалість добою', () => {
    expect(sanitizeDurationSec(10 ** 9)).toBe(MAX_ATTEMPT_DURATION_SEC);
  });
});
