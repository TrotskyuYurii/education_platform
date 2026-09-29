import { describe, it, expect } from 'vitest';
import {
  attemptIsForExistingMaterial,
  assignmentIsForExistingMaterial,
  certificateIsForExistingMaterial,
  onboardingStepTargetMissing,
  MaterialPresence
} from '../shared/materialPresence.js';

/** Записи навчання за видаленими матеріалами не мають впливати на показники. */
const presence: MaterialPresence = {
  sectionIds: new Set(['sec-1']),
  courseIds: new Set(['course-1']),
  caseIds: new Set(['case-1'])
};

describe('materialPresence', () => {
  it('спроба курсу залежить від курсу, спроба за інструкцією — від інструкції', () => {
    expect(attemptIsForExistingMaterial({ courseId: 'course-1' }, presence)).toBe(true);
    expect(attemptIsForExistingMaterial({ courseId: 'course-gone' }, presence)).toBe(false);
    // Навіть якщо курс видалено, а інструкція лишилась — спроба курсу не рахується
    expect(attemptIsForExistingMaterial({ courseId: 'course-gone', sectionId: 'sec-1' }, presence)).toBe(false);
    expect(attemptIsForExistingMaterial({ sectionId: 'sec-1' }, presence)).toBe(true);
    expect(attemptIsForExistingMaterial({ courseId: '', sectionId: 'sec-gone' }, presence)).toBe(false);
  });

  it('загальні спроби без прив\'язки до матеріалу лишаються', () => {
    expect(attemptIsForExistingMaterial({}, presence)).toBe(true);
    expect(attemptIsForExistingMaterial({ courseId: null, sectionId: null }, presence)).toBe(true);
  });

  it('призначення: інструкція чи курс (без типу — курс)', () => {
    expect(assignmentIsForExistingMaterial({ targetType: 'instruction', targetId: 'sec-1' }, presence)).toBe(true);
    expect(assignmentIsForExistingMaterial({ targetType: 'instruction', targetId: 'course-1' }, presence)).toBe(false);
    expect(assignmentIsForExistingMaterial({ targetType: 'course', targetId: 'course-1' }, presence)).toBe(true);
    expect(assignmentIsForExistingMaterial({ targetId: 'course-gone' }, presence)).toBe(false);
  });

  it('сертифікат видаленого курсу не рахується', () => {
    expect(certificateIsForExistingMaterial({ courseId: 'course-1' }, presence)).toBe(true);
    expect(certificateIsForExistingMaterial({ courseId: 'course-gone' }, presence)).toBe(false);
  });

  it('крок онбордингу з видаленим матеріалом', () => {
    expect(onboardingStepTargetMissing({ type: 'instruction', targetId: 'sec-gone' }, presence)).toBe(true);
    expect(onboardingStepTargetMissing({ type: 'quiz', targetId: 'course-1' }, presence)).toBe(false);
    expect(onboardingStepTargetMissing({ type: 'case', targetId: 'case-gone' }, presence)).toBe(true);
    // Кроки без матеріалу (посилання, завдання) і кроки без обраного матеріалу — не «зниклі»
    expect(onboardingStepTargetMissing({ type: 'link', targetId: 'x' }, presence)).toBe(false);
    expect(onboardingStepTargetMissing({ type: 'instruction', targetId: '' }, presence)).toBe(false);
  });
});
