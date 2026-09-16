import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Розкладка сховища документів (один документ = одна тека з усіма своїми файлами):
 *
 *   storage/
 *     pending/<token>                    — щойно завантажений оригінал, ще не прив'язаний до розділу
 *     pending-assets/<token>/img-001.png — зображення, витягнуті з PDF, до моменту імпорту
 *     documents/<sectionId>/v<N>/
 *         original.pdf                   — файл-оригінал (PDF/DOCX/TXT)
 *         instruction.md                 — проаналізований Markdown (текст, стоп-списки, питання)
 *         assets/img-001.png             — скріншоти, на які посилається instruction.md
 *
 * Markdown на диску посилається на зображення відносним шляхом `assets/img-001.png`
 * (тека самодостатня й переносима), а в БД ті самі посилання зберігаються як
 * абсолютний API-шлях `/api/sections/<id>/assets/v<N>/img-001.png` (див. documentAssets.ts).
 */
const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const PENDING_DIR = path.join(STORAGE_ROOT, 'pending');
const PENDING_ASSETS_DIR = path.join(STORAGE_ROOT, 'pending-assets');
const DOCUMENTS_DIR = path.join(STORAGE_ROOT, 'documents');
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export const MARKDOWN_FILE_NAME = 'instruction.md';
export const ASSETS_DIR_NAME = 'assets';

export interface SourceFileMeta {
  fileName: string;
  storagePath: string; // relative to STORAGE_ROOT, stored in DB
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedAt: Date;
}

export interface DocumentAssetMeta {
  fileName: string;
  storagePath: string; // relative to STORAGE_ROOT
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width?: number;
  height?: number;
  page?: number;
  /** 'pdf' — витягнуто з оригіналу, 'inline' — перенесено з base64, 'upload' — додано вручну */
  source?: string;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function toStoragePath(absolutePath: string): string {
  return path.relative(STORAGE_ROOT, absolutePath).split(path.sep).join('/');
}

/** Ідентифікатори розділів формуються системою (`inst-...`), але в шлях їх пускаємо лише після перевірки. */
export function safeSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Некоректний ідентифікатор документа');
  }
  return cleaned;
}

export function getDocumentVersionDir(sectionId: string, versionNumber: number): string {
  const version = Math.max(1, Math.floor(Number(versionNumber) || 1));
  return path.join(DOCUMENTS_DIR, safeSegment(sectionId), `v${version}`);
}

export function getVersionAssetsDir(sectionId: string, versionNumber: number): string {
  return path.join(getDocumentVersionDir(sectionId, versionNumber), ASSETS_DIR_NAME);
}

function extensionFromName(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName || '');
  if (ext) return ext;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  return '.bin';
}

/**
 * Moves a multer temp-upload file into durable "pending" storage, keyed by a random token,
 * so it survives until the owning Section/version is known and finalization can occur.
 */
export function savePendingUpload(tempPath: string): { token: string } {
  ensureDir(PENDING_DIR);
  const token = crypto.randomUUID();
  const destPath = path.join(PENDING_DIR, token);
  moveFile(tempPath, destPath);
  return { token };
}

/**
 * Moves a previously-pending upload into its permanent location for a given section/version,
 * computing checksum/size, and returns metadata to persist on the Section/InstructionVersion doc.
 */
export function finalizePendingUpload(
  token: string,
  sectionId: string,
  versionNumber: number,
  fileName: string,
  mimeType: string
): SourceFileMeta {
  const pendingPath = path.join(PENDING_DIR, token);
  if (!fs.existsSync(pendingPath)) {
    throw new Error('Завантажений файл не знайдено або термін його зберігання минув. Завантажте файл ще раз.');
  }

  const targetDir = getDocumentVersionDir(sectionId, versionNumber);
  ensureDir(targetDir);

  const ext = extensionFromName(fileName, mimeType);
  const targetPath = path.join(targetDir, `original${ext}`);

  const fileBuffer = fs.readFileSync(pendingPath);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const sizeBytes = fileBuffer.length;

  moveFile(pendingPath, targetPath);

  return {
    fileName: fileName || `original${ext}`,
    storagePath: toStoragePath(targetPath),
    mimeType,
    sizeBytes,
    checksum,
    uploadedAt: new Date()
  };
}

