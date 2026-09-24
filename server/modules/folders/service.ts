import mongoose from 'mongoose';
import { Section, Course, Case } from '../../models.js';
import {
  MaterialFolder,
  MaterialFolderKind,
  MATERIAL_FOLDER_KINDS,
  MATERIAL_FOLDER_MAX_DEPTH
} from './models.js';

/** Помилка, яку маршрут віддає користувачу текстом, а не 500-ю. */
export class FolderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Колекція матеріалів, у якій живе поле folderId для кожного типу теки. */
const MATERIAL_MODEL: Record<MaterialFolderKind, any> = {
  instruction: Section,
  course: Course,
  case: Case
};

const KIND_LABEL: Record<MaterialFolderKind, string> = {
  instruction: 'інструкцій',
  course: 'курсів',
  case: 'кейсів'
};

export const isMaterialFolderKind = (value: any): value is MaterialFolderKind =>
  MATERIAL_FOLDER_KINDS.includes(value);

const assertKind = (kind: any): MaterialFolderKind => {
  if (!isMaterialFolderKind(kind)) {
    throw new FolderError('Невідомий тип матеріалів для теки');
  }
  return kind;
};

const normalizeName = (name: any): string => {
  const value = String(name ?? '').trim();
  if (!value) throw new FolderError('Назва теки обовʼязкова');
  if (value.length > 120) throw new FolderError('Назва теки задовга (максимум 120 символів)');
  return value;
};

/** Порожнє значення з різних клієнтів однаково означає «кореневий рівень». */
const normalizeParentId = (parentId: any): string | null => {
  if (parentId === undefined || parentId === null || parentId === '' || parentId === 'null') {
    return null;
  }
  return String(parentId);
};

/**
 * Глибина теки в дереві: корінь = 1.
 * Заразом ловить зациклені посилання, якщо дані колись пошкодяться.
 */
const depthOf = (folderId: string | null, byId: Map<string, any>): number => {
  let depth = 0;
  let current = folderId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) throw new FolderError('У дереві тек виявлено цикл');
    seen.add(current);
    const parent = byId.get(current);
    depth += 1;
    if (!parent) break;
    current = parent.parentId || null;
  }
  return depth;
};

const groupByParent = (folders: any[]): Map<string | null, any[]> => {
  const map = new Map<string | null, any[]>();
  for (const folder of folders) {
    const key = folder.parentId || null;
    const list = map.get(key) || [];
    list.push(folder);
    map.set(key, list);
  }
  return map;
};

/** Найглибша гілка піддерева теки (сама тека = 1). */
const subtreeHeight = (folderId: string, childrenByParent: Map<string | null, any[]>): number => {
  const children = childrenByParent.get(folderId) || [];
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(child => subtreeHeight(child.id, childrenByParent)));
};

