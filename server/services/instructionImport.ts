import { Section, Question, Progress } from '../models.js';
import { finalizePendingUpload } from './fileStorage.js';
import { normalizeDocumentAssets } from './documentAssets.js';

/**
 * Звіт по скріншотах: адміну важливо бачити не лише «скільки збережено»,
 * а й скільки з них модель справді розставила в тексті інструкції.
 */
export interface ImportAssetReport {
  saved: number;
  used: number;
  dropped: number;
}

/**
 * Записує розібрані інструкції та питання в базу: виносить зображення у файли,
 * прив'язує оригінали документів і чистить прогрес від зниклих розділів.
 *
 * Спільне тіло для ручного імпорту (`POST /admin/import`) та для фонової
 * пакетної ШІ-обробки, щоб обидва шляхи зберігали матеріали однаково.
 */
export async function importInstructions(
  sections: any[],
  questions: any[],
  replace: boolean
): Promise<ImportAssetReport> {
  if (replace) {
    await Section.deleteMany({});
    await Question.deleteMany({});
  }

  // sourceFileToken/sourceFileName/sourceMimeType/assetsToken aren't Section schema fields —
  // pull them off before insertMany, then finalize the pending upload afterwards
  // once we know the section actually exists.
  const pendingFileFinalizations: Array<{ sectionId: string; token: string; fileName: string; mimeType: string }> = [];
  const assetReport: ImportAssetReport = { saved: 0, used: 0, dropped: 0 };
  const cleanSections: any[] = [];

  for (const s of (sections || [])) {
    const { sourceFileToken, sourceFileName, sourceMimeType, assetsToken, ...rest } = s;
    if (sourceFileToken) {
      pendingFileFinalizations.push({ sectionId: s.id, token: sourceFileToken, fileName: sourceFileName, mimeType: sourceMimeType });
    }

    // Зображення виносимо в окремі файли ДО запису розділу: інакше мегабайтний
    // base64 осідає в документі Mongo і впирається в ліміт 16 МБ, замість того
    // щоб лежати у GridFS поруч з оригіналом та instruction.md.
    try {
      const normalized = await normalizeDocumentAssets(rest, {
        sectionId: rest.id,
        versionNumber: rest.versionNumber || 1,
        pendingAssetsToken: assetsToken
      });
      Object.assign(rest, normalized.fields, {
        rawMarkdown: normalized.rawMarkdown,
        assets: normalized.assets,
        markdownFile: normalized.markdownFile
      });

      assetReport.saved += normalized.assets.length;
      assetReport.used += normalized.usedAssetCount;
      assetReport.dropped += normalized.droppedLinkCount;
      if (normalized.droppedLinkCount > 0) {
        console.warn(
          `Section ${rest.id}: removed ${normalized.droppedLinkCount} image link(s) pointing to files that do not exist`
        );
      }
    } catch (assetErr) {
      console.error('Failed to store document images for section', rest.id, assetErr);
    }

    cleanSections.push(rest);
  }

  if (cleanSections.length) await Section.insertMany(cleanSections);
  if (questions?.length) await Question.insertMany(questions);

  for (const pending of pendingFileFinalizations) {
    try {
      const sourceFile = await finalizePendingUpload(pending.token, pending.sectionId, 1, pending.fileName, pending.mimeType);
      await Section.updateOne({ id: pending.sectionId } as any, { $set: { sourceFile } } as any);
    } catch (fileErr) {
      console.error('Failed to finalize source file for section', pending.sectionId, fileErr);
    }
  }

  // After import, ensure users' progress does not reference deleted or non-existent instructions
  const allCurrentSections = await Section.find({} as any, { id: 1 } as any);
  const currentValidIds = allCurrentSections.map(s => s.id);
  await Progress.updateMany(
    {},
    { $pull: { readSectionIds: { $nin: currentValidIds } } } as any
  );

  return assetReport;
}
