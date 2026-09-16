import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

/**
 * Сховище документів прив'язане до process.cwd(), тож тести працюють у власній
 * тимчасовій теці й імпортують модулі вже після переходу в неї.
 */
let workDir: string;
let originalCwd: string;
let extractPdfImages: typeof import('../server/services/pdfImages.js').extractPdfImages;
let normalizeDocumentAssets: typeof import('../server/services/documentAssets.js').normalizeDocumentAssets;
let createPendingAssetsDir: typeof import('../server/services/fileStorage.js').createPendingAssetsDir;

beforeAll(async () => {
  originalCwd = process.cwd();
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-storage-'));
  process.chdir(workDir);

  ({ extractPdfImages } = await import('../server/services/pdfImages.js'));
  ({ normalizeDocumentAssets } = await import('../server/services/documentAssets.js'));
  ({ createPendingAssetsDir } = await import('../server/services/fileStorage.js'));
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** Мінімальний PDF з однією сторінкою та одним вбудованим RGB-зображенням (/FlateDecode). */
function buildPdfWithImage(width: number, height: number, samples: Buffer): Buffer {
  const compressed = zlib.deflateSync(samples);
  const head = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n' +
    '<< /Type /Page /Resources << /XObject << /Im1 2 0 R >> >> >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\n` +
    'stream\n',
    'latin1'
  );
  const tail = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
  return Buffer.concat([head, compressed, tail]);
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
});

describe('Нормалізація зображень документа', () => {
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001',
    'hex'
  );
  const dataUri = `data:image/png;base64,${pngBytes.toString('base64')}`;

  it('виносить base64 у файли та проставляє посилання (відносні у .md, абсолютні у контенті)', () => {
    const sectionId = 'inst-test-1';
    const result = normalizeDocumentAssets(
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

    // Файл зображення та instruction.md справді лежать у теці документа
    const versionDir = path.join(workDir, 'storage', 'documents', sectionId, 'v1');
    expect(fs.existsSync(path.join(versionDir, 'assets', fileName))).toBe(true);
    expect(fs.readFileSync(path.join(versionDir, 'assets', fileName))).toEqual(pngBytes);
    expect(fs.readFileSync(path.join(versionDir, 'instruction.md'), 'utf-8')).toBe(result.rawMarkdown);
    expect(result.markdownFile?.fileName).toBe('instruction.md');
  });

  it('один і той самий скріншот зберігається одним файлом', () => {
    const result = normalizeDocumentAssets(
      {
        contentMarkdown: `![Перший](${dataUri})\n![Другий](${dataUri})`,
        rawMarkdown: `![Перший](${dataUri})`
      },
      { sectionId: 'inst-test-2', versionNumber: 1 }
    );

    expect(result.assets).toHaveLength(1);
  });

  it('приймає скріншоти, витягнуті з PDF, і прибирає посилання на неіснуючі файли', () => {
    const sectionId = 'inst-test-3';
    const pending = createPendingAssetsDir();
    fs.writeFileSync(path.join(pending.dir, 'img-001.png'), pngBytes);

    const result = normalizeDocumentAssets(
      {
        contentMarkdown: '![Є](assets/img-001.png)\n\n![Вигадане ШІ](assets/img-404.png)\n\nПідсумок',
        rawMarkdown: '![Є](assets/img-001.png)\n![Вигадане ШІ](assets/img-404.png)\n'
      },
      { sectionId, versionNumber: 1, pendingAssetsToken: pending.token }
    );

    expect(result.assets.map(a => a.fileName)).toEqual(['img-001.png']);
    expect(result.fields.contentMarkdown).toContain(`/api/sections/${sectionId}/assets/v1/img-001.png`);
    expect(result.fields.contentMarkdown).not.toContain('img-404');
    expect(result.fields.contentMarkdown).toContain('Підсумок');
    expect(result.rawMarkdown).toBe('![Є](assets/img-001.png)\n');
    // Тимчасова тека звільняється після переїзду файлів у теку документа
    expect(fs.existsSync(pending.dir)).toBe(false);
  });
});
