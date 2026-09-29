import { Section, Course, Case } from '../../models.js';
import type { MaterialPresence } from '../../../shared/materialPresence.js';

export type { MaterialPresence } from '../../../shared/materialPresence.js';

/** Id усіх матеріалів, що зараз є в базі (видалені в корзину сюди не потрапляють). */
export async function loadMaterialPresence(): Promise<MaterialPresence> {
  const [sections, courses, cases] = await Promise.all([
    Section.find({} as any, { id: 1, _id: 0 } as any).lean<any[]>(),
    Course.find({} as any, { id: 1, _id: 0 } as any).lean<any[]>(),
    Case.find({} as any, { id: 1, _id: 0 } as any).lean<any[]>()
  ]);
  return {
    sectionIds: new Set(sections.map(s => s.id)),
    courseIds: new Set(courses.map(c => c.id)),
    caseIds: new Set(cases.map(c => c.id))
  };
}

const EMPTY = [null, ''];

/** $match-умова для спроб: те саме правило, що attemptIsForExistingMaterial. */
export function existingAttemptMatch(presence: MaterialPresence): any {
  return {
    $or: [
      { courseId: { $in: [...presence.courseIds] } },
      { courseId: { $in: EMPTY }, sectionId: { $in: [...presence.sectionIds] } },
      { courseId: { $in: EMPTY }, sectionId: { $in: EMPTY } }
    ]
  };
}

/** $match-умова для призначень: те саме правило, що assignmentIsForExistingMaterial. */
export function existingAssignmentMatch(presence: MaterialPresence): any {
  return {
    $or: [
      { targetType: 'instruction', targetId: { $in: [...presence.sectionIds] } },
      { targetType: { $ne: 'instruction' }, targetId: { $in: [...presence.courseIds] } }
    ]
  };
}

export function existingCertificateMatch(presence: MaterialPresence): any {
  return { courseId: { $in: [...presence.courseIds] } };
}
