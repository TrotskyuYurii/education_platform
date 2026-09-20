import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import {
  generateInstructionFromDocument,
  describeAiError
} from '../../services/aiInstructionGenerator.js';
import { importInstructions } from '../../services/instructionImport.js';
import { Section } from '../../models.js';
// Парсер Markdown спільний з адмінкою: інакше пакетна обробка розбирала б
// відповідь моделі за іншими правилами, ніж завантаження одного файлу.
import { parseMarkdown } from '../../../src/utils/markdownParser.js';

export type AiImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AiImportItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'skipped';

const aiImportItemSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  sizeBytes: { type: Number, default: 0 },
  mimeType: { type: String, default: '' },
  /** Тимчасовий файл multer: живе до моменту, коли черга дійде до нього. */
  tempPath: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'processing', 'done', 'error', 'skipped'], default: 'pending' },
  error: { type: String, default: '' },
  sectionIds: { type: [String], default: [] },
  sectionTitles: { type: [String], default: [] },
  questionCount: { type: Number, default: 0 },
  assetsFound: { type: Number, default: 0 },
  assetsUsed: { type: Number, default: 0 },
  startedAt: { type: Date },
  finishedAt: { type: Date }
}, { _id: false });

const aiImportJobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  createdBy: { type: String, default: '', index: true },
  createdByName: { type: String, default: '' },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
  totalFiles: { type: Number, default: 0 },
  processedFiles: { type: Number, default: 0 },
  successFiles: { type: Number, default: 0 },
  failedFiles: { type: Number, default: 0 },
  createdSections: { type: Number, default: 0 },
  createdQuestions: { type: Number, default: 0 },
  currentFileName: { type: String, default: '' },
  cancelRequested: { type: Boolean, default: false },
  /** Адмін прибрав картку з екрана — у списку активних більше не показуємо. */
  dismissedAt: { type: Date },
  items: { type: [aiImportItemSchema], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  startedAt: { type: Date },
  finishedAt: { type: Date }
});

export const AiImportJob = mongoose.models.AiImportJob || mongoose.model('AiImportJob', aiImportJobSchema);

function removeTempFile(tempPath?: string) {
  if (!tempPath) return;
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  } catch {
    // тимчасові файли приберуть засоби ОС
  }
}

/**
 * Id інструкцій формуються з Date.now(), тож два документи, розібрані в одну
 * мілісекунду, зіткнулися б. Перевіряємо і розводимо їх перед записом.
 */
async function ensureUniqueSectionIds(sections: any[], takenIds: Set<string>): Promise<void> {
  for (const section of sections) {
    let candidate = section.id;
    let attempt = 0;
    // eslint-disable-next-line no-await-in-loop
    while (takenIds.has(candidate) || await Section.exists({ id: candidate } as any)) {
      attempt += 1;
      candidate = `${section.id}-${attempt}`;
    }
    if (candidate !== section.id) section.id = candidate;
    takenIds.add(candidate);
  }
}

/** Обробляє один файл завдання і повертає підсумок для звіту. */
async function processItem(job: any, index: number, takenIds: Set<string>): Promise<void> {
  const item = job.items[index];

  item.status = 'processing';
  item.startedAt = new Date();
  job.currentFileName = item.fileName;
  await job.save();

  try {
    const generated = await generateInstructionFromDocument({
      filePath: item.tempPath,
      originalName: item.fileName,
      mimeType: item.mimeType
    });
    item.tempPath = '';

    const parsed = parseMarkdown(generated.markdown);
    if (parsed.sections.length === 0) {
      throw new Error('ШІ не зміг коректно згенерувати інструкцію з цього файлу.');
    }

    await ensureUniqueSectionIds(parsed.sections, takenIds);

    // Оригінал документа, повний Markdown та скріншоти чіпляються до першої
    // інструкції з файлу — так само, як при поштучному завантаженні.
    const primary: any = parsed.sections[0];
    primary.rawMarkdown = generated.markdown;
    if (generated.sourceFileToken) {
      primary.sourceFileToken = generated.sourceFileToken;
      primary.sourceFileName = generated.sourceFileName;
      primary.sourceMimeType = generated.sourceMimeType;
    }
    if (generated.assetsToken) {
      primary.assetsToken = generated.assetsToken;
    }

    const report = await importInstructions(parsed.sections, parsed.questions, false);

    item.status = 'done';
    item.sectionIds = parsed.sections.map((s: any) => s.id);
    item.sectionTitles = parsed.sections.map((s: any) => s.title);
    item.questionCount = parsed.questions.length;
    item.assetsFound = generated.assets.length;
    item.assetsUsed = report.used;

    job.successFiles += 1;
    job.createdSections += parsed.sections.length;
    job.createdQuestions += parsed.questions.length;
  } catch (err: any) {
    console.error(`AI import job ${job.id}: file "${item.fileName}" failed`, err);
    removeTempFile(item.tempPath);
    item.tempPath = '';
    item.status = 'error';
    item.error = describeAiError(err);
    job.failedFiles += 1;
  } finally {
    item.finishedAt = new Date();
    job.processedFiles += 1;
    job.markModified('items');
    await job.save();
  }
}

