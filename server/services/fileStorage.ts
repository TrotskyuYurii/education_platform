import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Readable, Transform } from 'stream';
import mongoose from 'mongoose';

/**
 * Сховище файлів документа: оригінал, проаналізований Markdown та скріншоти.
 *
 * Усе лежить у GridFS тієї самої бази, що й самі інструкції. Так було не завжди:
 * раніше файли писалися в теку `storage/` поруч із процесом, і оскільки база
 * спільна, а тека — локальна, будь-який інший сервер (чи передеплой) бачив записи
 * про скріншоти, але не самі файли, і в інструкції лишалися «биті» кадри.
 *
 * Ключ файлу (`storagePath`) лишився тим самим, що й за файлової схеми, — це
 * дозволяє записам у БД пережити перехід без переписування:
 *   documents/<sectionId>/v<N>/original.pdf     — файл-оригінал (PDF/DOCX/TXT)
 *   documents/<sectionId>/v<N>/instruction.md   — проаналізований Markdown
 *   documents/<sectionId>/v<N>/assets/img-001.png — скріншоти, на які він посилається
 *   pending/<token>                             — завантажений оригінал до імпорту розділу
 *   pending-assets/<token>/img-001.png          — витягнуті скріншоти до імпорту розділу
 *
 * Markdown на диску посилається на зображення відносним шляхом `assets/img-001.png`,
 * а в БД ті самі посилання зберігаються як абсолютний API-шлях
 * `/api/sections/<id>/assets/v<N>/img-001.png` (див. documentAssets.ts).
 */
const BUCKET_NAME = 'documents';
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export const MARKDOWN_FILE_NAME = 'instruction.md';
export const ASSETS_DIR_NAME = 'assets';

export interface SourceFileMeta {
  fileName: string;
  storagePath: string; // ключ файлу в GridFS, зберігається в БД
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedAt: Date;
}

export interface DocumentAssetMeta {
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width?: number;
  height?: number;
  page?: number;
  /** 'pdf' — витягнуто з оригіналу, 'inline' — перенесено з base64, 'upload' — додано вручну */
  source?: string;
}

interface StoredFileRecord {
  _id: any;
  filename: string;
  length: number;
  uploadDate: Date;
  metadata?: Record<string, any>;
}

type Bucket = InstanceType<typeof mongoose.mongo.GridFSBucket>;

let bucket: Bucket | null = null;
let indexesEnsured = false;

function getDb() {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error('Немає підключення до бази даних — файли документів недоступні');
  }
  return db;
}

function getBucket(): Bucket {
  // Підключення може перевстановитись, тому кеш скидаємо разом із ним
  if (!bucket || (bucket as any).s?.db !== getDb()) {
    bucket = new mongoose.mongo.GridFSBucket(getDb(), { bucketName: BUCKET_NAME });
  }
  return bucket!;
}

/** Службова колекція GridFS. Типізуємо вільно: драйвер описує її власною схемою. */
function filesCollection() {
  return getDb().collection(`${BUCKET_NAME}.files`) as any;
}

/** Пошук за sectionId та за токеном очікування — обидва потрібні на гарячих шляхах. */
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await filesCollection().createIndexes([
      { key: { 'metadata.sectionId': 1, 'metadata.versionNumber': 1 } },
      { key: { 'metadata.pendingToken': 1 } }
    ]);
  } catch (err) {
    indexesEnsured = false;
    console.error('Failed to create GridFS indexes', err);
  }
}

/** Ідентифікатори розділів формуються системою (`inst-...`), але в ключ їх пускаємо лише після перевірки. */
export function safeSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Некоректний ідентифікатор документа');
  }
  return cleaned;
}

function versionOf(versionNumber: number): number {
  return Math.max(1, Math.floor(Number(versionNumber) || 1));
}

export function getDocumentVersionPath(sectionId: string, versionNumber: number): string {
  return `documents/${safeSegment(sectionId)}/v${versionOf(versionNumber)}`;
}