/** rename() падає з EXDEV, якщо тимчасова тека та сховище на різних дисках — тоді копіюємо. */
function moveFile(from: string, to: string) {
  try {
    fs.renameSync(from, to);
  } catch (err: any) {
    if (err?.code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

// --- Зображення документа (скріншоти) ---

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp'
};

export function mimeTypeForAsset(fileName: string): string {
  return IMAGE_MIME_BY_EXT[path.extname(fileName).toLowerCase()] || 'application/octet-stream';
}

export function extensionForImageMime(mimeType: string): string {
  const found = Object.entries(IMAGE_MIME_BY_EXT).find(([, mime]) => mime === mimeType);
  return found ? found[0] : '.png';
}

/** Створює тимчасову теку для зображень, витягнутих із документа до його імпорту. */
export function createPendingAssetsDir(): { token: string; dir: string } {
  const token = crypto.randomUUID();
  const dir = path.join(PENDING_ASSETS_DIR, token);
  ensureDir(dir);
  return { token, dir };
}

export function getPendingAssetsDir(token: string): string {
  return path.join(PENDING_ASSETS_DIR, safeSegment(token));
}

/** Переносить тимчасові зображення у теку документа (documents/<id>/v<N>/assets). */
export function finalizePendingAssets(
  token: string,
  sectionId: string,
  versionNumber: number
): DocumentAssetMeta[] {
  const pendingDir = getPendingAssetsDir(token);
  if (!fs.existsSync(pendingDir)) return [];

  const targetDir = getVersionAssetsDir(sectionId, versionNumber);
  ensureDir(targetDir);

  const assets: DocumentAssetMeta[] = [];
  for (const name of fs.readdirSync(pendingDir).sort()) {
    const fromPath = path.join(pendingDir, name);
    try {
      if (!fs.statSync(fromPath).isFile()) continue;
      const fileName = uniqueAssetName(targetDir, name);
      const targetPath = path.join(targetDir, fileName);
      const buffer = fs.readFileSync(fromPath);
      moveFile(fromPath, targetPath);
      assets.push({
        fileName,
        storagePath: toStoragePath(targetPath),
        mimeType: mimeTypeForAsset(fileName),
        sizeBytes: buffer.length,
        checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
        source: 'pdf'
      });
    } catch (err) {
      console.error('Failed to finalize asset', name, err);
    }
  }

  try {
    fs.rmSync(pendingDir, { recursive: true, force: true });
  } catch {
    // тека прибереться плановим очищенням
  }

  return assets;
}

function uniqueAssetName(dir: string, desiredName: string): string {
  const base = path.basename(desiredName).replace(/[^A-Za-z0-9._-]/g, '_') || 'image.png';
  if (!fs.existsSync(path.join(dir, base))) return base;

  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

/** Зберігає зображення (з base64 або ручного завантаження) у теку документа. */
export function saveVersionAsset(
  sectionId: string,
  versionNumber: number,
  desiredName: string,
  buffer: Buffer,
  mimeType: string,
  source: DocumentAssetMeta['source'] = 'inline'
): DocumentAssetMeta {
  const targetDir = getVersionAssetsDir(sectionId, versionNumber);
  ensureDir(targetDir);

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  // Той самий скріншот часто трапляється в документі кілька разів — не дублюємо файл
  for (const existing of listVersionAssets(sectionId, versionNumber)) {
    if (existing.checksum === checksum) return existing;
  }

  const fileName = uniqueAssetName(targetDir, desiredName);
  const targetPath = path.join(targetDir, fileName);
  fs.writeFileSync(targetPath, buffer);

  return {
    fileName,
    storagePath: toStoragePath(targetPath),
    mimeType: mimeType || mimeTypeForAsset(fileName),
    sizeBytes: buffer.length,
    checksum,
    source
  };
}

export function listVersionAssets(sectionId: string, versionNumber: number): DocumentAssetMeta[] {
  const dir = getVersionAssetsDir(sectionId, versionNumber);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).sort().flatMap(fileName => {
    const filePath = path.join(dir, fileName);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return [];
      const buffer = fs.readFileSync(filePath);
      return [{
        fileName,
        storagePath: toStoragePath(filePath),
        mimeType: mimeTypeForAsset(fileName),
        sizeBytes: stat.size,
        checksum: crypto.createHash('sha256').update(buffer).digest('hex')
      }];
    } catch {
      return [];
    }
  });
}

/** Нова редакція успадковує зображення попередньої, щоб посилання в її Markdown не «побились». */
export function copyVersionAssets(sectionId: string, fromVersion: number, toVersion: number): void {
  const fromDir = getVersionAssetsDir(sectionId, fromVersion);
  if (!fs.existsSync(fromDir) || fromVersion === toVersion) return;

  const toDir = getVersionAssetsDir(sectionId, toVersion);
  ensureDir(toDir);
  for (const name of fs.readdirSync(fromDir)) {
    const target = path.join(toDir, name);
    if (fs.existsSync(target)) continue;
    try {
      fs.copyFileSync(path.join(fromDir, name), target);
    } catch (err) {
      console.error('Failed to carry asset over to the new version', name, err);
    }
  }
}

/** Повертає абсолютний шлях до зображення документа або null (захист від виходу за межі теки). */
export function resolveVersionAssetPath(
  sectionId: string,
  versionNumber: number,
  fileName: string
): string | null {
  const dir = getVersionAssetsDir(sectionId, versionNumber);
  const resolved = path.resolve(dir, path.basename(String(fileName || '')));
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) return null;
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null;
}

