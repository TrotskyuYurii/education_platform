import crypto from 'crypto';
import mongoose from 'mongoose';
import { Section, Question, Course, Case, Progress } from '../../models.js';
import { InstructionVersion } from '../knowledge/models.js';
import { MaterialFolder } from '../folders/models.js';
import { deleteDocumentStorage } from '../../services/fileStorage.js';
import { DuplicateService } from '../tools/duplicates.js';
import { ReadingProgress } from '../learning/models.js';
import { OnboardingService } from '../onboarding/service.js';
import { TrashItem, TrashKind, TRASH_KINDS } from './models.js';

export class TrashConflictError extends Error {
  status = 409;
}

interface Actor {
  _id?: any;
  fullName?: string;
  username?: string;
  email?: string;
}

const actorName = (user?: Actor) => user?.fullName || user?.username || user?.email || '';

/** Матеріал шукаємо і за нашим id, і за _id — так само, як це робили старі маршрути видалення. */
function materialQuery(rawId: string): any {
  return {
    $or: [
      { id: rawId },
      ...(mongoose.isValidObjectId(rawId) ? [{ _id: rawId }] : [])
    ]
  };
}

/** Позиції матеріалу в курсах — щоб після відновлення він став на своє місце. */
async function collectCourseRefs(field: 'instructionIds' | 'caseIds', ids: string[]) {
  const courses = await Course.find({ [field]: { $in: ids } } as any, { id: 1, [field]: 1 } as any).lean<any[]>();
  return courses.map(c => ({
    courseId: c.id,
    field,
    index: Math.max(0, (c[field] || []).findIndex((x: string) => ids.includes(x)))
  }));
}

async function createItem(kind: TrashKind, snapshot: any, related: any, user?: Actor) {
  return TrashItem.create({
    id: crypto.randomUUID(),
    kind,
    materialId: snapshot.id,
    title: snapshot.title || '',
    department: snapshot.department || '',
    snapshot,
    related,
    deletedAt: new Date(),
    deletedBy: user?._id,
    deletedByName: actorName(user)
  });
}

/** Тека могла зникнути, поки матеріал лежав у корзині, — тоді повертаємо в корінь. */
async function resolveFolderId(folderId?: string | null): Promise<string | null> {
  if (!folderId) return null;
  return (await MaterialFolder.exists({ id: folderId } as any)) ? folderId : null;
}

async function restoreCourseRefs(materialId: string, refs: any[]) {
  for (const ref of refs || []) {
    if (!ref?.courseId || !ref?.field) continue;
    await Course.updateOne(
      { id: ref.courseId, [ref.field]: { $ne: materialId } } as any,
      { $push: { [ref.field]: { $each: [materialId], $position: Math.max(0, ref.index || 0) } } } as any
    );
  }
}

async function insertRaw(model: any, doc: any) {
  const folderId = await resolveFolderId(doc.folderId);
  await model.collection.insertOne({ ...doc, folderId });
}

export interface TrashListParams {
  kind?: string;
  search?: string;
  from?: string;
  to?: string;
  deletedBy?: string;
  page?: number;
  limit?: number;
}

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter(params: TrashListParams) {
  const filter: any = {};
  if (params.kind && (TRASH_KINDS as readonly string[]).includes(params.kind)) filter.kind = params.kind;
  if (params.deletedBy && mongoose.isValidObjectId(params.deletedBy)) filter.deletedBy = params.deletedBy;
  const range: any = {};
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;
  if (from && !Number.isNaN(from.getTime())) range.$gte = from;
  if (to && !Number.isNaN(to.getTime())) {
    // Дата «по» включно: до кінця обраного дня
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.to!)) to.setHours(23, 59, 59, 999);
    range.$lte = to;
  }
  if (Object.keys(range).length) filter.deletedAt = range;
  const search = (params.search || '').trim();
  if (search) {
    const re = new RegExp(escapeRegExp(search.slice(0, 200)), 'i');
    filter.$or = [{ title: re }, { materialId: re }, { department: re }];
  }
  return filter;
}

