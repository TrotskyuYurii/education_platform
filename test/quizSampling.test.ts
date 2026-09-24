import { describe, it, expect } from 'vitest';

import {
  pickQuizQuestions,
  shuffleQuestionOptions,
  mergeRecentQuestionIds,
  RECENT_QUESTIONS_LIMIT
} from '../shared/quizSampling.js';

/**
 * Співробітник має отримувати на кожну спробу іншу частину банку питань, а не
 * весь банк і не той самий набір. Тут перевіряємо, що вибірка має потрібний
 * розмір, рівномірно покриває інструкції і віддає перевагу ще не баченим питанням.
 */

function makePool(sections: Record<string, number>) {
  const pool: Array<{ id: string; sectionId: string; difficulty: string; options: string[]; correctIndex: number }> = [];
  const levels = ['easy', 'medium', 'hard'];
  for (const [sectionId, n] of Object.entries(sections)) {
    for (let i = 0; i < n; i++) {
      pool.push({
        id: `${sectionId}-${i}`,
        sectionId,
        difficulty: levels[i % 3],
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1
      });
    }
  }
  return pool;
}

/** Детермінований генератор, щоб тести не «блимали». */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('pickQuizQuestions', () => {
  it('повертає рівно запитану кількість без повторів', () => {
    const pool = makePool({ a: 30 });
    const picked = pickQuizQuestions(pool, 10, { random: seeded(1) });
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map(q => q.id)).size).toBe(10);
  });

  it('віддає весь банк, якщо питань менше, ніж запитано', () => {
    const pool = makePool({ a: 4 });
    expect(pickQuizQuestions(pool, 10, { random: seeded(2) })).toHaveLength(4);
  });

  it('розподіляє питання між інструкціями курсу', () => {
    const pool = makePool({ a: 30, b: 30 });
    const picked = pickQuizQuestions(pool, 10, { random: seeded(3) });
    expect(picked.filter(q => q.sectionId === 'a')).toHaveLength(5);
    expect(picked.filter(q => q.sectionId === 'b')).toHaveLength(5);
  });

  it('змішує рівні складності', () => {
    const pool = makePool({ a: 30 });
    const picked = pickQuizQuestions(pool, 9, { random: seeded(4) });
    const levels = new Set(picked.map(q => q.difficulty));
    expect(levels.size).toBe(3);
  });

  it('спершу показує питання, яких людина ще не бачила', () => {
    const pool = makePool({ a: 20 });
    const first = pickQuizQuestions(pool, 10, { random: seeded(5) });
    const second = pickQuizQuestions(pool, 10, { recentIds: first.map(q => q.id), random: seeded(6) });
    const overlap = second.filter(q => first.some(f => f.id === q.id));
    expect(overlap).toHaveLength(0);
  });
});

describe('shuffleQuestionOptions', () => {
  it('зберігає правильну відповідь після перемішування', () => {
    const q = { id: 'q', options: ['A', 'B', 'C', 'D'], correctIndex: 2 };
    for (let seed = 1; seed < 20; seed++) {
      const shuffled = shuffleQuestionOptions(q, seeded(seed));
      expect(shuffled.options[shuffled.correctIndex]).toBe('C');
      expect([...shuffled.options].sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('не чіпає питання з варіантом «Усі перелічені варіанти»', () => {
    const q = { id: 'q', options: ['A', 'B', 'Усі перелічені варіанти'], correctIndex: 2 };
    expect(shuffleQuestionOptions(q, seeded(7))).toBe(q);
  });
});

describe('mergeRecentQuestionIds', () => {
  it('ставить щойно показані першими і прибирає дублікати', () => {
    expect(mergeRecentQuestionIds(['a', 'b', 'c'], ['c', 'd'])).toEqual(['c', 'd', 'a', 'b']);
  });

  it('обмежує довжину історії', () => {
    const long = Array.from({ length: RECENT_QUESTIONS_LIMIT + 50 }, (_, i) => `id-${i}`);
    expect(mergeRecentQuestionIds(long, ['x'])).toHaveLength(RECENT_QUESTIONS_LIMIT);
  });
});
