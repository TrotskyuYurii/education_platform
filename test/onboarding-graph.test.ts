import { describe, it, expect } from 'vitest';
import { OnboardingService } from '../server/modules/onboarding/service.js';

/**
 * validateGraph — єдиний запобіжник між «схема виглядає нормально в редакторі»
 * і «людина отримала онбординг, який неможливо пройти». Тести на чистій функції,
 * підключення до бази не потрібне.
 */

const node = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  type: 'task',
  title: `Крок ${id}`,
  ...overrides
});

const edge = (source: string, target: string) => ({ id: `${source}->${target}`, source, target });

describe('OnboardingService.validateGraph', () => {
  it('приймає коректний лінійний граф', () => {
    const nodes = [
      node('start', { type: 'start', title: 'Початок' }),
      node('a'),
      node('finish', { type: 'finish', title: 'Завершення' })
    ];
    const edges = [edge('start', 'a'), edge('a', 'finish')];
    expect(OnboardingService.validateGraph(nodes, edges)).toEqual([]);
  });

  it('відхиляє порожню схему', () => {
    expect(OnboardingService.validateGraph([], [])).toEqual(['Онбординг не містить жодного кроку']);
  });

  it('знаходить замкнене коло — інакше кроки ніколи не розблокуються', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')];
    const issues = OnboardingService.validateGraph(nodes, edges);
    expect(issues.some(i => i.includes('замкнене коло'))).toBe(true);
  });

  it('знаходить зв\'язок на неіснуючий крок', () => {
    const nodes = [node('a')];
    const edges = [edge('a', 'missing')];
    const issues = OnboardingService.validateGraph(nodes, edges);
    expect(issues.some(i => i.includes('неіснуючий крок'))).toBe(true);
  });

  it('відхиляє крок, зв\'язаний сам із собою', () => {
    const nodes = [node('a')];
    const issues = OnboardingService.validateGraph(nodes, [edge('a', 'a')]);
    expect(issues.some(i => i.includes("зв'язаний сам із собою"))).toBe(true);
  });

  it('вимагає прив\'язку матеріалу для кроків типу інструкція/курс/тест/кейс', () => {
    for (const type of ['instruction', 'course', 'quiz', 'case']) {
      const issues = OnboardingService.validateGraph([node('a', { type, title: 'Читання' })], []);
      expect(issues, `тип ${type}`).toContain('Крок «Читання» не прив\'язаний до матеріалу');
    }
  });

  it('вимагає URL для кроку із зовнішнім посиланням', () => {
    const issues = OnboardingService.validateGraph([node('a', { type: 'link', title: 'Відео' })], []);
    expect(issues).toContain('Крок «Відео» не має посилання');
  });

  it('вимагає назву кроку', () => {
    const issues = OnboardingService.validateGraph([node('a', { title: '   ' })], []);
    expect(issues).toContain('Є крок без назви');
  });

  it('відхиляє схему лише зі службових вузлів', () => {
    const nodes = [
      node('start', { type: 'start', title: 'Початок' }),
      node('finish', { type: 'finish', title: 'Завершення' })
    ];
    const issues = OnboardingService.validateGraph(nodes, [edge('start', 'finish')]);
    expect(issues.some(i => i.includes('лише зі службових вузлів'))).toBe(true);
  });

  it('дозволяє розгалуження і сходження гілок без хибного спрацювання на цикл', () => {
    // start → (a, b) → merge: вузол merge відвідується двічі, але це не цикл.
    const nodes = [
      node('start', { type: 'start', title: 'Початок' }),
      node('a'),
      node('b'),
      node('merge')
    ];
    const edges = [
      edge('start', 'a'), edge('start', 'b'),
      edge('a', 'merge'), edge('b', 'merge')
    ];
    expect(OnboardingService.validateGraph(nodes, edges)).toEqual([]);
  });
});