async function processJob(job: any): Promise<void> {
  job.status = 'processing';
  job.startedAt = new Date();
  await job.save();

  // Id, видані в межах цього завдання: ще не всі з них встигли потрапити в базу.
  const takenIds = new Set<string>();

  for (let i = 0; i < job.items.length; i += 1) {
    if (job.items[i].status !== 'pending') continue;

    // Скасування перевіряємо в базі: запит на нього міг прийти в інший момент.
    const fresh = await AiImportJob.findOne({ id: job.id } as any, { cancelRequested: 1 } as any);
    if (fresh?.cancelRequested) {
      job.cancelRequested = true;
      break;
    }

    await processItem(job, i, takenIds);
  }

  if (job.cancelRequested) {
    for (const item of job.items) {
      if (item.status === 'pending') {
        removeTempFile(item.tempPath);
        item.tempPath = '';
        item.status = 'skipped';
      }
    }
    job.status = 'cancelled';
  } else {
    job.status = job.failedFiles > 0 && job.successFiles === 0 ? 'failed' : 'completed';
  }

  job.currentFileName = '';
  job.finishedAt = new Date();
  job.markModified('items');
  await job.save();
}

let workerRunning = false;

/**
 * Черга навмисно послідовна: кожен файл — це окремий виклик моделі на кілька
 * десятків секунд, і паралельний запуск пачки швидко впирається в ліміти API.
 */
export function startAiImportWorker(): void {
  if (workerRunning) return;
  workerRunning = true;

  void (async () => {
    try {
      while (true) {
        const job = await AiImportJob.findOne({ status: 'queued' } as any).sort({ createdAt: 1 } as any);
        if (!job) break;
        try {
          await processJob(job);
        } catch (err) {
          console.error('AI import job failed', job.id, err);
          try {
            job.status = 'failed';
            job.currentFileName = '';
            job.finishedAt = new Date();
            await job.save();
          } catch {
            // стан завдання вже не врятувати — далі по черзі
          }
        }
      }
    } finally {
      workerRunning = false;
    }
  })();
}

/**
 * Після перезапуску процесу тимчасові файли незавершених завдань уже недоступні,
 * тож позначаємо їх як перервані, щоб черга не «зависла» назавжди.
 */
export async function resetInterruptedAiImportJobs(): Promise<void> {
  try {
    const stuck = await AiImportJob.find({ status: { $in: ['queued', 'processing'] } } as any);
    for (const job of stuck) {
      for (const item of job.items) {
        removeTempFile(item.tempPath);
        item.tempPath = '';
        if (item.status === 'pending' || item.status === 'processing') {
          item.status = 'error';
          item.error = 'Обробку перервано перезапуском сервера. Завантажте файл ще раз.';
          job.failedFiles += 1;
          job.processedFiles += 1;
        }
      }
      job.status = job.successFiles > 0 ? 'completed' : 'failed';
      job.currentFileName = '';
      job.finishedAt = new Date();
      job.markModified('items');
      await job.save();
    }
  } catch (err) {
    console.error('Failed to reset interrupted AI import jobs', err);
  }
}

/** Ставить пачку завантажених файлів у чергу фонової обробки. */
export async function enqueueAiImportJob(params: {
  files: Array<{ originalname: string; path: string; mimetype: string; size: number }>;
  userId: string;
  userName: string;
}): Promise<any> {
  const job = await AiImportJob.create({
    id: crypto.randomUUID(),
    createdBy: params.userId,
    createdByName: params.userName,
    status: 'queued',
    totalFiles: params.files.length,
    items: params.files.map(file => ({
      fileName: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      tempPath: file.path,
      status: 'pending'
    }))
  });

  startAiImportWorker();
  return job;
}

export interface SerializedAiImportItem {
  fileName: string;
  status: AiImportItemStatus;
  error: string;
  sectionTitles: string[];
  questionCount: number;
  assetsFound: number;
  assetsUsed: number;
}

export interface SerializedAiImportJob {
  id: string;
  status: AiImportJobStatus;
  totalFiles: number;
  processedFiles: number;
  successFiles: number;
  failedFiles: number;
  createdSections: number;
  createdQuestions: number;
  currentFileName: string;
  percent: number;
  cancelRequested: boolean;
  createdAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  createdByName: string;
  items: SerializedAiImportItem[];
}

/** Вигляд завдання для клієнта: без службових шляхів до тимчасових файлів. */
export function serializeAiImportJob(job: any): SerializedAiImportJob {
  const total = job.totalFiles || job.items.length || 0;
  return {
    id: job.id,
    status: job.status as AiImportJobStatus,
    totalFiles: total,
    processedFiles: job.processedFiles,
    successFiles: job.successFiles,
    failedFiles: job.failedFiles,
    createdSections: job.createdSections,
    createdQuestions: job.createdQuestions,
    currentFileName: job.currentFileName,
    percent: total > 0 ? Math.round((job.processedFiles / total) * 100) : 0,
    cancelRequested: job.cancelRequested,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdByName: job.createdByName,
    items: job.items.map((item: any): SerializedAiImportItem => ({
      fileName: item.fileName,
      status: item.status as AiImportItemStatus,
      error: item.error,
      sectionTitles: item.sectionTitles,
      questionCount: item.questionCount,
      assetsFound: item.assetsFound,
      assetsUsed: item.assetsUsed
    }))
  };
}
