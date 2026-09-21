import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import fs from 'fs';
import type { AddressInfo } from 'net';

import { upload } from '../server/modules/core/uploads.js';
import { repairLatin1Name } from '../scripts/migrations/011-fix-latin1-file-names.js';

/**
 * Імена файлів у multipart-запиті браузер надсилає в UTF-8, а multer за
 * замовчуванням читає їх як latin1 — кирилиця перетворювалась на «крякозябри»
 * і в панелі прогресу ШІ-обробки, і в назві збереженого оригіналу документа.
 */
const tempPaths: string[] = [];

afterAll(() => {
  for (const p of tempPaths) {
    try { fs.unlinkSync(p); } catch { /* файлу вже немає */ }
  }
});

/** Піднімає мінімальний застосунок з тим самим приймачем файлів, що й API. */
async function uploadWithName(fileName: string): Promise<string> {
  const app = express();
  app.post('/upload', upload.single('file'), (req: any, res) => {
    if (req.file?.path) tempPaths.push(req.file.path);
    res.json({ originalname: req.file?.originalname });
  });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const form = new FormData();
    form.append('file', new Blob(['зміст документа']), fileName);

    const res = await fetch(`http://127.0.0.1:${port}/upload`, { method: 'POST', body: form });
    const data = await res.json();
    return data.originalname;
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

describe('імена завантажених файлів', () => {
  it('зберігає кирилицю в назві файлу', async () => {
    expect(await uploadWithName('Автоматизація процесів.docx')).toBe('Автоматизація процесів.docx');
  });

  it('не псує латиницю та пробіли', async () => {
    expect(await uploadWithName('Return policy (v2).pdf')).toBe('Return policy (v2).pdf');
  });
});

describe('відновлення вже зіпсованих назв', () => {
  it('повертає кирилицю з latin1-байтів', () => {
    const broken = Buffer.from('Автоматизація процесів.docx', 'utf8').toString('latin1');
    expect(repairLatin1Name(broken)).toBe('Автоматизація процесів.docx');
  });

  it('не чіпає справні назви', () => {
    expect(repairLatin1Name('Автоматизація.docx')).toBeNull();
    expect(repairLatin1Name('Return policy (v2).pdf')).toBeNull();
    expect(repairLatin1Name('')).toBeNull();
    expect(repairLatin1Name(undefined)).toBeNull();
  });
});
