import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import 'dotenv/config';

/**
 * Корзина: видалення переносить матеріал разом зі зв'язками, відновлення
 * повертає все на свої місця, остаточне видалення прибирає файли.
 * Файлове сховище (GridFS) підміняємо — перевіряємо лише, чи його викликано.
 */
const deleteStorageMock = vi.fn();
vi.mock('../server/services/fileStorage.js', () => ({
  deleteDocumentStorage: (...args: any[]) => deleteStorageMock(...args)
}));

const { Section, Question, Course, Case, Progress } = await import('../server/models.js');
const { TrashItem } = await import('../server/modules/trash/models.js');
const { TrashService, TrashConflictError } = await import('../server/modules/trash/service.js');
const { MaterialFolder } = await import('../server/modules/folders/models.js');

const TEST_DB_NAME = 'viatec_trash_test';

function withDatabase(uri: string, dbName: string): string {
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${dbName}${query ? `?${query}` : ''}`;
}

const mongoUri = process.env.MONGODB_URI;
const hasDatabase = Boolean(mongoUri);
const userId = new mongoose.Types.ObjectId();
const actor = { _id: userId, fullName: 'Тест Адмін' };

beforeAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connect(withDatabase(mongoUri!, TEST_DB_NAME));
  await mongoose.connection.db!.dropDatabase();
}, 30000);

afterAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connection.db!.dropDatabase();
  await mongoose.connection.close();
}, 30000);

beforeEach(async () => {
  deleteStorageMock.mockReset();
  if (!hasDatabase) return;
  await Promise.all([Section, Question, Course, Case, Progress, TrashItem, MaterialFolder].map(m => (m as any).deleteMany({})));
});

async function seed() {
  await MaterialFolder.create({ id: 'folder-1', name: 'Каса', kind: 'instruction' } as any);
  await Section.create({ id: 'sec-1', title: 'Повернення товару', department: 'Роздріб', folderId: 'folder-1' } as any);
  await Section.create({ id: 'sec-2', title: 'Інша інструкція', department: 'Роздріб' } as any);
  await Question.create([
    { id: 'q-1', sectionId: 'sec-1', question: 'Питання 1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'q-2', sectionId: 'sec-1', question: 'Питання 2', options: ['a', 'b'], correctIndex: 1 },
    { id: 'q-3', sectionId: 'sec-2', question: 'Питання 3', options: ['a', 'b'], correctIndex: 1 }
  ] as any);
  await Case.create({ id: 'case-1', title: 'Кейс', scenario: 'Сценарій', sectionId: 'sec-1' } as any);
  await Course.create({ id: 'course-1', title: 'Курс', department: 'Роздріб', instructionIds: ['sec-2', 'sec-1'], caseIds: ['case-1'] } as any);
  await Progress.create({ userId, readSectionIds: ['sec-1', 'sec-2'] } as any);
}

describe.skipIf(!hasDatabase)('корзина матеріалів', () => {
  it('видалення інструкції переносить її разом з питаннями та зв\'язками', async () => {
    await seed();
    expect(await TrashService.trashInstruction('sec-1', actor)).toBe(true);

    expect(await Section.exists({ id: 'sec-1' })).toBeNull();
    expect(await Question.countDocuments({ sectionId: 'sec-1' })).toBe(0);
    expect(await Question.countDocuments({ sectionId: 'sec-2' })).toBe(1);
    expect((await Course.findOne({ id: 'course-1' }).lean<any>()).instructionIds).toEqual(['sec-2']);
    expect((await Progress.findOne({ userId }).lean<any>()).readSectionIds).toEqual(['sec-2']);

    const list = await TrashService.list({});
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ kind: 'instruction', materialId: 'sec-1', questionCount: 2, courseCount: 1, deletedByName: 'Тест Адмін' });
    // Файли інструкції лишаються до остаточного видалення
    expect(deleteStorageMock).not.toHaveBeenCalled();
  });

  it('відновлення повертає інструкцію на ті самі місця', async () => {
    await seed();
    await TrashService.trashInstruction('sec-1', actor);
    const [item] = (await TrashService.list({})).items;

    const restored = await TrashService.restore(item.id);
    expect(restored).toMatchObject({ kind: 'instruction', materialId: 'sec-1' });

    const section = await Section.findOne({ id: 'sec-1' }).lean<any>();
    expect(section.title).toBe('Повернення товару');
    expect(section.folderId).toBe('folder-1');
    expect(await Question.countDocuments({ sectionId: 'sec-1' })).toBe(2);
    expect((await Course.findOne({ id: 'course-1' }).lean<any>()).instructionIds).toEqual(['sec-2', 'sec-1']);
    expect((await Progress.findOne({ userId }).lean<any>()).readSectionIds.sort()).toEqual(['sec-1', 'sec-2']);
    expect(await TrashService.count()).toBe(0);
  });

  it('тека, видалена за час перебування в корзині, не ламає відновлення', async () => {
    await seed();
    await TrashService.trashInstruction('sec-1', actor);
    await MaterialFolder.deleteMany({});
    const [item] = (await TrashService.list({})).items;
    await TrashService.restore(item.id);
    expect((await Section.findOne({ id: 'sec-1' }).lean<any>()).folderId).toBeNull();
  });

  it('не відновлює поверх наявного матеріалу з тим самим id', async () => {
    await seed();
    await TrashService.trashCourse('course-1', actor);
    await Course.create({ id: 'course-1', title: 'Новий курс', department: 'Роздріб' } as any);
    const [item] = (await TrashService.list({})).items;
    await expect(TrashService.restore(item.id)).rejects.toBeInstanceOf(TrashConflictError);
    expect(await TrashService.count()).toBe(1);
  });

  it('кейс повертається в курс', async () => {
    await seed();
    await TrashService.trashCase('case-1', actor);
    expect((await Course.findOne({ id: 'course-1' }).lean<any>()).caseIds).toEqual([]);
    const [item] = (await TrashService.list({ kind: 'case' })).items;
    await TrashService.restore(item.id);
    expect((await Course.findOne({ id: 'course-1' }).lean<any>()).caseIds).toEqual(['case-1']);
    expect(await Case.exists({ id: 'case-1' })).not.toBeNull();
  });

  it('фільтри та пошук', async () => {
    await seed();
    await TrashService.trashInstruction('sec-1', actor);
    await TrashService.trashCourse('course-1', actor);
    await TrashService.trashCase('case-1', actor);

    expect((await TrashService.list({ kind: 'course' })).items.map(i => i.materialId)).toEqual(['course-1']);
    expect((await TrashService.list({ search: 'повернення' })).items.map(i => i.materialId)).toEqual(['sec-1']);
    expect((await TrashService.list({ search: 'case-1' })).total).toBe(1);
    expect((await TrashService.list({ deletedBy: String(userId) })).total).toBe(3);
    expect((await TrashService.list({ to: '2000-01-01' })).total).toBe(0);
    const all = await TrashService.list({});
    expect(all.counts).toEqual({ instruction: 1, course: 1, case: 1 });
    expect(all.deleters).toEqual([{ id: String(userId), name: 'Тест Адмін' }]);
  });

  it('остаточне видалення прибирає файли інструкції', async () => {
    await seed();
    await TrashService.trashInstruction('sec-1', actor);
    await TrashService.trashCourse('course-1', actor);
    const ids = await TrashService.allIds();
    for (const id of ids) await TrashService.purge(id);

    expect(await TrashService.count()).toBe(0);
    expect(deleteStorageMock).toHaveBeenCalledWith('sec-1');
    expect(deleteStorageMock).toHaveBeenCalledTimes(1);
    expect(await Section.exists({ id: 'sec-1' })).toBeNull();
  });
});
