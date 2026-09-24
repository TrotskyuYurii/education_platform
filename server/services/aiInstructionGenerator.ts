import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import {
  savePendingUpload,
  createTempExtractionDir,
  removeTempExtractionDir,
  savePendingAssets
} from './fileStorage.js';
import { extractPdfImages } from './pdfImages.js';
import { convertDocxWithImages } from './docxImages.js';
import { buildInstructionPrompt, buildAdditionalQuestionsPrompt } from '../../shared/instructionPrompt.js';

const AI_MODEL = 'claude-opus-5';

/** Скріншот, витягнутий з оригіналу документа. */
export interface ExtractedDocumentImage {
  fileName: string;
  page?: number;
  width?: number;
  height?: number;
  sizeBytes: number;
}

export interface GeneratedInstruction {
  markdown: string;
  /** Токен, під яким оригінал документа чекає на прив'язку до розділу. */
  sourceFileToken?: string;
  sourceFileName: string;
  sourceMimeType: string;
  /** Токен теки зі скріншотами, витягнутими з оригіналу. */
  assetsToken?: string;
  assets: ExtractedDocumentImage[];
}

/**
 * Помилка обробки документа з кодом HTTP — щоб маршрут віддавав 400 на
 * непідтримуваний формат і 500 на все інше, як і раніше.
 */
export class InstructionGenerationError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'InstructionGenerationError';
    this.status = status;
  }
}

/** Розміри та номер сторінки скріншота — зберігаються разом із файлом, щоб не читати його вдруге. */
function assetDetails(
  images: Array<{ fileName: string; width?: number; height?: number; page?: number }>
): Record<string, { width?: number; height?: number; page?: number }> {
  return Object.fromEntries(
    images.map(img => [img.fileName, { width: img.width, height: img.height, page: img.page }])
  );
}

/** Людське пояснення для типових збоїв Anthropic API. */
export function describeAiError(err: any): string {
  if (err instanceof InstructionGenerationError) return err.message;
  if (err?.status === 429 || (err?.message && String(err.message).includes('429'))) {
    return 'Помилка API (429): Недостатньо коштів на балансі Anthropic API або перевищено ліміт запитів. Будь ласка, поповніть баланс на console.anthropic.com.';
  }
  return err?.message || 'Помилка при генерації через AI';
}

/**
 * Проганяє один вихідний документ (.pdf/.docx/.txt) через модель і повертає
 * Markdown інструкції разом з токенами оригіналу та витягнутих скріншотів.
 *
 * Тимчасовий файл `filePath` завжди прибирається: при успіху він переїжджає у
 * сховище «очікує імпорту», при відмові — видаляється.
 */
