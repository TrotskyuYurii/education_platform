import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import 'dotenv/config';

/**
 * Модель і генерацію Markdown підміняємо: перевіряємо саме чергу — порядок
 * обробки, лічильники прогресу, поведінку на помилці та скасування, — а не
 * звернення до Anthropic API.
 */
const generateMock = vi.fn();
const importMock = vi.fn();

vi.mock('../server/services/aiInstructionGenerator.js', () => ({
  generateInstructionFromDocument: (...args: any[]) => generateMock(...args),
  describeAiError: (err: any) => err?.message || 'Помилка',
  InstructionGenerationError: class extends Error {}
}));

vi.mock('../server/services/instructionImport.js', () => ({
  importInstructions: (...args: any[]) => importMock(...args)
}));

const {
  AiImportJob,
  enqueueAiImportJob,
  serializeAiImportJob
} = await import('../server/modules/knowledge/aiImportJobs.js');

const TEST_DB_NAME = 'viatec_aijobs_test';

function withDatabase(uri: string, dbName: string): string {
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${dbName}${query ? `?${query}` : ''}`;
}

const mongoUri = process.env.MONGODB_URI;
const hasDatabase = Boolean(mongoUri);

let workDir: string;

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-aijobs-'));
  if (!hasDatabase) return;
  await mongoose.connect(withDatabase(mongoUri!, TEST_DB_NAME));
  await mongoose.connection.db!.dropDatabase();
}, 30000);

afterAll(async () => {
  fs.rmSync(workDir, { recursive: true, force: true });
  if (!hasDatabase) return;
  await mongoose.connection.db!.dropDatabase();
  await mongoose.connection.close();
}, 30000);

beforeEach(async () => {
  generateMock.mockReset();
  importMock.mockReset();
  importMock.mockResolvedValue({ saved: 0, used: 0, dropped: 0 });
  if (hasDatabase) await AiImportJob.deleteMany({});
});

/** Готує «завантажені» файли так, як їх передає multer. */
function fakeFiles(names: string[]) {
  return names.map(name => {
    const filePath = path.join(workDir, `${Date.now()}-${name}`);
    fs.writeFileSync(filePath, 'зміст документа');
    return { originalname: name, path: filePath, mimetype: 'text/plain', size: 10 };
  });
}

function generated(title: string) {
  return {
    markdown: `# Назва інструкції: ${title}\n**Підрозділ:** Бухгалтерія\n**Суть:** Тест\n`,
    sourceFileName: `${title}.txt`,
    sourceMimeType: 'text/plain',
    assets: []
  };
}

/** Чекає, поки черга дійде до термінального стану. */
async function waitForFinish(jobId: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await AiImportJob.findOne({ id: jobId } as any);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Завдання не завершилось за відведений час');
}

describe.skipIf(!hasDatabase)('пакетна ШІ-обробка документів', () => {
  it('обробляє всю пачку та рахує прогрес', async () => {
    generateMock.mockImplementation(async (params: any) => generated(params.originalName));

    const files = fakeFiles(['a.txt', 'b.txt', 'c.txt']);
    const job = await enqueueAiImportJob({ files, userId: 'u1', userName: 'Тест' });

    const finished = await waitForFinish(job.id);
    const view = serializeAiImportJob(finished);

    expect(view.status).toBe('completed');
    expect(view.totalFiles).toBe(3);
    expect(view.processedFiles).toBe(3);
    expect(view.percent).toBe(100);
    expect(view.successFiles).toBe(3);
    expect(view.createdSections).toBe(3);
    expect(view.items.every(i => i.status === 'done')).toBe(true);
    expect(generateMock).toHaveBeenCalledTimes(3);
    // Шлях до тимчасового файлу знімається з завдання, щойно його віддали в
    // обробку: інакше відновлення після перезапуску чіплялося б за чужий файл.
    expect(finished.items.every((i: any) => !i.tempPath)).toBe(true);
    expect(generateMock.mock.calls.map(c => c[0].filePath)).toEqual(files.map(f => f.path));
  }, 30000);

  it('не зупиняє пачку через один збійний файл', async () => {
    generateMock.mockImplementation(async (params: any) => {
      if (params.originalName === 'bad.txt') throw new Error('ШІ не впорався');
      return generated(params.originalName);
    });

    const job = await enqueueAiImportJob({
      files: fakeFiles(['ok1.txt', 'bad.txt', 'ok2.txt']),
      userId: 'u1',
      userName: 'Тест'
    });

    const view = serializeAiImportJob(await waitForFinish(job.id));

    expect(view.status).toBe('completed');
    expect(view.successFiles).toBe(2);
    expect(view.failedFiles).toBe(1);
    expect(view.items.find(i => i.fileName === 'bad.txt')?.status).toBe('error');
    expect(view.items.find(i => i.fileName === 'bad.txt')?.error).toBe('ШІ не впорався');
    expect(view.items.find(i => i.fileName === 'ok2.txt')?.status).toBe('done');
  }, 30000);

  it('за скасуванням пропускає файли, які ще не почались', async () => {
    let jobId = '';
    generateMock.mockImplementation(async (params: any) => {
      // Скасування приходить, поки обробляється перший файл
      if (params.originalName === 'first.txt') {
        await AiImportJob.updateOne({ id: jobId } as any, { $set: { cancelRequested: true } } as any);
      }
      return generated(params.originalName);
    });

    const job = await enqueueAiImportJob({
      files: fakeFiles(['first.txt', 'second.txt', 'third.txt']),
      userId: 'u1',
      userName: 'Тест'
    });
    jobId = job.id;

    const view = serializeAiImportJob(await waitForFinish(job.id));

    expect(view.status).toBe('cancelled');
    expect(view.items[0].status).toBe('done');
    expect(view.items[1].status).toBe('skipped');
    expect(view.items[2].status).toBe('skipped');
    expect(generateMock).toHaveBeenCalledTimes(1);
  }, 30000);
});
