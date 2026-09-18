import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import { convertDocxWithImages, readImageSize } from '../server/services/docxImages.js';

let workDir: string;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-docx-'));
});

afterAll(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

// --- Складання .docx вручну: це звичайний ZIP із кількох XML-частин та media/ ---

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** ZIP без стиснення (метод 0) — JSZip усередині mammoth читає такий архів нарівні зі звичайним. */
function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf-8');
    const crc = zlib.crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);   // версія
    local.writeUInt16LE(0, 6);    // прапорці
    local.writeUInt16LE(0, 8);    // метод: store
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + entry.data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}

/** Мінімальний валідний PNG заданого розміру (8 біт, RGB, фільтр None). */
function makePng(width: number, height: number): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let seed = 7;
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let i = 0; i < stride; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      raw[y * (stride + 1) + 1 + i] = (seed >> 16) & 0xff;
    }
  }

  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

function drawing(relId: string): string {
  return (
    '<w:p><w:r><w:drawing><wp:inline>' +
    '<wp:extent cx="3000000" cy="2000000"/><wp:docPr id="1" name="Picture"/>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
    '<pic:nvPicPr><pic:cNvPr id="0" name="shot"/><pic:cNvPicPr/></pic:nvPicPr>' +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
  );
}

/** `media` — перелік {name, contentType, data}; кожен вставляється в текст окремим абзацом. */
function buildDocx(
  paragraphs: string[],
  media: Array<{ name: string; contentType: string; data: Buffer }>
): Buffer {
  const body = paragraphs
    .map((text, i) => {
      const para = `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
      return media[i] ? para + drawing(`rId${100 + i}`) : para;
    })
    .join('');

  const rels = media
    .map(
      (m, i) =>
        `<Relationship Id="rId${100 + i}" ` +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
        `Target="media/${m.name}"/>`
    )
    .join('');

  const defaults = [...new Set(media.map(m => path.extname(m.name).slice(1)))]
    .map(ext => `<Default Extension="${ext}" ContentType="${media.find(m => m.name.endsWith(ext))!.contentType}"/>`)
    .join('');

  return buildZip([
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          defaults +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>',
        'utf-8'
      )
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>',
        'utf-8'
      )
    },
    {
      name: 'word/_rels/document.xml.rels',
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          rels +
          '</Relationships>',
        'utf-8'
      )
    },
    {
      name: 'word/document.xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`,
        'utf-8'
      )
    },
    ...media.map(m => ({ name: `word/media/${m.name}`, data: m.data }))
  ]);
}

describe('Читання розмірів зображення із заголовка', () => {
  it('розпізнає PNG', () => {
    expect(readImageSize(makePng(200, 150))).toEqual({ width: 200, height: 150 });
  });

  it('повертає null для формату, який не розпізнано', () => {
    expect(readImageSize(Buffer.from('не зображення', 'utf-8'))).toBeNull();
  });
});

describe('Витягування зображень з .docx', () => {
  it('зберігає скріншот у файл і лишає посилання на його місці в тексті', async () => {
    const docxPath = path.join(workDir, 'instruction.docx');
    fs.writeFileSync(
      docxPath,
      buildDocx(
        ['Крок 1: відкрийте журнал', 'Крок 2: перевірте статус'],
        [
          { name: 'image1.png', contentType: 'image/png', data: makePng(400, 300) },
          { name: 'image2.png', contentType: 'image/png', data: makePng(320, 240) }
        ]
      )
    );

    const outDir = path.join(workDir, 'assets-ok');
    const { text, images } = await convertDocxWithImages(docxPath, outDir);

    expect(images).toHaveLength(2);
    expect(images.map(i => i.fileName)).toEqual(['img-001.png', 'img-002.png']);
    expect(images[0].width).toBe(400);
    expect(fs.existsSync(path.join(outDir, 'img-001.png'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'img-002.png'))).toBe(true);

    // Посилання стоїть саме там, де малюнок в оригіналі — після свого кроку
    expect(text).toContain('assets/img-001.png');
    expect(text.indexOf('Крок 1')).toBeLessThan(text.indexOf('assets/img-001.png'));
    expect(text.indexOf('assets/img-001.png')).toBeLessThan(text.indexOf('Крок 2'));
    expect(text).toContain('Крок 2');
  });

  it('відкидає іконки та формати, які браузер не покаже (EMF/WMF)', async () => {
    const docxPath = path.join(workDir, 'icons.docx');
    fs.writeFileSync(
      docxPath,
      buildDocx(
        ['Дрібна піктограма', 'Вставлений EMF'],
        [
          { name: 'image1.png', contentType: 'image/png', data: makePng(24, 24) },
          { name: 'image2.emf', contentType: 'image/x-emf', data: Buffer.alloc(9000, 7) }
        ]
      )
    );

    const outDir = path.join(workDir, 'assets-none');
    const { text, images } = await convertDocxWithImages(docxPath, outDir);

    expect(images).toEqual([]);
    expect(text).not.toContain('<img');
    expect(text).toContain('Дрібна піктограма');
  });

  it('один і той самий логотип зберігається одним файлом', async () => {
    const logo = makePng(300, 200);
    const docxPath = path.join(workDir, 'repeat.docx');
    fs.writeFileSync(
      docxPath,
      buildDocx(
        ['Сторінка 1', 'Сторінка 2', 'Сторінка 3'],
        [
          { name: 'image1.png', contentType: 'image/png', data: logo },
          { name: 'image2.png', contentType: 'image/png', data: logo },
          { name: 'image3.png', contentType: 'image/png', data: logo }
        ]
      )
    );

    const outDir = path.join(workDir, 'assets-dedup');
    const { text, images } = await convertDocxWithImages(docxPath, outDir);

    expect(images).toHaveLength(1);
    expect(fs.readdirSync(outDir)).toEqual(['img-001.png']);
    expect(text.match(/assets\/img-001\.png/g)).toHaveLength(3);
  });
});