export async function generateInstructionFromDocument(params: {
  filePath: string;
  originalName: string;
  mimeType: string;
  /** Назви підрозділів з оргструктури: модель обирає з них, нових не вигадує. */
  departments?: string[];
}): Promise<GeneratedInstruction> {
  const { filePath, originalName, mimeType, departments = [] } = params;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    try { fs.unlinkSync(filePath); } catch { /* прибере ОС */ }
    throw new InstructionGenerationError('ANTHROPIC_API_KEY is not configured on the server.', 500);
  }

  const anthropic = new Anthropic({ apiKey });

  const isPdf = mimeType === 'application/pdf';
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isLegacyDoc = mimeType === 'application/msword';

  let documentBlock: any;
  let readSucceeded = false;
  // Скріншоти, витягнуті з оригіналу: зберігаються у файли, модель лише розставляє на них посилання
  let extractedImages: ExtractedDocumentImage[] = [];
  let assetsToken: string | undefined;
  let sourceFileToken: string | undefined;

  try {
    if (isLegacyDoc) {
      throw new InstructionGenerationError(
        'Формат .doc не підтримується. Будь ласка, збережіть файл як .docx або .pdf.',
        400
      );
    }

    if (isPdf) {
      const fileBuffer = fs.readFileSync(filePath);
      documentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: fileBuffer.toString('base64')
        }
      };

      // Модель бачить сторінки PDF, але не вміє повертати сам малюнок, тому
      // зображення дістаємо самі та кладемо у сховище під токеном очікування.
      const pending = createTempExtractionDir();
      try {
        extractedImages = extractPdfImages(filePath, pending.dir);
        if (extractedImages.length > 0) {
          await savePendingAssets(pending.token, pending.dir, assetDetails(extractedImages));
          assetsToken = pending.token;
        } else {
          removeTempExtractionDir(pending.dir);
        }
      } catch (imgErr) {
        console.error('Failed to extract images from PDF', imgErr);
        removeTempExtractionDir(pending.dir);
        extractedImages = [];
      }
    } else if (isDocx) {
      // Конвертація в HTML (а не extractRawText) зберігає і структуру документа,
      // і місце кожного скріншота в тексті — модель бачить, до якого кроку він належить.
      const pending = createTempExtractionDir();
      try {
        const { text, images } = await convertDocxWithImages(filePath, pending.dir);
        extractedImages = images;
        documentBlock = { type: 'text', text };
        if (images.length > 0) {
          await savePendingAssets(pending.token, pending.dir, assetDetails(images));
          assetsToken = pending.token;
        } else {
          removeTempExtractionDir(pending.dir);
        }
      } catch (docxErr) {
        console.error('Failed to extract images from DOCX', docxErr);
        removeTempExtractionDir(pending.dir);
        extractedImages = [];
        const { value: extractedText } = await mammoth.extractRawText({ path: filePath });
        documentBlock = { type: 'text', text: extractedText };
      }
    } else {
      const extractedText = fs.readFileSync(filePath, 'utf-8');
      documentBlock = { type: 'text', text: extractedText };
    }
    readSucceeded = true;
  } catch (extractErr: any) {
    try { fs.unlinkSync(filePath); } catch { /* прибере ОС */ }
    if (extractErr instanceof InstructionGenerationError) throw extractErr;
    console.error('Failed to read/extract uploaded document', extractErr);
    throw new InstructionGenerationError(
      'Не вдалося обробити файл. Перевірте формат документа (.pdf, .txt, .docx).',
      500
    );
  } finally {
    if (readSucceeded) {
      // Keep the original file in durable "pending" storage so it can be attached to
      // the Section once the user actually imports it (instead of discarding it).
      try {
        const { token } = await savePendingUpload(filePath);
        sourceFileToken = token;
      } catch (e) {
        console.error('Failed to persist source file', e);
      }
    }
  }

  // Now generate the markdown
  // Промпт та правила — спільні з адмінкою (shared/instructionPrompt.ts).
  // Моделі передаємо перелік уже збережених скріншотів, щоб вона розставила
  // посилання на файли замість вбудованого base64.
  const aiPromptGuide = buildInstructionPrompt(
    extractedImages.map(img => ({
      fileName: img.fileName,
      page: img.page,
      width: img.width,
      height: img.height
    })),
    {
      // У тексті з .docx посилання вже стоять на місцях — модель має їх зберегти,
      // а не розставляти заново (у PDF орієнтиром служить номер сторінки).
      inlineMarkers: isDocx,
      departments
    }
  );

  // Повний текст інструкції разом із великим банком питань (20–30) не вміщається
  // у 16 тис. токенів, а довша відповідь потребує стрімінгу, щоб не впертися в
  // HTTP-тайм-аут.
  const response = await anthropic.messages
    .stream({
      model: AI_MODEL,
      max_tokens: 64000,
      messages: [
        { role: 'user', content: [documentBlock, { type: 'text', text: aiPromptGuide }] }
      ]
    })
    .finalMessage();

  const markdownText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    markdown: markdownText,
    sourceFileToken,
    sourceFileName: originalName,
    sourceMimeType: mimeType,
    assetsToken,
    assets: extractedImages.map(img => ({
      fileName: img.fileName,
      page: img.page,
      width: img.width,
      height: img.height,
      sizeBytes: img.sizeBytes
    }))
  };
}

/** Скільки питань можна догенерувати за один запит. */
export const MAX_ADDITIONAL_QUESTIONS = 30;

/**
 * Догенеровує питання до вже збереженої інструкції. Повертає Markdown із
 * блоками «### ПИТАННЯ:» — адмін переглядає їх у редакторі питань і лише тоді
 * зберігає, тож у базу нічого не пишемо.
 */
export async function generateAdditionalQuestions(params: {
  instructionMarkdown: string;
  existingQuestions: string[];
  count: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new InstructionGenerationError('ANTHROPIC_API_KEY is not configured on the server.', 500);
  }
  if (!params.instructionMarkdown.trim()) {
    throw new InstructionGenerationError('Інструкція не містить тексту, з якого можна скласти питання.', 400);
  }

  const count = Math.max(1, Math.min(MAX_ADDITIONAL_QUESTIONS, Math.floor(params.count) || 10));
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages
    .stream({
      model: AI_MODEL,
      max_tokens: 32000,
      messages: [
        { role: 'user', content: buildAdditionalQuestionsPrompt({ ...params, count }) }
      ]
    })
    .finalMessage();

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
