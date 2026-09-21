import { describe, it, expect } from 'vitest';

import {
  DEFAULT_DEPARTMENT,
  isDefaultDepartment,
  resolveDepartmentName
} from '../shared/departments.js';
import { buildDepartmentsBlock, buildInstructionPrompt } from '../shared/instructionPrompt.js';

/**
 * Завантаження інструкції не створює підрозділів: ШІ отримує довідник і має
 * обрати з нього, а сервер перед записом ще раз звіряє назву. Тут перевіряємо
 * саме цей запобіжник — що вигадана моделлю назва не осідає в базі.
 */

const DIRECTORY = ['Бухгалтерія', 'Складська логістика', 'Відділ роздрібного продажу'];

describe('resolveDepartmentName', () => {
  it('залишає назву, що точно є в довіднику', () => {
    expect(resolveDepartmentName('Бухгалтерія', DIRECTORY)).toBe('Бухгалтерія');
  });

  it('не зважає на регістр, лапки та зайві пробіли', () => {
    expect(resolveDepartmentName('  «бухгалтерія» ', DIRECTORY)).toBe('Бухгалтерія');
  });

  it('зіставляє назву із загальним словом і без нього', () => {
    expect(resolveDepartmentName('Відділ бухгалтерії', DIRECTORY)).toBe('Бухгалтерія');
    expect(resolveDepartmentName('Роздрібний продаж', DIRECTORY)).toBe('Відділ роздрібного продажу');
  });

  it('приймає частковий збіг для достатньо довгої назви', () => {
    expect(resolveDepartmentName('Складська логістика та приймання', DIRECTORY)).toBe('Складська логістика');
  });

  it('відправляє вигадану моделлю назву до системного підрозділу', () => {
    expect(resolveDepartmentName('Казначейство', DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
    expect(resolveDepartmentName('Відділ маркетингу та PR', DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
  });

  it('повертає системний підрозділ для порожнього значення та порожнього довідника', () => {
    expect(resolveDepartmentName('', DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
    expect(resolveDepartmentName(undefined, DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
    expect(resolveDepartmentName('Бухгалтерія', [])).toBe(DEFAULT_DEPARTMENT);
  });

  it('не чіпляється за коротке слово, яке трапляється всюди', () => {
    expect(resolveDepartmentName('IT', DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
  });

  it('впізнає системний підрозділ у будь-якому написанні', () => {
    expect(isDefaultDepartment('всі підрозділи')).toBe(true);
    expect(isDefaultDepartment('Бухгалтерія')).toBe(false);
    expect(resolveDepartmentName('Всі підрозділи', DIRECTORY)).toBe(DEFAULT_DEPARTMENT);
  });
});

describe('buildDepartmentsBlock', () => {
  it('перелічує наявні підрозділи та системний як запасний варіант', () => {
    const block = buildDepartmentsBlock(DIRECTORY);
    for (const name of DIRECTORY) expect(block).toContain(`- ${name}`);
    expect(block).toContain(DEFAULT_DEPARTMENT);
  });

  it('не дублює системний підрозділ у переліку, якщо він прийшов разом з рештою', () => {
    const block = buildDepartmentsBlock([DEFAULT_DEPARTMENT, 'Бухгалтерія']);
    const bullets = block.split('\n').filter(line => line.startsWith(`- ${DEFAULT_DEPARTMENT}`));
    expect(bullets).toHaveLength(1);
  });

  it('вимагає системний підрозділ, коли довідник порожній', () => {
    expect(buildDepartmentsBlock([])).toContain(DEFAULT_DEPARTMENT);
  });

  it('потрапляє у промпт для аналізу документа', () => {
    const prompt = buildInstructionPrompt([], { departments: DIRECTORY });
    expect(prompt).toContain('ДОСТУПНІ ПІДРОЗДІЛИ:');
    expect(prompt).toContain('- Складська логістика');
  });
});
