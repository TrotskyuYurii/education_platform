import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';

/**
 * Витягує растрові зображення (скріншоти, схеми), вбудовані у PDF, у окремі файли.
 *
 * Модель ШІ вміє «бачити» сторінки PDF, але не вміє повертати сам малюнок, тому
 * скріншоти дістаємо самостійно на сервері, зберігаємо у файли поруч із документом,
 * а моделі передаємо лише перелік доступних файлів, щоб вона розставила посилання
 * на них у потрібних місцях Markdown (`![Підпис](assets/img-001.png)`).
 *
 * Реалізація навмисно без сторонніх бібліотек: підтримуються два формати потоків,
 * якими користуються практично всі реальні експорти (Word/Excel/сканер → PDF):
 *   • /DCTDecode  — усередині вже лежить готовий JPEG, пишемо байти як є;
 *   • /FlateDecode — «сирі» семпли, розпаковуємо zlib і кодуємо у PNG.
 * Екзотику (JPX, CCITT, JBIG2, /Indexed) свідомо пропускаємо — краще втратити
 * рідкісний малюнок, ніж зберегти пошкоджений файл.
 */
export interface ExtractedPdfImage {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width: number;
  height: number;
  page?: number;
}

export interface ExtractPdfImagesOptions {
  /** Мінімальні розміри, щоб відсіяти іконки, буліти та лінії-роздільники */
  minWidth?: number;
  minHeight?: number;
  minBytes?: number;
  maxImages?: number;
  /** Префікс імені файлу: img-001.png */
  namePrefix?: string;
}

interface PdfObject {
  num: number;
  dictText: string;
  streamStart: number;
  streamEnd: number;
}

const DEFAULTS = {
  minWidth: 120,
  minHeight: 80,
  minBytes: 2048,
  maxImages: 40,
  namePrefix: 'img'
};

// --- PNG encoder (мінімальний, лише те, що потрібно для 8-бітних RGB/Gray) ---

let crcTable: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(samples: Buffer, width: number, height: number, channels: 1 | 3): Buffer {
  const stride = width * channels;
  // Кожен рядок PNG починається з байта фільтра (0 = None)
  const rawWithFilters = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rawWithFilters[y * (stride + 1)] = 0;
    samples.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 1 ? 0 : 2; // color type: 0 = grayscale, 2 = truecolor
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rawWithFilters, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// --- Мінімальний розбір структури PDF ---

/** Індексує всі `N 0 obj ... endobj` та межі їх потоків. Зсуви у latin1-рядку = зсуви у буфері. */
function indexObjects(latin: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objRe.exec(latin)) !== null) {
    const num = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const objEnd = latin.indexOf('endobj', bodyStart);
    const limit = objEnd === -1 ? latin.length : objEnd;

    const streamKeyword = latin.indexOf('stream', bodyStart);
    let streamStart = -1;
    let streamEnd = -1;
    let dictEnd = limit;

    if (streamKeyword !== -1 && streamKeyword < limit) {
      dictEnd = streamKeyword;
      // Після 'stream' йде CRLF або LF (за специфікацією)
      streamStart = streamKeyword + 'stream'.length;
      if (latin[streamStart] === '\r') streamStart++;
      if (latin[streamStart] === '\n') streamStart++;
      const endStream = latin.indexOf('endstream', streamStart);
      streamEnd = endStream === -1 ? limit : endStream;
    }

    objects.set(num, {
      num,
      dictText: latin.slice(bodyStart, dictEnd),
      streamStart,
      streamEnd
    });
  }

  return objects;
}

/** Best-effort: зіставляє номер об'єкта-зображення з номером сторінки, на якій воно використане. */
function mapImagesToPages(objects: Map<number, PdfObject>): Map<number, number> {
  const pageNums = [...objects.values()]
    .filter(o => /\/Type\s*\/Page(?![s])/.test(o.dictText))
    .map(o => o.num)
    .sort((a, b) => a - b);

  const pageByObject = new Map<number, number>();

  pageNums.forEach((pageObjNum, idx) => {
    const pageDict = objects.get(pageObjNum)!.dictText;

    let resourcesText = pageDict;
    const resourcesRef = pageDict.match(/\/Resources\s+(\d+)\s+0\s+R/);
    if (resourcesRef) {
      resourcesText = objects.get(Number(resourcesRef[1]))?.dictText ?? pageDict;
    }

    let xobjectText = resourcesText.match(/\/XObject\s*<<([\s\S]*?)>>/)?.[1] ?? '';
    if (!xobjectText) {
      const xobjectRef = resourcesText.match(/\/XObject\s+(\d+)\s+0\s+R/);
      if (xobjectRef) xobjectText = objects.get(Number(xobjectRef[1]))?.dictText ?? '';
    }

    const refRe = /\/[A-Za-z0-9._#-]+\s+(\d+)\s+0\s+R/g;
    let ref: RegExpExecArray | null;
    while ((ref = refRe.exec(xobjectText)) !== null) {
      const target = Number(ref[1]);
      if (!pageByObject.has(target)) pageByObject.set(target, idx + 1);
    }
  });

  return pageByObject;
}

function resolveStreamLength(dictText: string, objects: Map<number, PdfObject>): number | null {
  const direct = dictText.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
  if (direct) return Number(direct[1]);

  const indirect = dictText.match(/\/Length\s+(\d+)\s+0\s+R/);
  if (indirect) {
    const target = objects.get(Number(indirect[1]));
    const value = target?.dictText.trim().match(/^(\d+)/);
    if (value) return Number(value[1]);
  }
  return null;
}

function parseFilters(dictText: string): string[] {
  const raw = dictText.match(/\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]*\])/);
  if (!raw) return [];
  return [...raw[1].matchAll(/\/([A-Za-z0-9]+)/g)].map(m => m[1]);
}

