import { describe, it, expect } from 'vitest';

import {
  normalizeText,
  stripMarkdown,
  stemWord,
  parseQuery,
  stemMatchWeight,
  termMatchWeight,
  boundedLevenshtein,
  MATCH_WEIGHT
} from '../shared/searchText.js';
import { SearchIndex } from '../server/modules/search/searchIndex.js';

/**
 * Пошук у базі знань «за змістом»: словоформи, синоніми, одруківки,
 * запити звичайною мовою та ранжування за релевантністю.
 */
describe('searchText', () => {
  it('нормалізує регістр і апострофи', () => {
    expect(normalizeText("  Об’Єм  ТОВАРУ ")).toBe('обєм товару');
    expect(normalizeText("об'єм")).toBe(normalizeText('обʼєм'));
  });

  it('прибирає розмітку Markdown, лишаючи текст посилань', () => {
    expect(stripMarkdown('**Увага!** див. [інструкцію](http://x.y) ![скрін](a.png)')).toBe('Увага! див. інструкцію');
  });

  it('зводить словоформи до спільної основи', () => {
    const forms = ['повернення', 'поверненні', 'поверненням'];
    const stems = new Set(forms.map(stemWord));
    expect(stems.size).toBe(1);
    expect(stemWord('картка')).toBe(stemWord('картки'));
    expect(stemWord('рмк')).toBe('рмк');
    expect(stemWord('100')).toBe('100');
  });

  it('різні частини мови одного кореня збігаються через префікс основи', () => {
    const q = stemWord('повернути');
    expect(stemMatchWeight(q, stemWord('поверненні'))).toBeGreaterThan(0);
  });

  it('відкидає службові слова в запиті звичайною мовою', () => {
    const terms = parseQuery('як оформити повернення на картку');
    expect(terms.map(t => t.word)).toEqual(['оформити', 'повернення', 'картку']);
  });

  it('лишає службові слова, якщо крім них нічого немає', () => {
    expect(parseQuery('як').length).toBe(1);
  });

  it('прощає одну одруківку в довгих словах', () => {
    expect(boundedLevenshtein('павернен', 'повернен', 2)).toBe(1);
    expect(stemMatchWeight(stemWord('павернення'), stemWord('повернення'))).toBe(MATCH_WEIGHT.fuzzy);
    // короткі слова без одруківок — інакше забагато хибних збігів
    expect(stemMatchWeight('кот', 'кіт')).toBe(0);
  });

  it('знаходить синоніми', () => {
    const [term] = parseQuery('кошти');
    expect(termMatchWeight(term, stemWord('гроші'))).toBe(MATCH_WEIGHT.synonym);
    const [buyer] = parseQuery('покупець');
    expect(termMatchWeight(buyer, stemWord('клієнта'))).toBeGreaterThan(0);
  });
});

describe('SearchIndex', () => {
  type Meta = { id: string };
  const index = new SearchIndex<Meta>([
    {
      title: 'Повернення товару за закритою зміною',
      fields: [{ text: 'Оформлюється документом «Повернення товарів від клієнта». Кошти повертаються на ту саму картку через термінал.', weight: 1 }],
      meta: { id: 'return' }
    },
    {
      title: 'Відкриття касової зміни',
      fields: [{ text: 'Касир відкриває зміну в РМК на початку робочого дня.', weight: 1 }],
      meta: { id: 'shift' }
    },
    {
      title: 'Правила оформлення знижок',
      fields: [{ text: 'Знижка клієнту надається лише за погодженням керівника. Товар без знижки повертається за загальним правилом.', weight: 1 }],
      meta: { id: 'discount' }
    }
  ]);

  const ids = (q: string) => index.search(q).map(h => h.meta.id);

  it('знаходить за іншою словоформою', () => {
    expect(ids('поверненні')[0]).toBe('return');
  });

  it('знаходить за синонімом, якого немає в тексті', () => {
    expect(ids('гроші на карту')).toContain('return');
  });

  it('знаходить з одруківкою', () => {
    expect(ids('павернення')[0]).toBe('return');
  });

  it('розуміє запит звичайною мовою і ставить найрелевантніше першим', () => {
    expect(ids('як повернути гроші клієнту на картку')[0]).toBe('return');
  });

  it('не повертає документи, де знайшлося менше половини слів', () => {
    expect(ids('знижка керівник термінал банк реквізити')).not.toContain('shift');
  });

  it('фрагмент береться з місця, де зібрано слова запиту, і має слова для підсвічування', () => {
    const [hit] = index.search('картку термінал');
    expect(hit.snippet).toContain('картку');
    expect(hit.highlights).toEqual(expect.arrayContaining(['картку', 'термінал']));
    expect(hit.matchedField).toBe('content');
  });

  it('збіг у заголовку позначається як title', () => {
    expect(index.search('касова зміна')[0].matchedField).toBe('title');
  });

  it('фільтр відсікає документи', () => {
    expect(index.search('зміна', m => m.id !== 'shift').map(h => h.meta.id)).not.toContain('shift');
  });

  it('порожній запит нічого не повертає', () => {
    expect(index.search('   ')).toEqual([]);
  });
});