export function getVersionAssetPath(sectionId: string, versionNumber: number, fileName: string): string {
  return `${getDocumentVersionPath(sectionId, versionNumber)}/${ASSETS_DIR_NAME}/${path.basename(fileName)}`;
}

// --- Низькорівневі операції GridFS ---

async function findByPath(storagePath: string): Promise<StoredFileRecord | null> {
  return filesCollection().findOne({ filename: storagePath });
}

export async function storedFileExists(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    return (await findByPath(storagePath)) !== null;
  } catch {
    return false;
  }
}

/** Відкриває файл на читання: потік для віддачі клієнту та метадані для заголовків. */
export async function openStoredFile(
  storagePath: string
): Promise<{ stream: Readable; sizeBytes: number; mimeType: string; fileName: string } | null> {
  const record = await findByPath(storagePath);
  if (!record) return null;

  return {
    stream: getBucket().openDownloadStream(record._id) as unknown as Readable,
    sizeBytes: record.length,
    mimeType: record.metadata?.mimeType || mimeTypeForAsset(storagePath),
    fileName: record.metadata?.fileName || path.basename(storagePath)
  };
}

export async function readStoredFile(storagePath: string): Promise<Buffer | null> {
  const record = await findByPath(storagePath);
  if (!record) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of getBucket().openDownloadStream(record._id)) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function deleteByPath(storagePath: string): Promise<void> {
  const records = await filesCollection().find({ filename: storagePath }).toArray();
  for (const record of records) {
    try {
      await getBucket().delete(record._id);
    } catch (err) {
      console.error('Failed to delete stored file', storagePath, err);
    }
  }
}

/**
 * Записує потік у GridFS під заданим ключем, попутно рахуючи розмір і контрольну суму.
 * Файл із таким самим ключем замінюється — один шлях завжди означає одну версію файлу.
 */
async function writeStream(
  storagePath: string,
  source: Readable,
  metadata: Record<string, any>
): Promise<{ sizeBytes: number; checksum: string }> {
  await ensureIndexes();
  await deleteByPath(storagePath);

  const hash = crypto.createHash('sha256');
  let sizeBytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.length;
      callback(null, chunk);
    }
  });

  const upload = getBucket().openUploadStream(storagePath, { metadata });

  await new Promise<void>((resolve, reject) => {
    source.on('error', reject);
    meter.on('error', reject);
    upload.on('error', reject);
    upload.on('finish', () => resolve());
    source.pipe(meter).pipe(upload);
  });

  const checksum = hash.digest('hex');
  // Контрольна сума відома лише після зчитування всього потоку
  await filesCollection().updateOne(
    { _id: upload.id },
    { $set: { 'metadata.checksum': checksum, 'metadata.sizeBytes': sizeBytes } }
  );

  return { sizeBytes, checksum };
}

async function writeBuffer(
  storagePath: string,
  buffer: Buffer,
  metadata: Record<string, any>
): Promise<{ sizeBytes: number; checksum: string }> {
  return writeStream(storagePath, Readable.from(buffer), metadata);
}

// --- Оригінали документів ---

function extensionFromName(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName || '');
  if (ext) return ext;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  return '.bin';
}

/**
 * Переносить щойно завантажений файл (тимчасовий файл multer) у сховище під
 * випадковим токеном — він доживе там до моменту, коли стане відомий розділ.
 */
export async function savePendingUpload(tempPath: string): Promise<{ token: string }> {
  const token = crypto.randomUUID();
  await writeStream(`pending/${token}`, fs.createReadStream(tempPath), {
    kind: 'pending-source',
    pendingToken: token,
    uploadedAt: new Date()
  });

  try {
    fs.unlinkSync(tempPath);
  } catch {
    // тимчасовий файл приберуть засоби ОС
  }

  return { token };
}

