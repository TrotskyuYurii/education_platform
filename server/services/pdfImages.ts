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
 * Реалізація навмисно без сторонніх бібліотек, але покриває те, чим справді
 * користуються реальні експорти (Word/Excel/BAS/скрін-тули → PDF):
 *   • /DCTDecode — усередині вже лежить готовий JPEG, пишемо байти як є;
 *   • /FlateDecode — «сирі» семпли, розпаковуємо zlib і кодуємо у PNG;
 *   • /DecodeParms з PNG- або TIFF-предиктором (типовий вихід Word) — знімаємо
 *     построкові фільтри, інакше зображення зберігається спотвореним «шумом»;
 *   • /Indexed палітру (скріншот, збережений як PNG-8) — розгортаємо в RGB;
 *   • /DeviceCMYK — переводимо в RGB;
 *   • глибину 1/2/4/8/16 біт на компонент;
 *   • ланцюжки фільтрів на кшталт [/FlateDecode /DCTDecode].
 * Екзотику (JPX, CCITT, JBIG2, LZW) свідомо пропускаємо — краще втратити рідкісний
 * малюнок, ніж зберегти файл, який браузер не покаже.
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
  minPixels?: number;
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

/**
 * Пороги підібрані під вікна облікових програм: вузька панель інструментів
 * (≈300×60) чи невелике діалогове вікно мають потрапити у вибірку, а іконки
 * та логотипи в колонтитулах — ні.
 */
const DEFAULTS = {
  minWidth: 64,
  minHeight: 40,
  minPixels: 6000,
  minBytes: 1024,
  maxImages: 100,
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
  const raw = dictText.match(/\/(?:Filter|F)\s*(\/[A-Za-z0-9]+|\[[^\]]*\])/);
  if (!raw) return [];
  return [...raw[1].matchAll(/\/([A-Za-z0-9]+)/g)].map(m => m[1]);
}

