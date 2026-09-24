/**
 * Позначки «Новий» та «Оновлено» для навчальних матеріалів у каталозі.
 *
 *  - «Новий» — матеріал додано нещодавно, і співробітник його ще не вивчив;
 *  - «Оновлено» — нещодавно змінено зміст. Показується й тим, хто матеріал уже
 *    прочитав: саме їм варто переглянути зміни.
 */

/** Скільки днів матеріал вважається новим або щойно оновленим. */
export const FRESH_MATERIAL_DAYS = 14;

/**
 * Зміна в межах години після створення — це ще саме створення (наприклад,
 * дописали питання одразу після імпорту), а не оновлення.
 */
const SAME_EVENT_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DatedMaterial {
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export type FreshnessBadge = 'new' | 'updated' | null;

export interface MaterialFreshness {
  addedAt: Date | null;
  /** Остання зміна змісту; null, якщо після додавання матеріал не змінювався. */
  changedAt: Date | null;
  badge: FreshnessBadge;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Дата останньої зміни матеріалу або null, якщо він не змінювався після додавання. */
export function materialChangedAt(material: DatedMaterial): Date | null {
  const addedAt = toDate(material.createdAt);
  const updatedAt = toDate(material.updatedAt);
  if (!updatedAt) return null;
  if (addedAt && updatedAt.getTime() - addedAt.getTime() < SAME_EVENT_MS) return null;
  return updatedAt;
}

/**
 * Обчислює дати та позначку матеріалу.
 *
 * `extraChanges` — дати змін вкладених матеріалів: курс вважається оновленим,
 * коли змінилася будь-яка його інструкція.
 */
export function getMaterialFreshness(
  material: DatedMaterial,
  options: { isCompleted?: boolean; extraChanges?: Array<Date | null>; now?: Date } = {}
): MaterialFreshness {
  const now = (options.now || new Date()).getTime();
  const addedAt = toDate(material.createdAt);

  const changes = [materialChangedAt(material), ...(options.extraChanges || [])]
    .filter((d): d is Date => !!d && (!addedAt || d.getTime() - addedAt.getTime() >= SAME_EVENT_MS));
  const changedAt = changes.length > 0
    ? new Date(Math.max(...changes.map(d => d.getTime())))
    : null;

  const isRecent = (d: Date | null) => !!d && now - d.getTime() <= FRESH_MATERIAL_DAYS * DAY_MS;

  let badge: FreshnessBadge = null;
  if (isRecent(addedAt) && !options.isCompleted) badge = 'new';
  else if (isRecent(changedAt)) badge = 'updated';

  return { addedAt, changedAt, badge };
}

/** Дата у звичному для співробітників вигляді: 24.09.2026. */
export function formatMaterialDate(date: Date): string {
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