/** Кількість колірних компонентів на семпл (3 = RGB, 1 = відтінки сірого). */
function parseComponents(dictText: string, objects: Map<number, PdfObject>): number | null {
  const raw = dictText.match(/\/ColorSpace\s*(\/[A-Za-z0-9]+|\[[\s\S]*?\]|\d+\s+0\s+R)/);
  if (!raw) return null;
  let value = raw[1].trim();

  const refMatch = value.match(/^(\d+)\s+0\s+R$/);
  if (refMatch) {
    value = (objects.get(Number(refMatch[1]))?.dictText ?? '').trim();
  }

  if (/\/DeviceRGB|\/CalRGB/.test(value)) return 3;
  if (/\/DeviceGray|\/CalGray/.test(value)) return 1;
  if (/\/DeviceCMYK/.test(value)) return 4;

  if (/\/ICCBased/.test(value)) {
    const iccRef = value.match(/\/ICCBased\s+(\d+)\s+0\s+R/);
    const iccDict = iccRef ? objects.get(Number(iccRef[1]))?.dictText ?? '' : value;
    const n = iccDict.match(/\/N\s+(\d+)/);
    if (n) return Number(n[1]);
  }

  return null; // /Indexed, /Separation тощо — не підтримуємо
}

export function extractPdfImages(
  pdfPath: string,
  outDir: string,
  options: ExtractPdfImagesOptions = {}
): ExtractedPdfImage[] {
  const opts = { ...DEFAULTS, ...options };

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(pdfPath);
  } catch {
    return [];
  }

  const latin = buffer.toString('latin1');
  if (!latin.startsWith('%PDF')) return [];

  const objects = indexObjects(latin);
  const pageByObject = mapImagesToPages(objects);

  const candidates = [...objects.values()]
    .filter(o => o.streamStart !== -1 && /\/Subtype\s*\/Image/.test(o.dictText))
    .sort((a, b) => {
      const pageA = pageByObject.get(a.num) ?? Number.MAX_SAFE_INTEGER;
      const pageB = pageByObject.get(b.num) ?? Number.MAX_SAFE_INTEGER;
      return pageA - pageB || a.num - b.num;
    });

  const results: ExtractedPdfImage[] = [];
  const seenChecksums = new Set<string>();

  for (const obj of candidates) {
    if (results.length >= opts.maxImages) break;

    const width = Number(obj.dictText.match(/\/Width\s+(\d+)/)?.[1] ?? 0);
    const height = Number(obj.dictText.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
    if (width < opts.minWidth || height < opts.minHeight) continue;
    if (/\/ImageMask\s+true/.test(obj.dictText)) continue;

    const declaredLength = resolveStreamLength(obj.dictText, objects);
    const sliceEnd = declaredLength !== null
      ? Math.min(obj.streamStart + declaredLength, obj.streamEnd)
      : obj.streamEnd;
    const streamBytes = buffer.subarray(obj.streamStart, sliceEnd);
    if (streamBytes.length === 0) continue;

    const filters = parseFilters(obj.dictText);
    let fileBuffer: Buffer | null = null;
    let mimeType = '';
    let extension = '';

    try {
      if (filters.length === 1 && filters[0] === 'DCTDecode') {
        // Усередині вже готовий JPEG
        fileBuffer = Buffer.from(streamBytes);
        mimeType = 'image/jpeg';
        extension = '.jpg';
      } else if (filters.length === 1 && filters[0] === 'FlateDecode') {
        const bits = Number(obj.dictText.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8);
        const components = parseComponents(obj.dictText, objects);
        if (bits !== 8 || (components !== 1 && components !== 3)) continue;

        const samples = zlib.inflateSync(streamBytes, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
        if (samples.length < width * height * components) continue;

        fileBuffer = encodePng(samples, width, height, components as 1 | 3);
        mimeType = 'image/png';
        extension = '.png';
      } else {
        continue; // JPX / CCITT / JBIG2 / ланцюжки фільтрів
      }
    } catch {
      continue;
    }

    if (!fileBuffer || fileBuffer.length < opts.minBytes) continue;

    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    // Логотипи та колонтитули повторюються на кожній сторінці — зберігаємо один раз
    if (seenChecksums.has(checksum)) continue;
    seenChecksums.add(checksum);

    if (results.length === 0) fs.mkdirSync(outDir, { recursive: true });

    const fileName = `${opts.namePrefix}-${String(results.length + 1).padStart(3, '0')}${extension}`;
    fs.writeFileSync(path.join(outDir, fileName), fileBuffer);

    results.push({
      fileName,
      mimeType,
      sizeBytes: fileBuffer.length,
      checksum,
      width,
      height,
      page: pageByObject.get(obj.num)
    });
  }

  return results;
}