/** Прив'язує раніше завантажений оригінал до конкретного розділу та редакції. */
export async function finalizePendingUpload(
  token: string,
  sectionId: string,
  versionNumber: number,
  fileName: string,
  mimeType: string
): Promise<SourceFileMeta> {
  const pendingPath = `pending/${safeSegment(token)}`;
  const record = await findByPath(pendingPath);
  if (!record) {
    throw new Error('Завантажений файл не знайдено або термін його зберігання минув. Завантажте файл ще раз.');
  }

  const ext = extensionFromName(fileName, mimeType);
  const storagePath = `${getDocumentVersionPath(sectionId, versionNumber)}/original${ext}`;
  const uploadedAt = new Date();

  await deleteByPath(storagePath);
  await getBucket().rename(record._id, storagePath);
  await filesCollection().updateOne(
    { _id: record._id },
    {
      $set: {
        metadata: {
          kind: 'source',
          sectionId,
          versionNumber: versionOf(versionNumber),
          fileName: fileName || `original${ext}`,
          mimeType,
          checksum: record.metadata?.checksum || '',
          sizeBytes: record.length,
          uploadedAt
        }
      }
    }
  );

  return {
    fileName: fileName || `original${ext}`,
    storagePath,
    mimeType,
    sizeBytes: record.length,
    checksum: record.metadata?.checksum || '',
    uploadedAt
  };
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

/**
 * Локальна тимчасова тека, у яку екстрактори (PDF/DOCX) пишуть знайдені зображення.
 * Вона живе лише в межах одного запиту — у сховище файли переносить `savePendingAssets`.
 */
export function createTempExtractionDir(): { token: string; dir: string } {
  const token = crypto.randomUUID();
  const dir = path.join(os.tmpdir(), 'edu-extract', token);
  fs.mkdirSync(dir, { recursive: true });
  return { token, dir };
}

export function removeTempExtractionDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // тимчасові теки приберуть засоби ОС
  }
}

/** Переносить витягнуті зображення з тимчасової теки у сховище під токеном очікування. */
export async function savePendingAssets(
  token: string,
  dir: string,
  details: Record<string, { width?: number; height?: number; page?: number }> = {}
): Promise<number> {
  let saved = 0;

  for (const name of fs.readdirSync(dir).sort()) {
    const filePath = path.join(dir, name);
    try {
      if (!fs.statSync(filePath).isFile()) continue;
      await writeStream(`pending-assets/${token}/${name}`, fs.createReadStream(filePath), {
        kind: 'pending-asset',
        pendingToken: token,
        fileName: name,
        mimeType: mimeTypeForAsset(name),
        source: 'pdf',
        ...details[name],
        uploadedAt: new Date()
      });
      saved++;
    } catch (err) {
      console.error('Failed to store extracted image', name, err);
    }
  }

  removeTempExtractionDir(dir);
  return saved;
}

export async function discardPendingAssets(token: string): Promise<void> {
  const records = await filesCollection().find({ 'metadata.pendingToken': token }).toArray();
  for (const record of records) {
    try {
      await getBucket().delete(record._id);
    } catch {
      // прибереться плановим очищенням
    }
  }
}

async function uniqueAssetName(sectionId: string, versionNumber: number, desiredName: string): Promise<string> {
  const base = path.basename(desiredName).replace(/[^A-Za-z0-9._-]/g, '_') || 'image.png';
  if (!(await storedFileExists(getVersionAssetPath(sectionId, versionNumber, base)))) return base;

  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!(await storedFileExists(getVersionAssetPath(sectionId, versionNumber, candidate)))) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

function toAssetMeta(record: StoredFileRecord): DocumentAssetMeta {
  const fileName = record.metadata?.fileName || path.basename(record.filename);
  return {
    fileName,
    storagePath: record.filename,
    mimeType: record.metadata?.mimeType || mimeTypeForAsset(fileName),
    sizeBytes: record.length,
    checksum: record.metadata?.checksum || '',
    width: record.metadata?.width,
    height: record.metadata?.height,
    page: record.metadata?.page,
    source: record.metadata?.source
  };
}