function serialize(item: any) {
  const snap = item.snapshot || {};
  return {
    id: item.id,
    kind: item.kind as TrashKind,
    materialId: item.materialId,
    title: item.title || 'Без назви',
    department: item.department || '',
    deletedAt: item.deletedAt,
    deletedByName: item.deletedByName || '',
    questionCount: item.related?.questions?.length || 0,
    courseCount: item.related?.courseRefs?.length || 0,
    instructionCount: Array.isArray(snap.instructionIds) ? snap.instructionIds.length : 0,
    createdAt: snap.createdAt
  };
}

export const TrashService = {
  /** Інструкція разом з її питаннями, місцями в курсах і позначками «прочитано». */
  async trashInstruction(rawId: string, user?: Actor): Promise<boolean> {
    const section = await Section.findOne(materialQuery(rawId)).lean<any>();
    if (!section) return false;
    const ids = [...new Set([section.id, rawId])];

    const questions = await Question.find({ sectionId: { $in: ids } } as any).lean<any[]>();
    const courseRefs = await collectCourseRefs('instructionIds', ids);
    const readers = await Progress.find({ readSectionIds: { $in: ids } } as any, { _id: 1 } as any).lean<any[]>();
    // Позначки «прочитано» живуть і в новій колекції ReadingProgress — саме з неї
    // рахується прогрес. Зберігаємо їх зі знімком, бо наступне збереження
    // прогресу людиною перезаписує її відмітки лише наявними інструкціями.
    const readings = await ReadingProgress.find({ sectionId: { $in: ids } } as any).lean<any[]>();

    await createItem('instruction', section, {
      questions,
      courseRefs,
      readByUserIds: readers.map(r => r._id),
      readings: readings.map(r => ({ userId: r.userId, courseId: r.courseId, completedAt: r.completedAt }))
    }, user);

    await Section.deleteOne({ _id: section._id } as any);
    await Question.deleteMany({ sectionId: { $in: ids } } as any);
    await Course.updateMany(
      { instructionIds: { $in: ids } } as any,
      { $pull: { instructionIds: { $in: ids } } } as any
    );
    await Progress.updateMany(
      { readSectionIds: { $in: ids } } as any,
      { $pull: { readSectionIds: { $in: ids } } } as any
    );
    await ReadingProgress.deleteMany({ sectionId: { $in: ids } } as any);
    await OnboardingService.recalcForMaterial(section.id);
    // Версії та файли (оригінал, instruction.md, скріншоти) лишаються до
    // остаточного видалення — інакше відновлена інструкція була б без зображень.
    return true;
  },

  async trashCourse(rawId: string, user?: Actor): Promise<boolean> {
    const course = await Course.findOne(materialQuery(rawId)).lean<any>();
    if (!course) return false;
    await createItem('course', course, {}, user);
    await Course.deleteOne({ _id: course._id } as any);
    await OnboardingService.recalcForMaterial(course.id);
    return true;
  },

  async trashCase(rawId: string, user?: Actor): Promise<boolean> {
    const found = await Case.findOne(materialQuery(rawId)).lean<any>();
    if (!found) return false;
    const ids = [...new Set([found.id, rawId])];
    const courseRefs = await collectCourseRefs('caseIds', ids);

    await createItem('case', found, { courseRefs }, user);
    await Case.deleteOne({ _id: found._id } as any);
    await Course.updateMany(
      { caseIds: { $in: ids } } as any,
      { $pull: { caseIds: { $in: ids } } } as any
    );
    await OnboardingService.recalcForMaterial(found.id);
    return true;
  },

  async list(params: TrashListParams) {
    const filter = buildFilter(params);
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    const page = Math.max(Number(params.page) || 1, 1);

    const [items, total, byKind, deleters] = await Promise.all([
      TrashItem.find(filter, { 'snapshot.rawMarkdown': 0, 'snapshot.contentMarkdown': 0, 'snapshot.steps': 0 } as any)
        .sort({ deletedAt: -1 } as any)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<any[]>(),
      TrashItem.countDocuments(filter),
      TrashItem.aggregate([{ $group: { _id: '$kind', count: { $sum: 1 } } }]),
      TrashItem.aggregate([
        { $match: { deletedBy: { $ne: null } } },
        { $group: { _id: '$deletedBy', name: { $last: '$deletedByName' } } },
        { $sort: { name: 1 } }
      ])
    ]);

    const counts: Record<TrashKind, number> = { instruction: 0, course: 0, case: 0 };
    for (const row of byKind) if (row._id in counts) counts[row._id as TrashKind] = row.count;

    return {
      items: items.map(serialize),
      total,
      page,
      limit,
      counts,
      totalAll: counts.instruction + counts.course + counts.case,
      deleters: deleters.map(d => ({ id: String(d._id), name: d.name || 'Невідомо' }))
    };
  },

  async count(): Promise<number> {
    return TrashItem.countDocuments({});
  },

  async restore(itemId: string): Promise<{ kind: TrashKind; materialId: string; title: string }> {
    const item = await TrashItem.findOne({ id: itemId } as any).lean<any>();
    if (!item) throw Object.assign(new Error('Матеріал у корзині не знайдено'), { status: 404 });

    const kind = item.kind as TrashKind;
    const model = kind === 'instruction' ? Section : kind === 'course' ? Course : Case;
    const snapshot = item.snapshot;

    if (await model.exists({ $or: [{ id: snapshot.id }, { _id: snapshot._id }] } as any)) {
      throw new TrashConflictError(`Матеріал з id «${snapshot.id}» уже є в базі — відновлення скасовано`);
    }

    await insertRaw(model, snapshot);

    if (kind === 'instruction') {
      const questions = (item.related?.questions || []) as any[];
      if (questions.length > 0) {
        const existing = await Question.find({ id: { $in: questions.map(q => q.id) } } as any, { id: 1 } as any).lean<any[]>();
        const taken = new Set(existing.map(q => q.id));
        const toInsert = questions.filter(q => !taken.has(q.id));
        if (toInsert.length) await Question.collection.insertMany(toInsert);
      }
      const readings = (item.related?.readings || []) as any[];
      if (readings.length) {
        await ReadingProgress.bulkWrite(readings.map(r => ({
          updateOne: {
            filter: { userId: r.userId, sectionId: snapshot.id },
            update: { $setOnInsert: { userId: r.userId, sectionId: snapshot.id, courseId: r.courseId, completedAt: r.completedAt || new Date() } },
            upsert: true
          }
        })), { ordered: false });
      }
      // readByUserIds — це _id legacy-документів Progress. updatedAt зсуваємо,
      // щоб синхронізація з legacy не пропустила зміну через кеш позначок часу.
      const readers = item.related?.readByUserIds || [];
      if (readers.length) {
        await Progress.updateMany(
          { _id: { $in: readers } } as any,
          { $addToSet: { readSectionIds: snapshot.id }, $set: { updatedAt: new Date() } } as any
        );
      }
    }
    if (kind === 'instruction' || kind === 'case') {
      await restoreCourseRefs(snapshot.id, item.related?.courseRefs || []);
    }
    await OnboardingService.recalcForMaterial(snapshot.id);

    await TrashItem.deleteOne({ id: itemId } as any);
    return { kind, materialId: snapshot.id, title: item.title };
  },

  /** Остаточне видалення: для інструкції — ще й її версії, файли та відхилені пари дублів. */
  async purge(itemId: string): Promise<boolean> {
    const item = await TrashItem.findOne({ id: itemId } as any, { kind: 1, materialId: 1 } as any).lean<any>();
    if (!item) return false;
    if (item.kind === 'instruction') {
      // Та сама інструкція могла бути відновлена і знову видалена — поки хоч
      // одна її копія є в базі чи в корзині, файли не чіпаємо.
      const stillUsed = await Section.exists({ id: item.materialId } as any)
        || await TrashItem.exists({ id: { $ne: itemId }, kind: 'instruction', materialId: item.materialId } as any);
      if (!stillUsed) {
        await InstructionVersion.deleteMany({ sectionId: item.materialId } as any);
        await deleteDocumentStorage(item.materialId);
        await DuplicateService.forgetSection(item.materialId);
      }
    }
    await TrashItem.deleteOne({ id: itemId } as any);
    return true;
  },

  async allIds(): Promise<string[]> {
    const rows = await TrashItem.find({} as any, { id: 1 } as any).lean<any[]>();
    return rows.map(r => r.id);
  }
};
