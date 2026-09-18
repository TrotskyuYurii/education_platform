import { logger } from '../../server/modules/core/logger.js';
import { Section } from '../../server/models.js';
import { InstructionVersion } from '../../server/modules/knowledge/models.js';
import { normalizeDocumentAssets } from '../../server/services/documentAssets.js';

/**
 * Переводить уже наявні інструкції на файлове зберігання зображень.
 *
 * До цієї зміни скріншоти зберігалися вбудованим Base64 просто в полях документа
 * Mongo (і в rawMarkdown), через що документ роздувався на мегабайти й упирався
 * в ліміт 16 МБ. Тепер кожне зображення — окремий файл у теці документа
 * (storage/documents/<id>/v<N>/assets), а в контенті лишається посилання на нього.
 */
const CONTENT_FIELDS = [
  'contentMarkdown',
  'contentHtml',
  'summary',
  'subtitle',
  'keyPoints',
  'keyFields',
  'stopRules',
  'systemAutomaticActions',
  'images',
  'steps',
  'tableData'
];

function hasInlineImages(doc: any): boolean {
  return CONTENT_FIELDS.concat(['rawMarkdown']).some(field =>
    JSON.stringify(doc[field] ?? null).includes('base64,')
  );
}

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 009-document-images-to-files`);

  const sections = await Section.find({});
  let converted = 0;

  for (const section of sections) {
    const plain: any = section.toObject();
    if (!hasInlineImages(plain)) continue;

    if (isDryRun) {
      logger.info(`[DRY-RUN] Would move inline images out of section ${plain.id} into its document folder`);
      converted++;
      continue;
    }

    const versionNumber = plain.versionNumber || 1;
    const normalized = await normalizeDocumentAssets(plain, { sectionId: plain.id, versionNumber });

    await Section.updateOne(
      { id: plain.id } as any,
      {
        $set: {
          ...normalized.fields,
          assets: normalized.assets,
          rawMarkdown: normalized.rawMarkdown,
          ...(normalized.markdownFile ? { markdownFile: normalized.markdownFile } : {})
        }
      } as any
    );

    // Знімок поточної редакції має відповідати тому, що бачить користувач
    await InstructionVersion.updateOne(
      { sectionId: plain.id, versionNumber } as any,
      {
        $set: {
          ...Object.fromEntries(
            Object.entries(normalized.fields).filter(([key]) => key !== 'images' && key !== 'systemAutomaticActions')
          ),
          assets: normalized.assets,
          rawMarkdown: normalized.rawMarkdown,
          ...(normalized.markdownFile ? { markdownFile: normalized.markdownFile } : {})
        }
      } as any
    );

    converted++;
    logger.info(`Section ${plain.id}: винесено зображень у файли — ${normalized.assets.length}`);
  }

  logger.info(`Migration 009-document-images-to-files completed — оброблено інструкцій: ${converted} з ${sections.length}.`);
}

export async function down(isDryRun: boolean) {
  logger.info(
    `[DRY-RUN: ${isDryRun}] Rolling back 009-document-images-to-files: no-op — ` +
    'зображення лишаються файлами, повертати Base64 у базу немає сенсу.'
  );
}
