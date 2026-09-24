import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
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

/**
 * Якщо захисні фільтри моделі відхилять запит, API саме перезапускає його на
 * рекомендованій запасній моделі (її підбирають за причиною відмови) у межах
 * того самого виклику. Адмін отримує результат замість помилки.
 */
const FALLBACK_PARAMS = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

/** Текст відповіді; блоки `fallback` (межі перемикання моделей) пропускаємо. */
function responseText(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

/**
 * Відмова всього ланцюжка (і основної, і запасної моделі) — показуємо людське
 * пояснення. Якщо відповіла запасна модель, лишаємо слід у журналі сервера.
 */
function checkRefusal(message: Anthropic.Beta.BetaMessage, refusalText: string) {
  if (message.stop_reason === 'refusal') {
    throw new InstructionGenerationError(refusalText, 400);
  }
  const fallbackRan = (message.usage.iterations ?? []).some(entry => entry.type === 'fallback_message');
  if (fallbackRan) {
    console.info(`AI request was declined by ${AI_MODEL} and served by fallback model ${message.model}`);
  }
}

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
  const response = await anthropic.beta.messages
    .stream({
      model: AI_MODEL,
      max_tokens: 64000,
      ...FALLBACK_PARAMS,
      messages: [
        { role: 'user', content: [documentBlock, { type: 'text', text: aiPromptGuide }] }
      ]
    })
    .finalMessage();

  checkRefusal(response, 'ШІ відмовився обробляти цей документ. Перевірте його вміст або спробуйте інший файл.');
  const markdownText = responseText(response);

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
  const response = await anthropic.beta.messages
    .stream({
      model: AI_MODEL,
      max_tokens: 32000,
      ...FALLBACK_PARAMS,
      messages: [
        { role: 'user', content: buildAdditionalQuestionsPrompt({ ...params, count }) }
      ]
    })
    .finalMessage();

  checkRefusal(response, 'ШІ відмовився складати питання за цією інструкцією.');
  return responseText(response);
}

/** Кейс, запропонований ШІ, — ще не збережений; адмін переглядає його у формі. */
const GeneratedCaseSchema = z.object({
  title: z.string(),
  scenario: z.string(),
  options: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean(),
    feedback: z.string()
  }))
});

export type GeneratedCase = z.infer<typeof GeneratedCaseSchema>;

/**
 * Складає практичний кейс за текстом інструкції: ситуацію з роботи та 3–4
 * варіанти дій, з яких рівно один правильний. У базу нічого не пишемо —
 * результат підставляється у форму створення кейсу.
 */
export async function generateCaseFromInstruction(params: {
  instructionTitle: string;
  instructionMarkdown: string;
  /** Побажання адміністратора: тема, складність, тип клієнта тощо. */
  hint?: string;
  /** Назви кейсів, які вже є до цієї інструкції, — щоб не повторюватись. */
  existingTitles?: string[];
}): Promise<GeneratedCase> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new InstructionGenerationError('ANTHROPIC_API_KEY is not configured on the server.', 500);
  }
  if (!params.instructionMarkdown.trim()) {
    throw new InstructionGenerationError('Інструкція не містить тексту, з якого можна скласти кейс.', 400);
  }

  const existing = (params.existingTitles || []).filter(Boolean);
  const prompt = [
    `Нижче — текст робочої інструкції «${params.instructionTitle}».`,
    '',
    '<instruction>',
    params.instructionMarkdown,
    '</instruction>',
    '',
    'Склади один практичний кейс для тренування співробітників за цією інструкцією.',
    'Кейс — це реалістична робоча ситуація, у якій співробітник має обрати, як діяти.',
    '',
    'Вимоги:',
    '- Пиши українською мовою.',
    '- title: коротка назва ситуації (до 80 символів).',
    '- scenario: опис обставин на 3–6 речень — хто звертається, що сталося, які деталі важливі. Без підказки, яка відповідь правильна.',
    '- options: 3–4 варіанти дій, рівно один з isCorrect = true. Хибні варіанти мають бути правдоподібними — типовими помилками, яких припускаються на практиці.',
    '- feedback для кожного варіанта: 1–3 речення, чому дія правильна або що саме вона порушує, з посиланням на конкретне правило інструкції.',
    '- Спирайся лише на те, що є в інструкції; не вигадуй правил, яких у ній немає.',
    params.hint?.trim() ? `- Побажання адміністратора щодо кейсу: ${params.hint.trim()}` : '',
    existing.length > 0 ? `- До цієї інструкції вже є кейси: ${existing.map(t => `«${t}»`).join(', ')}. Придумай іншу ситуацію.` : ''
  ].filter(line => line !== '').join('\n');

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    ...FALLBACK_PARAMS,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: betaZodOutputFormat(GeneratedCaseSchema) }
  });

  checkRefusal(response, 'ШІ відмовився складати кейс за цією інструкцією. Спробуйте змінити побажання.');
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new InstructionGenerationError('ШІ повернув неповну відповідь. Спробуйте ще раз.', 500);
  }

  const generated = response.parsed_output;
  const options = generated.options
    .filter(o => o.text.trim())
    .slice(0, 6);
  // Схема не гарантує «рівно один правильний»: якщо ШІ позначив кілька, правильним лишається перший.
  const firstCorrect = options.findIndex(o => o.isCorrect);
  if (options.length < 2 || firstCorrect === -1) {
    throw new InstructionGenerationError('ШІ склав кейс без правильної відповіді. Спробуйте ще раз.', 500);
  }
  return {
    title: generated.title.trim(),
    scenario: generated.scenario.trim(),
    options: options.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }))
  };
}
