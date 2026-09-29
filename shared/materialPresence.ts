/**
 * Чи стосується запис навчання матеріалу, який ще є в базі.
 *
 * Видалений матеріал (зокрема перенесений у корзину) зникає зі своєї колекції,
 * але спроби тестів, сертифікати, призначення й кроки онбордингу, що на нього
 * посилаються, лишаються — інакше відновлення з корзини повертало б матеріал
 * без історії. Щоб такі «осиротілі» записи не впливали на дашборди й прогрес,
 * звіти відбирають їх цими правилами. Після відновлення матеріалу записи
 * автоматично знову враховуються.
 *
 * Модуль чистий (без БД): його використовують і сервер, і тести.
 */

export interface MaterialPresence {
  sectionIds: Set<string>;
  courseIds: Set<string>;
  caseIds: Set<string>;
}

const has = (set: Set<string>, id: unknown) => typeof id === 'string' && id !== '' && set.has(id);
const isEmpty = (id: unknown) => id === undefined || id === null || id === '';

/**
 * Спроба тесту чи кейсів. Спроба курсу залежить від курсу, спроба за
 * інструкцією — від інструкції; загальні спроби без прив'язки лишаються завжди.
 */
export function attemptIsForExistingMaterial(
  attempt: { courseId?: string | null; sectionId?: string | null },
  presence: MaterialPresence
): boolean {
  if (!isEmpty(attempt.courseId)) return has(presence.courseIds, attempt.courseId);
  if (!isEmpty(attempt.sectionId)) return has(presence.sectionIds, attempt.sectionId);
  return true;
}

/** Призначення курсу чи інструкції (targetType без значення — це курс). */
export function assignmentIsForExistingMaterial(
  assignment: { targetType?: string | null; targetId?: string | null },
  presence: MaterialPresence
): boolean {
  return assignment.targetType === 'instruction'
    ? has(presence.sectionIds, assignment.targetId)
    : has(presence.courseIds, assignment.targetId);
}

export function certificateIsForExistingMaterial(
  certificate: { courseId?: string | null },
  presence: MaterialPresence
): boolean {
  return has(presence.courseIds, certificate.courseId);
}

/** Типи кроків онбордингу, прив'язаних до матеріалу, і колекція цього матеріалу. */
const STEP_TARGETS: Record<string, keyof MaterialPresence> = {
  instruction: 'sectionIds',
  course: 'courseIds',
  quiz: 'courseIds',
  case: 'caseIds'
};

/**
 * Крок онбордингу, матеріал якого видалено: закрити його неможливо, тож він не
 * має ні блокувати наступні кроки, ні тягнути вниз відсоток проходження.
 */
export function onboardingStepTargetMissing(
  node: { type?: string; targetId?: string | null },
  presence: MaterialPresence
): boolean {
  const key = node.type ? STEP_TARGETS[node.type] : undefined;
  if (!key || isEmpty(node.targetId)) return false;
  return !has(presence[key], node.targetId);
}