/** Зберігає проаналізований Markdown як справжній файл поруч з оригіналом. */
export function saveMarkdownFile(
  sectionId: string,
  versionNumber: number,
  markdown: string
): SourceFileMeta {
  const targetDir = getDocumentVersionDir(sectionId, versionNumber);
  ensureDir(targetDir);

  const targetPath = path.join(targetDir, MARKDOWN_FILE_NAME);
  const buffer = Buffer.from(markdown ?? '', 'utf-8');
  fs.writeFileSync(targetPath, buffer);

  return {
    fileName: MARKDOWN_FILE_NAME,
    storagePath: toStoragePath(targetPath),
    mimeType: 'text/markdown',
    sizeBytes: buffer.length,
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    uploadedAt: new Date()
  };
}

/** Прибирає всю теку документа — викликається при видаленні інструкції. */
export function deleteDocumentStorage(sectionId: string): void {
  try {
    fs.rmSync(path.join(DOCUMENTS_DIR, safeSegment(sectionId)), { recursive: true, force: true });
  } catch (err) {
    console.error('Failed to delete document storage', sectionId, err);
  }
}

export function getFileAbsolutePath(storagePath: string): string {
  return path.join(STORAGE_ROOT, storagePath);
}

export function fileExists(storagePath: string): boolean {
  return fs.existsSync(getFileAbsolutePath(storagePath));
}

/**
 * Deletes pending uploads older than 24h that were never finalized (abandoned imports).
 * Covers both the original files and the image folders extracted from them.
 */
export function cleanupStalePendingUploads(): void {
  const now = Date.now();

  for (const dir of [PENDING_DIR, PENDING_ASSETS_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const entryPath = path.join(dir, name);
      try {
        const stat = fs.statSync(entryPath);
        if (now - stat.mtimeMs > PENDING_MAX_AGE_MS) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      } catch {
        // ignore races (file removed concurrently)
      }
    }
  }
}
