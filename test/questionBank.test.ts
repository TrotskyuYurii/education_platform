import { describe, it, expect } from 'vitest';

import { normalizeQuestions, buildSectionMarkdownForAi, QuestionValidationError } from '../server/services/questionBank.js';

/**
 * Питання з редактора потрапляють у базу лише після перевірки: порожні
 * варіанти прибираються, правильна відповідь не губиться, а підрозділ і роль
 * беруться з самої інструкції, а не з того, що прислав браузер.
 */

const section = { id: 'inst-1', department: 'Каса', targetRole: 'cashier', pageReference: 'Стор. 1' };

describe('normalizeQuestions', () => {
  it('прибирає порожні варіанти і зберігає правильну відповідь', () => {
    const [q] = normalizeQuestions([
      { question: ' Що робити? ', options: ['', 'Так', ' ', 'Ні'], correctIndex: 3, difficulty: 'hard', department: 'Інше' }
    ], section);
    expect(q.question).toBe('Що робити?');
    expect(q.options).toEqual(['Так', 'Ні']);
    expect(q.options[q.correctIndex]).toBe('Ні');
    expect(q.difficulty).toBe('hard');
    expect(q.department).toBe('Каса');
    expect(q.role).toBe('cashier');
    expect(q.sectionId).toBe('inst-1');
    expect(q.sourceDocPage).toBe('Стор. 1');
  });

  it('видає нові ідентифікатори для порожніх і повторюваних', () => {
    const qs = normalizeQuestions([
      { id: 'q-1', question: 'А', options: ['1', '2'], correctIndex: 0 },
      { id: 'q-1', question: 'Б', options: ['1', '2'], correctIndex: 0 },
      { question: 'В', options: ['1', '2'], correctIndex: 1 }
    ], section);
    expect(qs[0].id).toBe('q-1');
    expect(new Set(qs.map(q => q.id)).size).toBe(3);
  });

  it('відхиляє питання без правильної відповіді з номером питання', () => {
    expect(() => normalizeQuestions([
      { question: 'А', options: ['1', '2'], correctIndex: 0 },
      { question: 'Б', options: ['1', ''], correctIndex: 1 }
    ], section)).toThrow(/Питання №2/);
  });

  it('відхиляє повторювані варіанти', () => {
    expect(() => normalizeQuestions([{ question: 'А', options: ['Так', 'так'], correctIndex: 0 }], section))
      .toThrow(QuestionValidationError);
  });
});

describe('buildSectionMarkdownForAi', () => {
  it('відрізає наявні питання та посилання на скріншоти з Markdown документа', () => {
    const md = buildSectionMarkdownForAi({
      rawMarkdown: '# Назва\nТекст ![скрін](assets/img-001.png)\n### ПИТАННЯ: Старе?\n- [x] Так'
    });
    expect(md).toContain('Текст');
    expect(md).not.toContain('ПИТАННЯ');
    expect(md).not.toContain('assets/');
  });

  it('збирає текст із полів, якщо Markdown документа немає', () => {
    const md = buildSectionMarkdownForAi({ title: 'Повернення', stopRules: ['Не видавати готівку'] });
    expect(md).toContain('# Повернення');
    expect(md).toContain('- Не видавати готівку');
  });
});
