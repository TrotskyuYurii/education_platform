import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import 'dotenv/config';

import { extractPdfImages } from '../server/services/pdfImages.js';
import { normalizeDocumentAssets } from '../server/services/documentAssets.js';
import {
  createTempExtractionDir,
  savePendingAssets,
  readStoredFile,
  storedFileExists
} from '../server/services/fileStorage.js';

/** Тимчасова тека лише для файлів, які пише екстрактор PDF. */
let workDir: string;

/**
 * Файли документів живуть у GridFS, тож тестам потрібна база. Щоб не зачепити
 * робочі дані, підставляємо власне ім'я бази на тому ж кластері й прибираємо її
 * повністю після прогону.
 */
const TEST_DB_NAME = 'viatec_asset_test';

function withDatabase(uri: string, dbName: string): string {
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${dbName}${query ? `?${query}` : ''}`;
}

const mongoUri = process.env.MONGODB_URI;
const hasDatabase = Boolean(mongoUri);

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-storage-'));
  if (!hasDatabase) return;

  await mongoose.connect(withDatabase(mongoUri!, TEST_DB_NAME));
  await mongoose.connection.db!.dropDatabase();
}, 30000);

afterAll(async () => {
  fs.rmSync(workDir, { recursive: true, force: true });
  if (!hasDatabase) return;

  await mongoose.connection.db!.dropDatabase();
  await mongoose.connection.close();
}, 30000);

/**
 * Мінімальний PDF з однією сторінкою та одним вбудованим зображенням.
 * `imageDict` — усе, що стоїть у словнику після /Subtype /Image (без /Length).
 */
function buildPdfWithImageStream(imageDict: string, stream: Buffer): Buffer {
  const head = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n' +
    '<< /Type /Page /Resources << /XObject << /Im1 2 0 R >> >> >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    `<< /Type /XObject /Subtype /Image ${imageDict} /Length ${stream.length} >>\n` +
    'stream\n',
    'latin1'
  );
  const tail = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
  return Buffer.concat([head, stream, tail]);
}

/** Мінімальний PDF з одним вбудованим RGB-зображенням (/FlateDecode без предиктора). */
function buildPdfWithImage(width: number, height: number, samples: Buffer): Buffer {
  return buildPdfWithImageStream(
    `/Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
    zlib.deflateSync(samples)
  );
}

/** Кодує семпли так, як це робить Word/LibreOffice: PNG-предиктор поверх /FlateDecode. */
function encodeWithPngPredictor(samples: Buffer, width: number, height: number, colors: number): Buffer {
  const rowBytes = width * colors;
  const out = Buffer.alloc(height * (rowBytes + 1));
  const prior = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const dst = y * (rowBytes + 1);
    out[dst] = 2; // Up — найтиповіший фільтр у реальних файлах
    for (let i = 0; i < rowBytes; i++) {
      const raw = samples[y * rowBytes + i];
      out[dst + 1 + i] = (raw - prior[i]) & 0xff;
      prior[i] = raw;
    }
  }

  return zlib.deflateSync(out);
}

/** Мінімальний, але коректний за маркерами JPEG із заданою кількістю компонентів. */
function buildJpeg(width: number, height: number, components: number): Buffer {
  const sof = Buffer.alloc(8 + components * 3);
  sof.writeUInt16BE(sof.length, 0);
  sof[2] = 8;
  sof.writeUInt16BE(height, 3);
  sof.writeUInt16BE(width, 5);
  sof[7] = components;
  for (let i = 0; i < components; i++) {
    sof[8 + i * 3] = i + 1;
    sof[9 + i * 3] = 0x11;
    sof[10 + i * 3] = 0;
  }

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),                       // SOI
    Buffer.from([0xff, 0xc0]), sof,                  // SOF0
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), // SOS
    Buffer.alloc(3000, 0x5a),                        // «стиснені» дані
    Buffer.from([0xff, 0xd9])                        // EOI
  ]);
}

/** Розпаковує PNG, створений екстрактором, назад у сирі семпли. */
function decodePngSamples(png: Buffer, width: number, height: number, channels: number): Buffer {
  const idatParts: Buffer[] = [];
  let offset = 8; // сигнатура
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') idatParts.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    inflated.copy(out, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return out;
}