/** Прив'язує зображення, витягнуті з документа, до розділу та редакції. */
export async function finalizePendingAssets(
  token: string,
  sectionId: string,
  versionNumber: number
): Promise<DocumentAssetMeta[]> {
  const records = await filesCollection()
    .find({ 'metadata.pendingToken': token })
    .sort({ filename: 1 })
    .toArray();

  const assets: DocumentAssetMeta[] = [];

  for (const record of records) {
    const desired = record.metadata?.fileName || path.basename(record.filename);
    try {
      const fileName = await uniqueAssetName(sectionId, versionNumber, desired);
      const storagePath = getVersionAssetPath(sectionId, versionNumber, fileName);

      await deleteByPath(storagePath);
      await getBucket().rename(record._id, storagePath);

      // Токен очікування прибираємо разом із рештою метаданих одним $set: інакше
      // файл лишиться позначеним як «незавершене завантаження» і його прибере
      // планове очищення через добу.
      const { pendingToken, ...carried } = record.metadata || {};
      await filesCollection().updateOne(
        { _id: record._id },
        {
          $set: {
            metadata: {
              ...carried,
              kind: 'asset',
              sectionId,
              versionNumber: versionOf(versionNumber),
              fileName
            }
          }
        }
      );

      assets.push({
        fileName,
        storagePath,
        mimeType: record.metadata?.mimeType || mimeTypeForAsset(fileName),
        sizeBytes: record.length,
        checksum: record.metadata?.checksum || '',
        width: record.metadata?.width,
        height: record.metadata?.height,
        page: record.metadata?.page,
        source: record.metadata?.source || 'pdf'
      });
    } catch (err) {
      console.error('Failed to finalize asset', desired, err);
    }
  }

  return assets;
}

/** Зберігає зображення (з base64 або ручного завантаження) у теку редакції. */
export async function saveVersionAsset(
  sectionId: string,
  versionNumber: number,
  desiredName: string,
  buffer: Buffer,
  mimeType: string,
  source: DocumentAssetMeta['source'] = 'inline'
): Promise<DocumentAssetMeta> {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  // Той самий скріншот часто трапляється в документі кілька разів — не дублюємо файл
  for (const existing of await listVersionAssets(sectionId, versionNumber)) {
    if (existing.checksum === checksum) return existing;
  }

  const fileName = await uniqueAssetName(sectionId, versionNumber, desiredName);
  const storagePath = getVersionAssetPath(sectionId, versionNumber, fileName);
  const resolvedMime = mimeType || mimeTypeForAsset(fileName);

  const { sizeBytes } = await writeBuffer(storagePath, buffer, {
    kind: 'asset',
    sectionId,
    versionNumber: versionOf(versionNumber),
    fileName,
    mimeType: resolvedMime,
    source,
    uploadedAt: new Date()
  });

  return { fileName, storagePath, mimeType: resolvedMime, sizeBytes, checksum, source };
}

