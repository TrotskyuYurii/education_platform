import { Department } from '../models.js';
import { DEFAULT_DEPARTMENT, resolveDepartmentName } from '../../shared/departments.js';

/**
 * Довідник підрозділів для завантаження інструкцій.
 *
 * Підрозділи заводить людина в «Організаційній структурі». Завантаження
 * інструкції — хоч через ШІ, хоч готовим .md — нових підрозділів не створює:
 * назву з документа зіставляємо з довідником, а якщо збігу немає, матеріал
 * іде до системного підрозділу «Всі підрозділи».
 */

/** Активні підрозділи оргструктури без системного «Всі підрозділи». */
export async function listDepartmentNames(): Promise<string[]> {
  const items = await Department.find({ isActive: { $ne: false } } as any, { name: 1 } as any)
    .sort({ order: 1, name: 1 } as any);
  return items
    .map((d: any) => (typeof d?.name === 'string' ? d.name.trim() : ''))
    .filter((name: string) => name && name !== DEFAULT_DEPARTMENT);
}

/**
 * Проставляє розділам підрозділ з довідника і синхронізує з ними питання.
 *
 * Питання несуть власну копію назви підрозділу (за нею працюють фільтри
 * звітів), тому їх треба правити разом з розділом — інакше інструкція
 * опиниться в одному підрозділі, а її тест у неіснуючому.
 *
 * Повертає назви, які довелося замінити, — їх видно у відповіді на імпорт.
 */
export async function alignDepartmentsWithDirectory(
  sections: any[],
  questions: any[]
): Promise<Array<{ sectionId: string; from: string; to: string }>> {
  if (!sections?.length) return [];

  const known = await listDepartmentNames();
  const changes: Array<{ sectionId: string; from: string; to: string }> = [];

  for (const section of sections) {
    const original = (section?.department || '').trim();
    const resolved = resolveDepartmentName(original, known);
    if (resolved === original) continue;

    section.department = resolved;
    changes.push({ sectionId: section.id, from: original || '(порожньо)', to: resolved });

    for (const question of questions || []) {
      if (question?.sectionId === section.id) question.department = resolved;
    }
  }

  return changes;
}