export const FolderService = {
  /** Усі теки одного типу (або всіх типів), відсортовані під вивід дерева. */
  async list(kind?: any) {
    const query: any = {};
    if (kind !== undefined) query.kind = assertKind(kind);
    return MaterialFolder.find(query).sort({ order: 1, name: 1 }).lean();
  },

  async create(input: any) {
    const kind = assertKind(input?.kind);
    const name = normalizeName(input?.name);
    const parentId = normalizeParentId(input?.parentId);

    if (parentId) {
      const all = await MaterialFolder.find({ kind } as any).lean();
      const byId = new Map(all.map((f: any) => [f.id, f]));
      const parent = byId.get(parentId);
      if (!parent) throw new FolderError('Батьківську теку не знайдено', 404);
      if (depthOf(parentId, byId) >= MATERIAL_FOLDER_MAX_DEPTH) {
        throw new FolderError(`Максимальна глибина вкладеності — ${MATERIAL_FOLDER_MAX_DEPTH} рівнів`);
      }
    }

    const duplicate = await MaterialFolder.findOne({ kind, parentId, name } as any).lean();
    if (duplicate) throw new FolderError('Тека з такою назвою вже є на цьому рівні');

    const siblingsCount = await MaterialFolder.countDocuments({ kind, parentId } as any);

    return MaterialFolder.create({
      id: `folder-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      kind,
      parentId,
      color: String(input?.color || 'blue'),
      description: String(input?.description || ''),
      order: siblingsCount
    } as any);
  },

  async update(id: string, input: any) {
    const folder = await MaterialFolder.findOne({ id } as any).lean();
    if (!folder) throw new FolderError('Теку не знайдено', 404);

    const kind = (folder as any).kind as MaterialFolderKind;
    const updates: any = { updatedAt: new Date() };

    if (input?.name !== undefined) updates.name = normalizeName(input.name);
    if (input?.color !== undefined) updates.color = String(input.color || 'blue');
    if (input?.description !== undefined) updates.description = String(input.description || '');
    if (input?.order !== undefined && Number.isFinite(Number(input.order))) {
      updates.order = Number(input.order);
    }

    if (input?.parentId !== undefined) {
      const parentId = normalizeParentId(input.parentId);
      if (parentId === id) throw new FolderError('Теку не можна вкласти саму в себе');

      const all = await MaterialFolder.find({ kind } as any).lean();
      const byId = new Map(all.map((f: any) => [f.id, f]));

      if (parentId) {
        if (!byId.has(parentId)) throw new FolderError('Батьківську теку не знайдено', 404);

        // Переміщення теки у власного нащадка відірвало б цілу гілку від
        // кореня: вона зникла б з дерева, лишившись у базі.
        let cursor: string | null = parentId;
        const seen = new Set<string>();
        while (cursor) {
          if (cursor === id) throw new FolderError('Теку не можна перемістити у вкладену в неї теку');
          if (seen.has(cursor)) break;
          seen.add(cursor);
          cursor = (byId.get(cursor)?.parentId as string | null) || null;
        }

        const height = subtreeHeight(id, groupByParent(all));
        if (depthOf(parentId, byId) + height > MATERIAL_FOLDER_MAX_DEPTH) {
          throw new FolderError(`Максимальна глибина вкладеності — ${MATERIAL_FOLDER_MAX_DEPTH} рівнів`);
        }
      }

      updates.parentId = parentId;
    }

    const targetParent = updates.parentId !== undefined ? updates.parentId : (folder as any).parentId || null;
    const targetName = updates.name !== undefined ? updates.name : (folder as any).name;
    const duplicate = await MaterialFolder.findOne({
      kind,
      parentId: targetParent,
      name: targetName,
      id: { $ne: id }
    } as any).lean();
    if (duplicate) throw new FolderError('Тека з такою назвою вже є на цьому рівні');

    return MaterialFolder.findOneAndUpdate({ id } as any, updates, { new: true } as any);
  },

  /**
   * Видаляє теку, піднімаючи її вміст на рівень вище.
   *
   * Матеріали не видаляються ніколи: тека — лише спосіб їх розкласти, і
   * випадкове видалення теки не має забирати з собою регламенти разом з
   * їхніми тестами, версіями та призначеннями.
   */
  async remove(id: string, cascade = false) {
    const folder = await MaterialFolder.findOne({ id } as any).lean();
    if (!folder) throw new FolderError('Теку не знайдено', 404);

    const kind = (folder as any).kind as MaterialFolderKind;
    const parentId = (folder as any).parentId || null;
    const Model = MATERIAL_MODEL[kind];

    if (!cascade) {
      await MaterialFolder.updateMany(
        { kind, parentId: id } as any,
        { parentId, updatedAt: new Date() } as any
      );
      const moved = await Model.updateMany({ folderId: id } as any, { folderId: parentId } as any);
      await MaterialFolder.deleteOne({ id } as any);
      return { success: true, deletedFolders: 1, movedMaterials: moved?.modifiedCount || 0 };
    }

    // Каскад прибирає гілку тек цілком, а матеріали з неї піднімає до батька.
    const all = await MaterialFolder.find({ kind } as any).lean();
    const childrenByParent = groupByParent(all);
    const doomed: string[] = [];
    const walk = (folderId: string) => {
      doomed.push(folderId);
      for (const child of childrenByParent.get(folderId) || []) walk(child.id);
    };
    walk(id);

    const moved = await Model.updateMany(
      { folderId: { $in: doomed } } as any,
      { folderId: parentId } as any
    );
    await MaterialFolder.deleteMany({ id: { $in: doomed } } as any);
    return { success: true, deletedFolders: doomed.length, movedMaterials: moved?.modifiedCount || 0 };
  },

  /** Переносить матеріали у теку (folderId === null — на кореневий рівень). */
  async moveMaterials(kindInput: any, ids: any, folderIdInput: any) {
    const kind = assertKind(kindInput);
    const list = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
    if (list.length === 0) throw new FolderError('Не вказано, які матеріали переносити');

    const folderId = normalizeParentId(folderIdInput);
    if (folderId) {
      const folder = await MaterialFolder.findOne({ id: folderId } as any).lean();
      if (!folder) throw new FolderError('Теку не знайдено', 404);
      if ((folder as any).kind !== kind) {
        throw new FolderError(`Ця тека призначена не для ${KIND_LABEL[kind]}`);
      }
    }

    const Model = MATERIAL_MODEL[kind];
    // Списки в адмінці працюють з id матеріалу, але частина старих записів
    // приходить під _id — приймаємо обидва, щоб перенос не мовчав.
    const objectIds = list.filter(value => mongoose.isValidObjectId(value));
    const result = await Model.updateMany(
      {
        $or: [
          { id: { $in: list } },
          ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : [])
        ]
      } as any,
      { folderId } as any
    );

    return { success: true, moved: result?.modifiedCount || 0, folderId };
  }
};