export async function listVersionAssets(sectionId: string, versionNumber: number): Promise<DocumentAssetMeta[]> {
  const prefix = `${getDocumentVersionPath(sectionId, versionNumber)}/${ASSETS_DIR_NAME}/`;
  const records = await filesCollection()
    .find({ filename: { $regex: `^${escapeRegExp(prefix)}` } })
    .sort({ filename: 1 })
    .toArray();
  return records.map(toAssetMeta);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Нова редакція успадковує зображення попередньої, щоб посилання в її Markdown не «побились». */
export async function copyVersionAssets(
  sectionId: string,
  fromVersion: number,
  toVersion: number
): Promise<void> {
  if (versionOf(fromVersion) === versionOf(toVersion)) return;

  for (const asset of await listVersionAssets(sectionId, fromVersion)) {
    const targetPath = getVersionAssetPath(sectionId, toVersion, asset.fileName);
    if (await storedFileExists(targetPath)) continue;

    try {
      const buffer = await readStoredFile(asset.storagePath);
      if (!buffer) continue;
      await writeBuffer(targetPath, buffer, {
        kind: 'asset',
        sectionId,
        versionNumber: versionOf(toVersion),
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        page: asset.page,
        source: asset.source,
        uploadedAt: new Date()
      });
    } catch (err) {
      console.error('Failed to carry asset over to the new version', asset.fileName, err);
    }
  }
}

/** Відкриває скріншот документа на читання (захист від виходу за межі теки редакції). */
export async function resolveVersionAsset(
  sectionId: string,
  versionNumber: number,
  fileName: string
): Promise<{ stream: Readable; sizeBytes: number; mimeType: string } | null> {
  const safeName = path.basename(String(fileName || ''));
  if (!safeName || safeName === '.' || safeName === '..') return null;

  const stored = await openStoredFile(getVersionAssetPath(sectionId, versionNumber, safeName));
  if (!stored) return null;

  return {
    stream: stored.stream,
    sizeBytes: stored.sizeBytes,
    mimeType: stored.mimeType === 'application/octet-stream' ? mimeTypeForAsset(safeName) : stored.mimeType
  };
}

/** Зберігає проаналізований Markdown як окремий файл поруч з оригіналом. */
export async function saveMarkdownFile(
  sectionId: string,
  versionNumber: number,
  markdown: string
): Promise<SourceFileMeta> {
  const storagePath = `${getDocumentVersionPath(sectionId, versionNumber)}/${MARKDOWN_FILE_NAME}`;
  const buffer = Buffer.from(markdown ?? '', 'utf-8');
  const uploadedAt = new Date();

  const { sizeBytes, checksum } = await writeBuffer(storagePath, buffer, {
    kind: 'markdown',
    sectionId,
    versionNumber: versionOf(versionNumber),
    fileName: MARKDOWN_FILE_NAME,
    mimeType: 'text/markdown',
    uploadedAt
  });

  return {
    fileName: MARKDOWN_FILE_NAME,
    storagePath,
    mimeType: 'text/markdown',
    sizeBytes,
    checksum,
    uploadedAt
  };
}

/** Прибирає всі файли документа — викликається при видаленні інструкції. */
export async function deleteDocumentStorage(sectionId: string): Promise<void> {
  try {
    const prefix = `documents/${safeSegment(sectionId)}/`;
    const records = await filesCollection()
      .find({ filename: { $regex: `^${escapeRegExp(prefix)}` } })
      .toArray();
    for (const record of records) {
      await getBucket().delete(record._id);
    }
  } catch (err) {
    console.error('Failed to delete document storage', sectionId, err);
  }
}

/**
 * Прибирає завантаження, старші за 24 години, які так і не дійшли до імпорту:
 * і самі оригінали, і витягнуті з них зображення.
 */
export async function cleanupStalePendingUploads(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PENDING_MAX_AGE_MS);
    const records = await filesCollection()
      .find({ 'metadata.pendingToken': { $exists: true }, uploadDate: { $lt: cutoff } })
      .toArray();

    for (const record of records) {
      try {
        await getBucket().delete(record._id);
      } catch {
        // спробуємо наступного разу
      }
    }

    // Тимчасові теки екстракторів, що лишились після падіння процесу
    const tempRoot = path.join(os.tmpdir(), 'edu-extract');
    if (fs.existsSync(tempRoot)) {
      for (const name of fs.readdirSync(tempRoot)) {
        const entry = path.join(tempRoot, name);
        try {
          if (Date.now() - fs.statSync(entry).mtimeMs > PENDING_MAX_AGE_MS) {
            fs.rmSync(entry, { recursive: true, force: true });
          }
        } catch {
          // ignore races
        }
      }
    }
  } catch (err) {
    console.error('Failed to clean up stale pending uploads', err);
  }
}