/** Читає `<< ... >>` від позиції `start`, враховуючи вкладені словники. */
function readBalancedDict(text: string, start: number): string | null {
  if (text.slice(start, start + 2) !== '<<') return null;
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++;
      i++;
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth--;
      i++;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export interface PredictorParams {
  predictor: number;
  colors: number;
  bitsPerComponent: number;
  columns: number;
}

function parsePredictorParams(dictText: string): PredictorParams | null {
  const predictor = Number(dictText.match(/\/Predictor\s+(\d+)/)?.[1] ?? 1);
  if (!Number.isFinite(predictor) || predictor <= 1) return null;
  return {
    predictor,
    colors: Number(dictText.match(/\/Colors\s+(\d+)/)?.[1] ?? 1),
    bitsPerComponent: Number(dictText.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8),
    columns: Number(dictText.match(/\/Columns\s+(\d+)/)?.[1] ?? 1)
  };
}

/**
 * Параметри декодування, вирівняні за списком фільтрів: `/DecodeParms` буває
 * словником (один фільтр), масивом зі словників та `null`, або посиланням.
 */
function parseDecodeParms(
  dictText: string,
  objects: Map<number, PdfObject>,
  filterCount: number
): Array<PredictorParams | null> {
  const result: Array<PredictorParams | null> = new Array(Math.max(filterCount, 1)).fill(null);

  const marker = dictText.match(/\/Decode(?:Parms|Params|P)\s*/);
  if (!marker || marker.index === undefined) return result;

  let rest = dictText.slice(marker.index + marker[0].length).trim();

  const indirect = rest.match(/^(\d+)\s+0\s+R/);
  if (indirect) {
    rest = objects.get(Number(indirect[1]))?.dictText.trim() ?? '';
  }

  if (rest.startsWith('<<')) {
    const dict = readBalancedDict(rest, 0);
    if (dict) result[0] = parsePredictorParams(dict);
    return result;
  }

  if (rest.startsWith('[')) {
    let i = 1;
    let slot = 0;
    while (i < rest.length && slot < result.length) {
      const ch = rest[i];
      if (ch === ']') break;
      if (ch === '<' && rest[i + 1] === '<') {
        const dict = readBalancedDict(rest, i);
        if (!dict) break;
        result[slot++] = parsePredictorParams(dict);
        i += dict.length;
        continue;
      }
      if (rest.startsWith('null', i)) {
        slot++;
        i += 4;
        continue;
      }
      i++;
    }
  }

  return result;
}

/** Знімає построкові фільтри PNG (предиктори 10–15) або різницевий TIFF-предиктор (2). */
export function applyPredictor(data: Buffer, params: PredictorParams | null): Buffer | null {
  if (!params) return data;

  const { predictor, colors, bitsPerComponent, columns } = params;
  if (colors < 1 || columns < 1 || bitsPerComponent < 1) return null;

  const rowBytes = Math.ceil((colors * bitsPerComponent * columns) / 8);
  if (rowBytes < 1) return null;

  if (predictor === 2) {
    // TIFF: кожен семпл — різниця з попереднім у рядку (підтримуємо лише 8 біт)
    if (bitsPerComponent !== 8) return null;
    const out = Buffer.from(data);
    const rows = Math.floor(out.length / rowBytes);
    for (let y = 0; y < rows; y++) {
      const base = y * rowBytes;
      for (let i = colors; i < rowBytes; i++) {
        out[base + i] = (out[base + i] + out[base + i - colors]) & 0xff;
      }
    }
    return out;
  }

  if (predictor < 10) return null;

  // PNG-предиктори: кожен рядок починається з байта типу фільтра
  const bpp = Math.max(1, Math.ceil((colors * bitsPerComponent) / 8));
  const rows = Math.floor(data.length / (rowBytes + 1));
  if (rows < 1) return null;

  const out = Buffer.alloc(rows * rowBytes);
  const prior = Buffer.alloc(rowBytes);

  for (let y = 0; y < rows; y++) {
    const src = y * (rowBytes + 1);
    const filterType = data[src];
    const dst = y * rowBytes;
    data.copy(out, dst, src + 1, src + 1 + rowBytes);

    for (let i = 0; i < rowBytes; i++) {
      const left = i >= bpp ? out[dst + i - bpp] : 0;
      const up = prior[i];
      const upLeft = i >= bpp ? prior[i - bpp] : 0;
      let value = out[dst + i];

      switch (filterType) {
        case 0: break;                              // None
        case 1: value += left; break;               // Sub
        case 2: value += up; break;                 // Up
        case 3: value += (left + up) >> 1; break;   // Average
        case 4: {                                   // Paeth
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          break;
        }
        default: return null; // невідомий фільтр — краще пропустити зображення
      }
      out[dst + i] = value & 0xff;
    }

    out.copy(prior, 0, dst, dst + rowBytes);
  }

  return out;
}

type ColorSpace =
  | { kind: 'gray' }
  | { kind: 'rgb' }
  | { kind: 'cmyk' }
  | { kind: 'indexed'; base: 'gray' | 'rgb' | 'cmyk'; palette: Buffer };

/** Розпаковує вміст потоку об'єкта (потрібно для палітри /Indexed, винесеної в окремий потік). */
function readObjectStream(obj: PdfObject, buffer: Buffer, objects: Map<number, PdfObject>): Buffer | null {
  const declaredLength = resolveStreamLength(obj.dictText, objects);
  const sliceEnd = declaredLength !== null
    ? Math.min(obj.streamStart + declaredLength, obj.streamEnd)
    : obj.streamEnd;
  const bytes = buffer.subarray(obj.streamStart, sliceEnd);

  const filters = parseFilters(obj.dictText);
  if (filters.length === 0) return Buffer.from(bytes);
  if (filters.length === 1 && (filters[0] === 'FlateDecode' || filters[0] === 'Fl')) {
    try {
      const inflated = zlib.inflateSync(bytes, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
      return applyPredictor(inflated, parseDecodeParms(obj.dictText, objects, 1)[0]);
    } catch {
      return null;
    }
  }
  return null;
}

/** Палітра /Indexed: рядок у дужках, hex-рядок або посилання на потік. */
function readPaletteBytes(
  raw: string,
  buffer: Buffer,
  objects: Map<number, PdfObject>
): Buffer | null {
  const trimmed = raw.trim();

  const ref = trimmed.match(/^(\d+)\s+0\s+R/);
  if (ref) {
    const obj = objects.get(Number(ref[1]));
    if (!obj) return null;
    return obj.streamStart !== -1
      ? readObjectStream(obj, buffer, objects)
      : readPaletteBytes(obj.dictText, buffer, objects);
  }

  if (trimmed.startsWith('<')) {
    const closing = trimmed.indexOf('>');
    const hex = trimmed.slice(1, closing === -1 ? undefined : closing).replace(/[^0-9a-fA-F]/g, '');
    return Buffer.from(hex.length % 2 ? hex.slice(0, -1) : hex, 'hex');
  }

  if (trimmed.startsWith('(')) {
    const out: number[] = [];
    for (let i = 1; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === ')') break;
      if (ch !== '\\') {
        out.push(trimmed.charCodeAt(i) & 0xff);
        continue;
      }
      i++;
      const octal = trimmed.slice(i, i + 3).match(/^[0-7]{1,3}/);
      if (octal) {
        out.push(parseInt(octal[0], 8) & 0xff);
        i += octal[0].length - 1;
      } else {
        const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        out.push(escapes[trimmed[i]] ?? (trimmed.charCodeAt(i) & 0xff));
      }
    }
    return Buffer.from(out);
  }

  return null;
}

/** Визначає колірний простір зображення (з розгорнутою палітрою для /Indexed). */
function resolveColorSpace(
  dictText: string,
  buffer: Buffer,
  objects: Map<number, PdfObject>,
  depth = 0
): ColorSpace | null {
  if (depth > 4) return null;

  const marker = dictText.match(/\/(?:ColorSpace|CS)\s*/);
  if (!marker || marker.index === undefined) return null;

  const value = dictText.slice(marker.index + marker[0].length).trim();

  const ref = value.match(/^(\d+)\s+0\s+R/);
  if (ref) {
    const target = objects.get(Number(ref[1]));
    if (!target) return null;
    return resolveColorSpace(`/ColorSpace ${target.dictText.trim()}`, buffer, objects, depth + 1);
  }

  if (value.startsWith('[')) {
    const body = value.slice(1);

    if (/^\s*\/(?:Indexed|I)\b/.test(body)) {
      const afterName = body.replace(/^\s*\/(?:Indexed|I)\s*/, '');
      const baseMatch = afterName.match(/^(\/[A-Za-z0-9]+|\[[\s\S]*?\]|\d+\s+0\s+R)\s*(\d+)\s*([\s\S]*)$/);
      if (!baseMatch) return null;

      const baseSpace = resolveColorSpace(`/ColorSpace ${baseMatch[1]}`, buffer, objects, depth + 1);
      if (!baseSpace || baseSpace.kind === 'indexed') return null;

      const palette = readPaletteBytes(baseMatch[3], buffer, objects);
      if (!palette || palette.length === 0) return null;

      return { kind: 'indexed', base: baseSpace.kind, palette };
    }

    if (/\/ICCBased/.test(body)) {
      const iccRef = body.match(/\/ICCBased\s+(\d+)\s+0\s+R/);
      const iccDict = iccRef ? objects.get(Number(iccRef[1]))?.dictText ?? '' : body;
      const n = Number(iccDict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
      if (n === 1) return { kind: 'gray' };
      if (n === 3) return { kind: 'rgb' };
      if (n === 4) return { kind: 'cmyk' };
      return null;
    }

    if (/\/CalRGB/.test(body)) return { kind: 'rgb' };
    if (/\/CalGray/.test(body)) return { kind: 'gray' };
    return null; // /Separation, /DeviceN, /Lab тощо
  }

  if (/^\/(?:DeviceRGB|RGB)\b/.test(value)) return { kind: 'rgb' };
  if (/^\/(?:DeviceGray|G)\b/.test(value)) return { kind: 'gray' };
  if (/^\/(?:DeviceCMYK|CMYK)\b/.test(value)) return { kind: 'cmyk' };
  return null;
}

/** Розпаковує семпли будь-якої глибини у 8 біт на компонент. */
function unpackSamples(
  data: Buffer,
  width: number,
  height: number,
  components: number,
  bits: number,
  scaleToByte: boolean
): Buffer | null {
  if (bits === 8) {
    const needed = width * height * components;
    return data.length >= needed ? data.subarray(0, needed) : null;
  }

  const rowBytes = Math.ceil((width * components * bits) / 8);
  if (data.length < rowBytes * height) return null;

  const max = (1 << bits) - 1;
  const out = Buffer.alloc(width * height * components);
  let outPos = 0;

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    let bitPos = 0;
    for (let i = 0; i < width * components; i++) {
      if (bits === 16) {
        out[outPos++] = data[rowStart + i * 2]; // старший байт — для скріншота достатньо
        continue;
      }
      const byte = data[rowStart + (bitPos >> 3)];
      const value = (byte >> (8 - bits - (bitPos & 7))) & max;
      bitPos += bits;
      out[outPos++] = scaleToByte ? Math.round((value * 255) / max) : value;
    }
  }

  return out;
}

function cmykToRgb(samples: Buffer, pixels: number): Buffer {
  const out = Buffer.alloc(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    const k = samples[i * 4 + 3];
    out[i * 3] = ((255 - samples[i * 4]) * (255 - k)) / 255;
    out[i * 3 + 1] = ((255 - samples[i * 4 + 1]) * (255 - k)) / 255;
    out[i * 3 + 2] = ((255 - samples[i * 4 + 2]) * (255 - k)) / 255;
  }
  return out;
}

/** Розгортає індекси палітри у 8-бітні RGB/Gray семпли. */
function expandIndexed(
  indices: Buffer,
  pixels: number,
  base: 'gray' | 'rgb' | 'cmyk',
  palette: Buffer
): { samples: Buffer; channels: 1 | 3 } | null {
  const baseComponents = base === 'gray' ? 1 : base === 'rgb' ? 3 : 4;
  const entries = Math.floor(palette.length / baseComponents);
  if (entries === 0) return null;

  const raw = Buffer.alloc(pixels * baseComponents);
  for (let i = 0; i < pixels; i++) {
    const at = Math.min(indices[i], entries - 1) * baseComponents;
    palette.copy(raw, i * baseComponents, at, at + baseComponents);
  }

  if (base === 'cmyk') return { samples: cmykToRgb(raw, pixels), channels: 3 };
  return { samples: raw, channels: base === 'gray' ? 1 : 3 };
}

/**
 * JPEG з /DCTDecode пишемо байт-у-байт, але спершу переконуємось, що файл цілий:
 * обрізаний або CMYK-JPEG браузер не покаже, і на сторінці лишиться «битий» кадр
 * замість скріншота.
 */
function validateJpeg(bytes: Buffer): Buffer | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let pos = 2;
  while (pos < bytes.length - 1) {
    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = bytes[pos + 1];
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9) return bytes.subarray(0, pos + 2); // EOI одразу після заголовків
    if (marker === 0xda) break;                             // почався скан — далі стиснені дані
    if (pos + 4 > bytes.length) return null;

    // SOF0..SOF15 (крім DHT/JPG/DAC) описують кадр: [1] точність, [2] висота, [2] ширина, [1] компоненти
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (bytes[pos + 9] === 4) return null; // CMYK/YCCK — Chrome такий JPEG не декодує
    }
    pos += 2 + bytes.readUInt16BE(pos + 2);
  }

  // Скан почався — шукаємо кінець зображення з хвоста
  for (let i = bytes.length - 2; i >= 2; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return bytes.subarray(0, i + 2);
  }
  return null; // EOI немає — потік обрізаний
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

    const width = Number(obj.dictText.match(/\/(?:Width|W)\s+(\d+)/)?.[1] ?? 0);
    const height = Number(obj.dictText.match(/\/(?:Height|H)\s+(\d+)/)?.[1] ?? 0);
    if (width < opts.minWidth || height < opts.minHeight) continue;
    if (width * height < opts.minPixels) continue;
    if (/\/(?:ImageMask|IM)\s+true/.test(obj.dictText)) continue;

    const declaredLength = resolveStreamLength(obj.dictText, objects);
    const sliceEnd = declaredLength !== null
      ? Math.min(obj.streamStart + declaredLength, obj.streamEnd)
      : obj.streamEnd;
    const streamBytes = buffer.subarray(obj.streamStart, sliceEnd);
    if (streamBytes.length === 0) continue;

    const filters = parseFilters(obj.dictText);
    const decodeParms = parseDecodeParms(obj.dictText, objects, filters.length);

    let fileBuffer: Buffer | null = null;
    let mimeType = '';
    let extension = '';

    try {
      // Проходимо ланцюжок фільтрів: розпаковувальні знімаємо самі, а /DCTDecode
      // означає, що далі вже лежить готовий JPEG.
      let payload: Buffer | null = Buffer.from(streamBytes);
      let isJpeg = false;

      for (let i = 0; i < filters.length && payload; i++) {
        const filter = filters[i];
        if (filter === 'FlateDecode' || filter === 'Fl') {
          payload = applyPredictor(
            zlib.inflateSync(payload, { finishFlush: zlib.constants.Z_SYNC_FLUSH }),
            decodeParms[i]
          );
        } else if (filter === 'DCTDecode' || filter === 'DCT') {
          isJpeg = true;
          break;
        } else {
          payload = null; // JPX / CCITT / JBIG2 / LZW / RunLength
        }
      }

      if (!payload) continue;

      if (isJpeg) {
        const jpeg = validateJpeg(payload);
        if (!jpeg) continue;
        fileBuffer = jpeg;
        mimeType = 'image/jpeg';
        extension = '.jpg';
      } else {
        const bits = Number(obj.dictText.match(/\/(?:BitsPerComponent|BPC)\s+(\d+)/)?.[1] ?? 8);
        if (![1, 2, 4, 8, 16].includes(bits)) continue;

        const colorSpace = resolveColorSpace(obj.dictText, buffer, objects);
        if (!colorSpace) continue;

        const pixels = width * height;
        const components = colorSpace.kind === 'indexed'
          ? 1
          : colorSpace.kind === 'gray' ? 1 : colorSpace.kind === 'rgb' ? 3 : 4;

        // Індекси палітри — це номери записів, масштабувати їх до 0–255 не можна
        const unpacked = unpackSamples(payload, width, height, components, bits, colorSpace.kind !== 'indexed');
        if (!unpacked) continue;

        let samples: Buffer;
        let channels: 1 | 3;

        if (colorSpace.kind === 'indexed') {
          const expanded = expandIndexed(unpacked, pixels, colorSpace.base, colorSpace.palette);
          if (!expanded) continue;
          samples = expanded.samples;
          channels = expanded.channels;
        } else if (colorSpace.kind === 'cmyk') {
          samples = cmykToRgb(unpacked, pixels);
          channels = 3;
        } else {
          samples = unpacked;
          channels = colorSpace.kind === 'rgb' ? 3 : 1;
        }

        fileBuffer = encodePng(samples, width, height, channels);
        mimeType = 'image/png';
        extension = '.png';
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
