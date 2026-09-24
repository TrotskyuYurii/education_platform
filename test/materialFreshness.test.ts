import { describe, it, expect } from 'vitest';

import { getMaterialFreshness, materialChangedAt } from '../shared/materialFreshness.js';

/**
 * Позначки в каталозі мають підказувати співробітнику, що з'явилося або
 * змінилося, і не «кричати» про давні або вже вивчені матеріали.
 */

const now = new Date('2026-09-24T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('getMaterialFreshness', () => {
  it('позначає нещодавно доданий і ще не вивчений матеріал як новий', () => {
    expect(getMaterialFreshness({ createdAt: daysAgo(3) }, { now }).badge).toBe('new');
  });

  it('не позначає новим уже вивчений матеріал', () => {
    expect(getMaterialFreshness({ createdAt: daysAgo(3) }, { now, isCompleted: true }).badge).toBeNull();
  });

  it('позначає оновленим давній матеріал зі свіжими змінами — навіть якщо його вже вивчили', () => {
    const f = getMaterialFreshness({ createdAt: daysAgo(90), updatedAt: daysAgo(2) }, { now, isCompleted: true });
    expect(f.badge).toBe('updated');
    expect(f.changedAt?.toISOString()).toBe(daysAgo(2));
  });

  it('не показує позначок для давніх матеріалів', () => {
    expect(getMaterialFreshness({ createdAt: daysAgo(90), updatedAt: daysAgo(40) }, { now }).badge).toBeNull();
  });

  it('враховує зміни вкладених інструкцій курсу', () => {
    const f = getMaterialFreshness({ createdAt: daysAgo(90) }, { now, extraChanges: [new Date(daysAgo(1)), null] });
    expect(f.badge).toBe('updated');
  });

  it('не вважає оновленням зміну одразу після створення', () => {
    const created = daysAgo(30);
    const justAfter = new Date(new Date(created).getTime() + 10 * 60 * 1000).toISOString();
    expect(materialChangedAt({ createdAt: created, updatedAt: justAfter })).toBeNull();
  });

  it('без дат нічого не показує', () => {
    expect(getMaterialFreshness({}, { now })).toEqual({ addedAt: null, changedAt: null, badge: null });
  });
});
