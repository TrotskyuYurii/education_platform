import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';

/**
 * Перетворює .docx на текст для ШІ, попутно зберігаючи вбудовані скріншоти у файли.
 *
 * Раніше документ читався через `mammoth.extractRawText`, який відкидає всі
 * ілюстрації, тож інструкції з Word приходили в платформу взагалі без скріншотів.
 * Тут використовуємо конвертацію в HTML: вона зберігає і структуру (заголовки,
 * списки, таблиці), і — головне — місце кожного зображення в тексті. Модель бачить
 * `![](assets/img-003.png)` саме там, де малюнок стоїть в оригіналі, тому їй не
 * доводиться вгадувати, до якого кроку його прив'язати.
 */
export interface ExtractedDocxImage {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width?: number;
  height?: number;
}

export interface ConvertDocxOptions {
  /** Мінімальні розміри, щоб відсіяти іконки, буліти та логотипи в колонтитулах */
  minWidth?: number;
  minHeight?: number;
  minPixels?: number;
  minBytes?: number;
  maxImages?: number;
  namePrefix?: string;
}

const DEFAULTS = {
  minWidth: 64,
  minHeight: 40,
  minPixels: 6000,
  minBytes: 1024,
  maxImages: 100,
  namePrefix: 'img'
};

/**
 * Word радо вставляє скріншоти як EMF/WMF — браузер їх не покаже, тож такі
 * зображення не зберігаємо взагалі, щоб у інструкції не з'явився «битий» кадр.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp'
};

/** Розміри з заголовка файлу — потрібні, щоб відрізнити скріншот від іконки. */
export function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  // PNG: IHDR завжди перший чанк
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // GIF87a / GIF89a — little-endian у заголовку
  if (buffer.length > 10 && buffer.toString('latin1', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  // BMP
  if (buffer.length > 26 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { width: buffer.readInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
  }

  // WEBP (VP8X / VP8 / VP8L)
  if (buffer.length > 30 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('latin1', 12, 16);
    if (chunk === 'VP8X') {
      return {
        width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
        height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
      };
    }
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }

  // JPEG: шукаємо перший SOF-маркер
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let pos = 2;
    while (pos < buffer.length - 9) {
      if (buffer[pos] !== 0xff) {
        pos++;
        continue;
      }
      const marker = buffer[pos + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      if (marker === 0xda || marker === 0xd9) break;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buffer.readUInt16BE(pos + 7), height: buffer.readUInt16BE(pos + 5) };
      }
      pos += 2 + buffer.readUInt16BE(pos + 2);
    }
  }

  return null;
}

/**
 * Читає .docx: повертає текст у вигляді HTML із посиланнями `assets/img-00N.png`
 * та перелік збережених у `outDir` зображень.
 */
export async function convertDocxWithImages(
  docxPath: string,
  outDir: string,
  options: ConvertDocxOptions = {}
): Promise<{ text: string; images: ExtractedDocxImage[] }> {
  const opts = { ...DEFAULTS, ...options };

  const images: ExtractedDocxImage[] = [];
  const nameByChecksum = new Map<string, string>();
  let position = 0;

  const convertImage = (mammoth as any).images.imgElement((image: any) => {
    // Лічильник рухаємо синхронно: так номер файлу відповідає порядку в документі,
    // навіть якщо читання вмісту завершиться в іншій послідовності.
    const index = ++position;

    return image.read().then((buffer: Buffer) => {
      const extension = EXTENSION_BY_MIME[String(image.contentType || '').toLowerCase()];
      if (!extension) return { src: '' };
      if (buffer.length < opts.minBytes || images.length >= opts.maxImages) return { src: '' };

      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      // Логотип чи піктограма повторюються десятки разів — зберігаємо один файл
      const known = nameByChecksum.get(checksum);
      if (known) return { src: `assets/${known}` };

      const size = readImageSize(buffer);
      if (!size) return { src: '' };
      if (size.width < opts.minWidth || size.height < opts.minHeight) return { src: '' };
      if (size.width * size.height < opts.minPixels) return { src: '' };

      const fileName = `${opts.namePrefix}-${String(index).padStart(3, '0')}${extension}`;
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, fileName), buffer);

      nameByChecksum.set(checksum, fileName);
      images.push({
        fileName,
        mimeType: image.contentType,
        sizeBytes: buffer.length,
        checksum,
        width: size.width,
        height: size.height
      });

      return { src: `assets/${fileName}` };
    });
  });

  const { value: html } = await mammoth.convertToHtml({ path: docxPath }, { convertImage } as any);

  // Відкинуті зображення (EMF/WMF, іконки) лишають по собі порожній тег — прибираємо
  const text = html.replace(/<img[^>]*src=(?:""|'')[^>]*>/gi, '');

  return { text, images };
}
