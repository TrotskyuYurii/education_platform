/**
 * Добір питань для однієї спроби тестування.
 *
 * Під час завантаження інструкції ШІ складає великий банк питань (20–30), а
 * співробітнику на кожну спробу показується лише частина з нього. Щоб повторне
 * проходження не було копією попереднього:
 *  - питання, яких людина ще не бачила (або бачила найдавніше), йдуть першими;
 *  - вибірка рівномірно розподіляється між інструкціями курсу та рівнями
 *    складності, а не вихоплює все з одного розділу;
 *  - порядок питань і порядок варіантів відповіді щоразу перемішуються.
 */

/** Скільки питань показувати за одну спробу, якщо курс не задає власного числа. */
export const DEFAULT_QUIZ_QUESTION_COUNT = 10;

/** Скільки нещодавно показаних питань пам'ятати для одного співробітника. */
export const RECENT_QUESTIONS_LIMIT = 500;

export interface SamplableQuestion {
  id: string;
  sectionId?: string;
  difficulty?: string;
  options: string[];
  correctIndex: number;
}

type Random = () => number;

function shuffleInPlace<T>(list: T[], random: Random): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function groupBy<T>(list: T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = groups.get(k);
    if (bucket) bucket.push(item);
    else groups.set(k, [item]);
  }
  return Array.from(groups.values());
}

/** Бере по одному елементу з кожної черги по колу, поки не набере `limit`. */
function roundRobin<T>(queues: T[][], limit: number): T[] {
  const result: T[] = [];
  const cursors = queues.map(() => 0);
  while (result.length < limit) {
    let took = false;
    for (let q = 0; q < queues.length && result.length < limit; q++) {
      if (cursors[q] < queues[q].length) {
        result.push(queues[q][cursors[q]++]);
        took = true;
      }
    }
    if (!took) break;
  }
  return result;
}

/**
 * Обирає `count` питань із банку.
 *
 * `recentIds` — ідентифікатори нещодавно показаних питань, найсвіжіші першими.
 */
export function pickQuizQuestions<T extends SamplableQuestion>(
  pool: T[],
  count: number,
  options: { recentIds?: string[]; random?: Random } = {}
): T[] {
  const random = options.random || Math.random;
  const limit = Math.max(0, Math.min(Math.floor(count) || 0, pool.length));
  if (limit >= pool.length) return shuffleInPlace([...pool], random);

  // Чим давніше питання показувалось, тим вищий пріоритет; ще не показані — найвищий.
  const recentRank = new Map<string, number>();
  (options.recentIds || []).forEach((id, idx) => {
    if (!recentRank.has(id)) recentRank.set(id, idx);
  });
  const freshness = (q: T) => (recentRank.has(q.id) ? recentRank.get(q.id)! : Number.MAX_SAFE_INTEGER);
  const byFreshness = (list: T[]) =>
    shuffleInPlace([...list], random).sort((a, b) => freshness(b) - freshness(a));

  // Усередині інструкції спершу йдуть ще не бачені питання, потім — бачені
  // найдавніше; у кожній з двох груп чергуємо рівні складності.
  const interleaveDifficulty = (list: T[]) => {
    const byDifficulty = shuffleInPlace(groupBy(list, q => q.difficulty || 'medium'), random);
    return roundRobin(byDifficulty.map(byFreshness), list.length);
  };
  const perSection = groupBy(pool, q => q.sectionId || '').map(sectionQuestions => [
    ...interleaveDifficulty(sectionQuestions.filter(q => !recentRank.has(q.id))),
    ...interleaveDifficulty(sectionQuestions.filter(q => recentRank.has(q.id)))
  ]);

  // Інструкції з найсвіжішими для людини питаннями ходять першими, інакше — випадково.
  const sectionOrder = shuffleInPlace(perSection, random)
    .sort((a, b) => freshness(b[0]) - freshness(a[0]));

  return shuffleInPlace(roundRobin(sectionOrder, limit), random);
}

/**
 * Варіанти на кшталт «Усі перелічені» чи «Жоден з варіантів» спираються на
 * своє місце в списку, тож у таких питаннях порядок відповідей не міняємо.
 */
const POSITIONAL_OPTION = /(^|\s)(усі|всі|все|жоден|жодна|жодне|обидва|обидві)\s.*(вище|перелічен|наведен|варіант)|^(а|б|в|a|b)\s*(і|та|й)\s*(б|в|b|c)\b/i;

/** Перемішує варіанти відповіді та перераховує індекс правильної. */
export function shuffleQuestionOptions<T extends SamplableQuestion>(question: T, random: Random = Math.random): T {
  const opts = question.options || [];
  if (opts.length < 2 || opts.some(o => POSITIONAL_OPTION.test((o || '').trim()))) return question;

  const order = shuffleInPlace(opts.map((_, idx) => idx), random);
  return {
    ...question,
    options: order.map(idx => opts[idx]),
    correctIndex: order.indexOf(question.correctIndex)
  };
}

/** Додає показані питання на початок історії, без дублікатів і з обмеженням довжини. */
export function mergeRecentQuestionIds(recentIds: string[], shownIds: string[]): string[] {
  const shown = new Set(shownIds);
  return [...shownIds, ...recentIds.filter(id => !shown.has(id))].slice(0, RECENT_QUESTIONS_LIMIT);
}
