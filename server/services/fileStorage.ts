import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORAGE_ROOT = path.join(process.cwd(), 'storage');
const PENDING_DIR = path.join(STORAGE_ROOT, 'pending');
const DOCUMENTS_DIR = path.join(STORAGE_ROOT, 'documents');
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export interface SourceFileMeta {
  fileName: string;
  storagePath: string; // relative to STORAGE_ROOT, stored in DB
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedAt: Date;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
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
  fs.renameSync(tempPath, destPath);
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

  const targetDir = path.join(DOCUMENTS_DIR, sectionId, `v${versionNumber}`);
  ensureDir(targetDir);

  const ext = extensionFromName(fileName, mimeType);
  const targetPath = path.join(targetDir, `original${ext}`);

  const fileBuffer = fs.readFileSync(pendingPath);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const sizeBytes = fileBuffer.length;

  fs.renameSync(pendingPath, targetPath);

  const storagePath = path.relative(STORAGE_ROOT, targetPath).split(path.sep).join('/');

  return {
    fileName: fileName || `original${ext}`,
    storagePath,
    mimeType,
    sizeBytes,
    checksum,
    uploadedAt: new Date()
  };
}

export function getFileAbsolutePath(storagePath: string): string {
  return path.join(STORAGE_ROOT, storagePath);
}

export function fileExists(storagePath: string): boolean {
  return fs.existsSync(getFileAbsolutePath(storagePath));
}

/** Deletes pending uploads older than 24h that were never finalized (abandoned imports). */
export function cleanupStalePendingUploads(): void {
  if (!fs.existsSync(PENDING_DIR)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(PENDING_DIR)) {
    const filePath = path.join(PENDING_DIR, name);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > PENDING_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore races (file removed concurrently)
    }
  }
}