describe('Витягування зображень з PDF', () => {
  const width = 120;
  const height = 90;
  // Псевдовипадковий шум: реальний скріншот так само погано стискається,
  // а рівний градієнт «схлопнувся» б до кількох сотень байтів і відсіявся як іконка
  const samples = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = (seed >> 16) & 0xff;
  }

  it('зберігає вбудоване зображення окремим PNG-файлом і визначає сторінку', () => {
    const pdfPath = path.join(workDir, 'regulation.pdf');
    fs.writeFileSync(pdfPath, buildPdfWithImage(width, height, samples));

    const outDir = path.join(workDir, 'extracted');
    const images = extractPdfImages(pdfPath, outDir);

    expect(images).toHaveLength(1);
    expect(images[0].fileName).toBe('img-001.png');
    expect(images[0].width).toBe(width);
    expect(images[0].height).toBe(height);
    expect(images[0].page).toBe(1);

    const written = fs.readFileSync(path.join(outDir, 'img-001.png'));
    expect(written.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // Піксели мають дійти без спотворень
    expect(decodePngSamples(written, width, height, 3)).toEqual(samples);
  });

  it('пропускає файли, які не є PDF', () => {
    const notPdf = path.join(workDir, 'plain.txt');
    fs.writeFileSync(notPdf, 'звичайний текст');
    expect(extractPdfImages(notPdf, path.join(workDir, 'none'))).toEqual([]);
  });

  /**
   * Далі — кодування, якими користуються справжні експорти з Word/BAS. Доти,
   * доки вони не підтримувались, скріншоти або взагалі не потрапляли в інструкцію,
   * або зберігалися спотвореними, і читач бачив «Не вдалося завантажити зображення».
   */
  const extractOne = (name: string, dict: string, stream: Buffer) => {
    const pdfPath = path.join(workDir, `${name}.pdf`);
    fs.writeFileSync(pdfPath, buildPdfWithImageStream(dict, stream));
    const outDir = path.join(workDir, name);
    const images = extractPdfImages(pdfPath, outDir);
    return { images, outDir };
  };

  it('знімає PNG-предиктор /DecodeParms без спотворення пікселів', () => {
    const { images, outDir } = extractOne(
      'predictor',
      `/Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /Columns ${width} >>`,
      encodeWithPngPredictor(samples, width, height, 3)
    );

    expect(images).toHaveLength(1);
    const written = fs.readFileSync(path.join(outDir, 'img-001.png'));
    expect(decodePngSamples(written, width, height, 3)).toEqual(samples);
  });

  it('розгортає палітру /Indexed у повноколірний PNG', () => {
    const palette = Buffer.alloc(256 * 3);
    for (let i = 0; i < 256; i++) {
      palette[i * 3] = i;
      palette[i * 3 + 1] = 255 - i;
      palette[i * 3 + 2] = (i * 7) & 0xff;
    }
    const indices = Buffer.alloc(width * height);
    for (let i = 0; i < indices.length; i++) indices[i] = samples[i * 3];

    const { images, outDir } = extractOne(
      'indexed',
      `/Width ${width} /Height ${height} ` +
        `/ColorSpace [/Indexed /DeviceRGB 255 <${palette.toString('hex')}>] ` +
        '/BitsPerComponent 8 /Filter /FlateDecode',
      zlib.deflateSync(indices)
    );

    expect(images).toHaveLength(1);
    const decoded = decodePngSamples(fs.readFileSync(path.join(outDir, 'img-001.png')), width, height, 3);
    const expected = Buffer.alloc(width * height * 3);
    for (let i = 0; i < indices.length; i++) palette.copy(expected, i * 3, indices[i] * 3, indices[i] * 3 + 3);
    expect(decoded).toEqual(expected);
  });

  it('обробляє ланцюжок фільтрів [/FlateDecode /DCTDecode]', () => {
    const jpeg = buildJpeg(width, height, 3);
    const { images, outDir } = extractOne(
      'chain',
      `/Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        '/Filter [/FlateDecode /DCTDecode]',
      zlib.deflateSync(jpeg)
    );

    expect(images).toHaveLength(1);
    expect(images[0].fileName).toBe('img-001.jpg');
    expect(fs.readFileSync(path.join(outDir, 'img-001.jpg'))).toEqual(jpeg);
  });

  it('відкидає обрізаний та CMYK JPEG, які браузер не покаже', () => {
    const cmyk = buildJpeg(width, height, 4);
    expect(extractOne('jpeg-cmyk', `/Width ${width} /Height ${height} /Filter /DCTDecode`, cmyk).images)
      .toEqual([]);

    const truncated = buildJpeg(width, height, 3).subarray(0, 1500);
    expect(extractOne('jpeg-cut', `/Width ${width} /Height ${height} /Filter /DCTDecode`, truncated).images)
      .toEqual([]);
  });

  it('бере вузькі скріншоти вікон, але не іконки', () => {
    const strip = samples.subarray(0, 200 * 40 * 3);
    expect(extractOne(
      'strip',
      '/Width 200 /Height 40 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode',
      zlib.deflateSync(strip)
    ).images).toHaveLength(1);

    const icon = samples.subarray(0, 32 * 32 * 3);
    expect(extractOne(
      'icon',
      '/Width 32 /Height 32 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode',
      zlib.deflateSync(icon)
    ).images).toEqual([]);
  });
});

// Без доступу до бази перевірити сховище документів неможливо — пропускаємо,
// а не «зеленимо» те, що насправді не виконувалось.
describe.skipIf(!hasDatabase)('Нормалізація зображень документа', () => {
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001',
    'hex'
  );
  const dataUri = `data:image/png;base64,${pngBytes.toString('base64')}`;

  it('виносить base64 у файли та проставляє посилання (відносні у .md, абсолютні у контенті)', async () => {
    const sectionId = 'inst-test-1';
    const result = await normalizeDocumentAssets(
      {
        contentMarkdown: `Текст до\n\n![Скріншот вікна](${dataUri})\n\nТекст після`,
        images: [dataUri],
        steps: [{ number: 1, title: 'Крок', description: 'Опис', imageUrl: dataUri }],
        rawMarkdown: `# Назва\n\n![Скріншот вікна](${dataUri})\n`
      },
      { sectionId, versionNumber: 1 }
    );

    // Жодного base64 ані в контенті, ані у файлі Markdown
    expect(JSON.stringify(result.fields)).not.toContain('base64');
    expect(result.rawMarkdown).not.toContain('base64');

    expect(result.assets).toHaveLength(1);
    const fileName = result.assets[0].fileName;

    expect(result.rawMarkdown).toContain(`![Скріншот вікна](assets/${fileName})`);
    expect(result.fields.contentMarkdown).toContain(`/api/sections/${sectionId}/assets/v1/${fileName}`);
    expect(result.fields.images[0]).toBe(`/api/sections/${sectionId}/assets/v1/${fileName}`);
    expect(result.fields.steps[0].imageUrl).toBe(`/api/sections/${sectionId}/assets/v1/${fileName}`);

    // Зображення та instruction.md справді лежать у сховищі, байт-у-байт
    expect(await readStoredFile(`documents/${sectionId}/v1/assets/${fileName}`)).toEqual(pngBytes);
    expect((await readStoredFile(`documents/${sectionId}/v1/instruction.md`))?.toString('utf-8'))
      .toBe(result.rawMarkdown);
    expect(result.markdownFile?.fileName).toBe('instruction.md');
    expect(result.assets[0].storagePath).toBe(`documents/${sectionId}/v1/assets/${fileName}`);
  });

  it('один і той самий скріншот зберігається одним файлом', async () => {
    const result = await normalizeDocumentAssets(
      {
        contentMarkdown: `![Перший](${dataUri})\n![Другий](${dataUri})`,
        rawMarkdown: `![Перший](${dataUri})`
      },
      { sectionId: 'inst-test-2', versionNumber: 1 }
    );

    expect(result.assets).toHaveLength(1);
  });

  it('приймає скріншоти, витягнуті з PDF, і прибирає посилання на неіснуючі файли', async () => {
    const sectionId = 'inst-test-3';
    const pending = createTempExtractionDir();
    fs.writeFileSync(path.join(pending.dir, 'img-001.png'), pngBytes);
    await savePendingAssets(pending.token, pending.dir);

    const result = await normalizeDocumentAssets(
      {
        contentMarkdown: '![Є](assets/img-001.png)\n\n![Вигадане ШІ](assets/img-404.png)\n\nПідсумок',
        rawMarkdown: '![Є](assets/img-001.png)\n![Вигадане ШІ](assets/img-404.png)\n'
      },
      { sectionId, versionNumber: 1, pendingAssetsToken: pending.token }
    );

    expect(result.assets.map(a => a.fileName)).toEqual(['img-001.png']);
    expect(result.fields.contentMarkdown).toContain(`/api/sections/${sectionId}/assets/v1/img-001.png`);
    expect(result.fields.contentMarkdown).not.toContain('img-404');
    // Звіт для адмінки: один скріншот дійшов до тексту, одне посилання було вигаданим
    expect(result.usedAssetCount).toBe(1);
    expect(result.droppedLinkCount).toBe(1);
    expect(result.fields.contentMarkdown).toContain('Підсумок');
    expect(result.rawMarkdown).toBe('![Є](assets/img-001.png)\n');

    // Тимчасова тека звільняється, файл переїжджає під ключ розділу
    expect(fs.existsSync(pending.dir)).toBe(false);
    expect(await storedFileExists(`pending-assets/${pending.token}/img-001.png`)).toBe(false);
    expect(await storedFileExists(`documents/${sectionId}/v1/assets/img-001.png`)).toBe(true);

    // Метадані мають бути переписані на розділ. Якщо тут лишиться pendingToken,
    // планове очищення видалить скріншот через добу — а перелік файлів редакції
    // цього не покаже, бо він шукає за ключем, а не за метаданими.
    const record = await mongoose.connection.db!
      .collection('documents.files')
      .findOne({ filename: `documents/${sectionId}/v1/assets/img-001.png` });
    expect(record?.metadata?.pendingToken).toBeUndefined();
    expect(record?.metadata?.kind).toBe('asset');
    expect(record?.metadata?.sectionId).toBe(sectionId);
    expect(record?.metadata?.versionNumber).toBe(1);
  });

  it('нова редакція успадковує скріншоти попередньої', async () => {
    const sectionId = 'inst-test-4';
    const pending = createTempExtractionDir();
    fs.writeFileSync(path.join(pending.dir, 'img-001.png'), pngBytes);
    await savePendingAssets(pending.token, pending.dir);

    await normalizeDocumentAssets(
      { contentMarkdown: '![Є](assets/img-001.png)', rawMarkdown: '![Є](assets/img-001.png)' },
      { sectionId, versionNumber: 1, pendingAssetsToken: pending.token }
    );

    const { copyVersionAssets } = await import('../server/services/fileStorage.js');
    await copyVersionAssets(sectionId, 1, 2);

    const second = await normalizeDocumentAssets(
      { contentMarkdown: '![Є](assets/img-001.png)', rawMarkdown: '![Є](assets/img-001.png)' },
      { sectionId, versionNumber: 2 }
    );

    expect(second.assets.map(a => a.fileName)).toEqual(['img-001.png']);
    expect(second.fields.contentMarkdown).toContain(`/api/sections/${sectionId}/assets/v2/img-001.png`);
    expect(await readStoredFile(`documents/${sectionId}/v2/assets/img-001.png`)).toEqual(pngBytes);
  });

  it('видалення інструкції прибирає всі її файли', async () => {
    const sectionId = 'inst-test-5';
    await normalizeDocumentAssets(
      { contentMarkdown: `![Скрін](${dataUri})`, rawMarkdown: `![Скрін](${dataUri})` },
      { sectionId, versionNumber: 1 }
    );
    expect(await storedFileExists(`documents/${sectionId}/v1/instruction.md`)).toBe(true);

    const { deleteDocumentStorage } = await import('../server/services/fileStorage.js');
    await deleteDocumentStorage(sectionId);

    expect(await storedFileExists(`documents/${sectionId}/v1/instruction.md`)).toBe(false);
    expect(await storedFileExists(`documents/${sectionId}/v1/assets/inline-001.png`)).toBe(false);
  });
});
