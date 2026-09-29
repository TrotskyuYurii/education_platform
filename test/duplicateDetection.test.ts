import { describe, it, expect } from 'vitest';
import {
  findDuplicatePairs,
  groupDuplicatePairs,
  sectionDuplicateText,
  duplicatePairKey,
  clampThreshold,
  levelForScore,
  DuplicateSource
} from '../shared/duplicateDetection.js';

/**
 * Пошук дублів інструкцій: дослівні копії, переказ з правками, однаковий
 * файл-оригінал — мають знаходитись; різні інструкції — ні.
 */
const RETURN_TEXT = `
Повернення товару від покупця оформлюється в 1С документом «Повернення від клієнта».
Касир перевіряє чек, стан товару та комплектність. Кошти повертаються тим самим способом,
яким було здійснено оплату: готівкою через касу або на картку через термінал.
Якщо з дня покупки минуло понад чотирнадцять днів, повернення погоджує керівник магазину.
Після проведення документа товар повертається на склад, а покупець підписує заяву.
`;

const RETURN_EDITED = `
Повернення товару від клієнта оформлюється в 1С документом «Повернення від клієнта».
Касир уважно перевіряє чек, стан товару та комплектність. Гроші повертаються тим самим способом,
яким було здійснено оплату: готівкою через касу або на картку через термінал.
Якщо з дня покупки минуло понад чотирнадцять днів, повернення погоджує керівник магазину.
Після проведення документа товар повертається на склад, а покупець підписує заяву на повернення.
`;

const SHIPPING_TEXT = `
Відвантаження замовлень службою доставки виконується щодня до 16:00.
Комірник збирає товар за видатковою накладною, пакує його та друкує етикетку перевізника.
Номер ТТН вноситься в замовлення, після чого клієнт отримує повідомлення про відправлення.
Негабаритні вантажі погоджуються з логістом заздалегідь.
`;

const PASSWORD_TEXT = `
Щоб змінити пароль до корпоративної пошти, відкрийте налаштування облікового запису.
Новий пароль має містити щонайменше дванадцять символів, великі й малі літери та цифри.
Не використовуйте той самий пароль для інших сервісів і нікому його не повідомляйте.
`;

const src = (id: string, title: string, text: string, extra: Partial<DuplicateSource> = {}): DuplicateSource => ({ id, title, text, ...extra });

describe('duplicateDetection', () => {
  it('знаходить дослівну копію як повний дубль', () => {
    const pairs = findDuplicatePairs([
      src('a', 'Повернення товару', RETURN_TEXT),
      src('b', 'Повернення товару (копія)', RETURN_TEXT),
      src('c', 'Відвантаження замовлень', SHIPPING_TEXT)
    ]);
    expect(pairs).toHaveLength(1);
    expect(duplicatePairKey(pairs[0].a, pairs[0].b)).toBe('a|b');
    expect(pairs[0].level).toBe('exact');
  });

  it('знаходить переказ із правками та синонімами', () => {
    const pairs = findDuplicatePairs([
      src('a', 'Повернення товару від покупця', RETURN_TEXT),
      src('b', 'Порядок повернення товарів', RETURN_EDITED),
      src('c', 'Зміна пароля пошти', PASSWORD_TEXT)
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].score).toBeGreaterThanOrEqual(0.8);
    expect(pairs[0].reasons.some(r => r.includes('фрагментів') || r.includes('зміст'))).toBe(true);
  });

  it('не вважає дублями різні інструкції', () => {
    const pairs = findDuplicatePairs([
      src('a', 'Повернення товару', RETURN_TEXT),
      src('b', 'Відвантаження замовлень', SHIPPING_TEXT),
      src('c', 'Зміна пароля пошти', PASSWORD_TEXT)
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('однаковий файл-оригінал — гарантований дубль навіть з різним текстом', () => {
    const pairs = findDuplicatePairs([
      src('a', 'Доставка', SHIPPING_TEXT, { checksum: 'abc123' }),
      src('b', 'Пароль', PASSWORD_TEXT, { checksum: 'abc123' })
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sameSource).toBe(true);
    expect(pairs[0].score).toBe(1);
  });

  it('однакові лише назви без змісту не дають високої оцінки', () => {
    const pairs = findDuplicatePairs([src('a', 'Інструкція', ''), src('b', 'Інструкція', '')]);
    expect(pairs).toHaveLength(0);
  });

  it('помічає, коли одна інструкція повністю входить в іншу', () => {
    const pairs = findDuplicatePairs([
      src('short', 'Повернення', RETURN_TEXT),
      src('long', 'Каса: повний регламент', `${RETURN_TEXT}\n${SHIPPING_TEXT}\n${PASSWORD_TEXT}`)
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].overlap).toBeGreaterThan(0.9);
  });

  it('focusIds: лише пари з новою інструкцією, і вона завжди ліворуч', () => {
    const sources = [
      src('old1', 'Повернення товару', RETURN_TEXT),
      src('old2', 'Повернення товару (архів)', RETURN_TEXT),
      src('new', 'Повернення від клієнта', RETURN_EDITED)
    ];
    const pairs = findDuplicatePairs(sources, { focusIds: ['new'] });
    expect(pairs.length).toBe(2);
    expect(pairs.every(p => p.a === 'new')).toBe(true);
  });

  it('пропускає пари, позначені «не дубль»', () => {
    const sources = [src('a', 'Повернення', RETURN_TEXT), src('b', 'Повернення', RETURN_TEXT)];
    const pairs = findDuplicatePairs(sources, { ignoredPairKeys: new Set([duplicatePairKey('b', 'a')]) });
    expect(pairs).toHaveLength(0);
  });

  it('групує ланцюжки схожих інструкцій', () => {
    const pairs = findDuplicatePairs([
      src('a', 'Повернення', RETURN_TEXT),
      src('b', 'Повернення 2', RETURN_TEXT),
      src('c', 'Повернення 3', RETURN_EDITED),
      src('d', 'Пароль', PASSWORD_TEXT),
      src('e', 'Пароль 2', PASSWORD_TEXT)
    ]);
    const groups = groupDuplicatePairs(pairs);
    expect(groups).toHaveLength(2);
    expect(groups[0].ids.sort()).toEqual(['a', 'b', 'c']);
    expect(groups[1].ids.sort()).toEqual(['d', 'e']);
  });

  it('збирає текст інструкції зі структурованих полів і Markdown', () => {
    const text = sectionDuplicateText({
      summary: 'Суть',
      keyPoints: ['Пункт'],
      steps: [{ title: 'Крок', description: 'Опис', tip: 'Порада' }],
      rawMarkdown: '# Заголовок'
    });
    for (const part of ['Суть', 'Пункт', 'Крок', 'Опис', 'Порада', 'Заголовок']) expect(text).toContain(part);
    expect(sectionDuplicateText(null)).toBe('');
  });

  it('обмежує поріг і визначає рівні', () => {
    expect(clampThreshold('abc')).toBe(0.6);
    expect(clampThreshold(0.01)).toBe(0.3);
    expect(clampThreshold(5)).toBe(0.99);
    expect(levelForScore(0.97)).toBe('exact');
    expect(levelForScore(0.85)).toBe('high');
    expect(levelForScore(0.62)).toBe('possible');
  });
});
