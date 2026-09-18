import type { Response } from 'express';
import { openStoredFile } from './fileStorage.js';

/**
 * Віддача файлу зі сховища клієнту.
 *
 * Файли документів лежать у GridFS, тож `res.download`/`res.sendFile` (які працюють
 * зі шляхом на диску) тут не підходять — віддаємо потік і виставляємо заголовки самі.
 */
export type StoredDownload = NonNullable<Awaited<ReturnType<typeof openStoredFile>>>;

/** Віддає файл як вкладення (кнопка «Завантажити оригінал»). */
export function sendStoredFile(res: Response, stored: StoredDownload, downloadName: string): void {
  res.setHeader('Content-Type', stored.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(stored.sizeBytes));
  // Імена файлів у нас кирилицею, тож латинський fallback + UTF-8 варіант (RFC 5987)
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );
  pipeStored(res, stored);
}

/** Віддає файл для показу в сторінці (зображення інструкції). */
export function sendStoredInline(res: Response, stored: StoredDownload, mimeType?: string): void {
  res.setHeader('Content-Type', mimeType || stored.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(stored.sizeBytes));
  res.setHeader('Cache-Control', 'private, max-age=86400');
  pipeStored(res, stored);
}

function pipeStored(res: Response, stored: StoredDownload): void {
  stored.stream.on('error', (err: Error) => {
    console.error('Failed to stream stored file', err);
    res.destroy();
  });
  stored.stream.pipe(res);
}
