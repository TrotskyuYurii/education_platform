import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../../server/modules/core/logger.js';
import { Section } from '../../server/models.js';
import { InstructionVersion } from '../../server/modules/knowledge/models.js';
import { mimeTypeForAsset } from '../../server/services/fileStorage.js';

/**
 * Переносить файли документів із локальної теки `storage/` у GridFS тієї самої бази.
 *
 * До цієї зміни оригінали, instruction.md та скріншоти лежали на диску процесу,
 * тоді як база спільна. Через це будь-який інший сервер (чи передеплой) бачив у
 * БД записи про скріншоти, але не самі файли — і в інструкціях лишалися «биті»
 * кадри з написом «Не вдалося завантажити зображення».
 *
 * Ключі файлів (`storagePath`) не змінюються — колишній шлях на диску стає іменем
 * файлу в GridFS, тож наявні записи Section/InstructionVersion лишаються чинними.
 *
 * Міграцію треба запускати НА ТІЙ машині, де лежить тека `storage/`. Якщо теки
 * немає, міграція нічого не переносить і лише повідомляє, для яких інструкцій
 * файли втрачено — їх доведеться імпортувати заново.
 */
const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const BUCKET_NAME = 'documents';

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    try {
      return fs.statSync(full).isDirectory() ? walkFiles(full) : [full];
    } catch {
      return [];
    }
  });
}

/** Відновлює метадані за шляхом: documents/<sectionId>/v<N>/[assets/]<файл> */
function metadataForPath(storagePath: string, fileName: string) {
  const match = /^documents\/([^/]+)\/v(\d+)\/(.+)$/.exec(storagePath);
  if (!match) {
    return { kind: 'source', fileName, mimeType: mimeTypeForAsset(fileName) };
  }

  const [, sectionId, version, rest] = match;
  const base = {
    sectionId,
    versionNumber: Number(version),
    fileName,
    uploadedAt: new Date()
  };

  if (rest.startsWith('assets/')) {
    return { ...base, kind: 'asset', mimeType: mimeTypeForAsset(fileName), source: 'pdf' };
  }
  if (fileName === 'instruction.md') {
    return { ...base, kind: 'markdown', mimeType: 'text/markdown' };
  }
  return { ...base, kind: 'source', mimeType: mimeTypeForAsset(fileName) };
}

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 010-files-to-gridfs`);

  const db = mongoose.connection.db;
  if (!db) throw new Error('Немає підключення до бази даних');

  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  const files = db.collection(`${BUCKET_NAME}.files`);

  // 1. Переносимо все, що є на диску цієї машини
  const onDisk = walkFiles(path.join(STORAGE_ROOT, 'documents'));
  let moved = 0;
  let skipped = 0;

  for (const absolutePath of onDisk) {
    const storagePath = path.relative(STORAGE_ROOT, absolutePath).split(path.sep).join('/');
    const fileName = path.basename(storagePath);

    if (await files.findOne({ filename: storagePath })) {
      skipped++;
      continue;
    }

    if (isDryRun) {
      logger.info(`[DRY-RUN] Would upload ${storagePath}`);
      moved++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(absolutePath);
      const metadata: Record<string, any> = {
        ...metadataForPath(storagePath, fileName),
        checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
        sizeBytes: buffer.length
      };

      await new Promise<void>((resolve, reject) => {
        const upload = bucket.openUploadStream(storagePath, { metadata });
        upload.on('error', reject);
        upload.on('finish', () => resolve());
        upload.end(buffer);
      });

      moved++;
    } catch (err) {
      logger.error(`Не вдалося перенести ${storagePath}: ${(err as Error).message}`);
    }
  }

  logger.info(`Перенесено файлів у GridFS: ${moved}${skipped ? `, вже були у сховищі: ${skipped}` : ''}.`);

  // 2. Звіряємо, для яких інструкцій файли так і не знайшлись
  const sections = await Section.find({});
  const orphaned: string[] = [];

  for (const section of sections) {
    const plain: any = section.toObject();
    const paths: string[] = [
      ...(plain.assets || []).map((a: any) => a.storagePath),
      plain.markdownFile?.storagePath,
      plain.sourceFile?.storagePath
    ].filter(Boolean);

    if (paths.length === 0) continue;

    const found = await files.countDocuments({ filename: { $in: paths } });
    if (found < paths.length) {
      orphaned.push(`${plain.id} (${found}/${paths.length})`);
    }
  }

  if (orphaned.length > 0) {
    logger.warn(
      'Для цих інструкцій частина файлів відсутня — імовірно, вони лишились на іншій машині ' +
      'або зникли при передеплої. Такі інструкції треба імпортувати заново: ' +
      orphaned.join('; ')
    );
  } else {
    logger.info('Усі файли, на які посилаються інструкції, є у сховищі.');
  }

  const versionsWithFiles = await InstructionVersion.countDocuments({
    $or: [{ 'assets.0': { $exists: true } }, { markdownFile: { $exists: true } }]
  } as any);
  logger.info(`Знімків редакцій із прикріпленими файлами: ${versionsWithFiles}.`);

  logger.info('Migration 010-files-to-gridfs completed.');
}

export async function down(isDryRun: boolean) {
  logger.info(
    `[DRY-RUN: ${isDryRun}] Rolling back 010-files-to-gridfs: no-op — ` +
    'файли лишаються в базі, повертати їх на локальний диск немає сенсу.'
  );
}
