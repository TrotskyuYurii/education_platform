import { logger } from '../../server/modules/core/logger.js';
import { Section } from '../../server/models.js';
import { InstructionVersion } from '../../server/modules/knowledge/models.js';

/**
 * Відновлює кирилицю в назвах завантажених документів.
 *
 * Multer читав імена файлів з multipart-запиту як latin1, хоча браузери шлють
 * їх у UTF-8, тож «Автоматизація.docx» осідало в базі як
 * «ÐÐ²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°ÑÑÑ.docx». Причину виправлено в
 * server/modules/core/uploads.ts; ця міграція лікує вже збережені записи.
 */

/**
 * Перекодовує рядок, помилково прочитаний як latin1, назад у UTF-8.
 * Повертає `null`, якщо ім'я не схоже на зіпсоване, — щоб не чіпати справні.
 */
export function repairLatin1Name(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  // Символ поза latin1 означає, що рядок уже прочитано правильно.
  if (/[^\u0000-ÿ]/.test(raw)) return null;

  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  // Некоректна послідовність байтів дає U+FFFD — тоді це справді латиниця.
  if (decoded === raw || decoded.includes('�')) return null;

  return decoded;
}

/** Поля з іменами файлів, які могли постраждати. */
function repairDoc(doc: any): Record<string, string> | null {
  const updates: Record<string, string> = {};

  const sourceName = repairLatin1Name(doc.sourceFile?.fileName);
  if (sourceName) updates['sourceFile.fileName'] = sourceName;

  return Object.keys(updates).length > 0 ? updates : null;
}

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 011-fix-latin1-file-names`);

  let scanned = 0;
  let repaired = 0;

  for (const model of [Section, InstructionVersion]) {
    const docs = await (model as any).find({ 'sourceFile.fileName': { $exists: true, $ne: '' } });
    for (const doc of docs) {
      scanned += 1;
      const updates = repairDoc(doc);
      if (!updates) continue;

      repaired += 1;
      logger.info(`  ${doc.id || doc._id}: "${doc.sourceFile.fileName}" → "${updates['sourceFile.fileName']}"`);
      if (!isDryRun) {
        await (model as any).updateOne({ _id: doc._id }, { $set: updates });
      }
    }
  }

  logger.info(`[DRY-RUN: ${isDryRun}] 011-fix-latin1-file-names: перевірено ${scanned}, виправлено ${repaired}`);
}
