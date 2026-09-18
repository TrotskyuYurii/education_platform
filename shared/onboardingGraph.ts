/**
 * Єдине джерело правди для перевірки схеми онбордінгу.
 * Використовується і сервером (перед збереженням та публікацією шаблону),
 * і редактором схеми (список проблем оновлюється просто під час малювання графа),
 * щоб кнопка «Опублікувати» і відповідь API не суперечили одна одній.
 */

/** Кроки, які закриваються системою автоматично, а не кліком людини. */
export const AUTO_STEP_TYPES = ['start', 'finish'];

/** Кроки, що мають посилання на існуючий навчальний матеріал. */
export const LEARNING_STEP_TYPES = ['instruction', 'course', 'quiz', 'case'];

export interface GraphNodeLike {
  id: string;
  type: string;
  title?: string;
  targetId?: string | null;
  url?: string | null;
}

export interface GraphEdgeLike {
  source: string;
  target: string;
}

/**
 * Перевіряє граф: без циклів, без «висячих» ребер, і хоча б один крок,
 * до якого можна дійти. Повертає список проблем — схему з проблемами
 * зберегти як чернетку можна, опублікувати — ні.
 */
export function validateOnboardingGraph(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): string[] {
  const issues: string[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  if (nodes.length === 0) {
    issues.push('Онбординг не містить жодного кроку');
    return issues;
  }

  // Лише «Початок» і «Завершення» — формально валідний граф, який при
  // призначенні одразу закривається як пройдений. Для людини це виглядає
  // як зламаний онбординг, тому вважаємо це помилкою схеми.
  if (!nodes.some(n => !AUTO_STEP_TYPES.includes(n.type))) {
    issues.push('Онбординг складається лише зі службових вузлів — додайте хоча б один крок');
    return issues;
  }

  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      issues.push(`Зв'язок «${e.source} → ${e.target}» вказує на неіснуючий крок`);
    }
    if (e.source === e.target) {
      issues.push(`Крок «${e.source}» зв'язаний сам із собою`);
    }
  }

  for (const n of nodes) {
    if (!n.title || !String(n.title).trim()) {
      issues.push('Є крок без назви');
    }
    if (LEARNING_STEP_TYPES.includes(n.type) && !n.targetId) {
      issues.push(`Крок «${n.title}» не прив'язаний до матеріалу`);
    }
    if (n.type === 'link' && !n.url) {
      issues.push(`Крок «${n.title}» не має посилання`);
    }
  }

  // Пошук циклів (DFS з трьома кольорами) — інакше кроки ніколи не розблокуються.
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const state = new Map<string, 0 | 1 | 2>();
  let hasCycle = false;
  const visit = (id: string) => {
    if (hasCycle) return;
    const s = state.get(id) || 0;
    if (s === 1) { hasCycle = true; return; }
    if (s === 2) return;
    state.set(id, 1);
    for (const next of adjacency.get(id) || []) visit(next);
    state.set(id, 2);
  };
  for (const n of nodes) visit(n.id);
  if (hasCycle) {
    issues.push('У схемі є замкнене коло зв\'язків — такі кроки неможливо пройти');
  }

  return issues;
}
