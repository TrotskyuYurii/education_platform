import { logger } from '../../server/modules/core/logger.js';
import { Section, Course, Case } from '../../server/models.js';
import { MaterialFolder } from '../../server/modules/folders/models.js';

/**
 * Ієрархія тек для переліків матеріалів в адмініструванні.
 *
 * Самі теки адміністратор заводить сам, тож сіяти тут нічого — міграція лише
 * будує індекси для нової колекції та для поля folderId на матеріалах, щоб
 * збірка індексу була видимою й записаною в історії, а не тихою фоновою
 * операцією Mongoose при першому запуску.
 *
 * Наявні інструкції, курси та кейси лишаються без теки (folderId відсутній,
 * що читається як «поза теками»), тому переписувати документи не потрібно.
 */
export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 012-material-folders`);

  if (isDryRun) {
    const [sections, courses, cases] = await Promise.all([
      Section.countDocuments({}),
      Course.countDocuments({}),
      Case.countDocuments({})
    ]);
    logger.info(
      `[DRY-RUN] Would create MaterialFolder indexes (id, kind+parentId+order) and folderId indexes on Section (${sections}), Course (${courses}), Case (${cases}). No documents rewritten.`
    );
    return;
  }

  await MaterialFolder.createIndexes();
  await Section.createIndexes();
  await Course.createIndexes();
  await Case.createIndexes();

  logger.info('Migration 012-material-folders completed — folder collection and folderId indexes are in place.');
}

export async function down(isDryRun: boolean) {
  logger.info(
    `[DRY-RUN: ${isDryRun}] Rolling back 012-material-folders: no-op. Folders created by admins are kept, and dropping indexes is not worth the risk of a bad rollback.`
  );
}
