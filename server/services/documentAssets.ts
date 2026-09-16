import {
  DocumentAssetMeta,
  SourceFileMeta,
  extensionForImageMime,
  finalizePendingAssets,
  listVersionAssets,
  resolveVersionAssetPath,
  saveMarkdownFile,
  saveVersionAsset
} from './fileStorage.js';

/**
 * Єдине місце, де вирішується, як зображення документа потрапляють у сховище та які
 * посилання опиняються в базі.
 *
 * Правило: зображення НІКОЛИ не зберігаються вбудованим base64 — ні в Markdown, ні в
 * полях розділу. Будь-який `data:image/...;base64,...`, що приходить з імпорту, від ШІ
 * або з редактора, вивантажується у файл `documents/<id>/v<N>/assets/...`, а на його
 * місце підставляється посилання:
 *   • у `rawMarkdown` (і в instruction.md на диску) — відносне `assets/img-001.png`;
 *   • у полях розділу, які рендерить фронтенд — абсолютне `/api/sections/<id>/assets/v<N>/img-001.png`.
 */

/** Поля розділу, у яких можуть бути посилання на зображення. */
const CONTENT_FIELDS = [
  'contentMarkdown',
  'contentHtml',
  'summary',
  'subtitle',
  'keyPoints',
  'keyFields',
  'stopRules',
  'systemAutomaticActions',
  'images',
  'steps',
  'tableData'
];

const IMAGE_EXT = 'png|jpe?g|webp|gif|svg|bmp';

/**
 * Base64-зображення. Продовження рядків вимагаємо довжиною ≥16 символів, щоб
 * багаторядковий base64 склеювався, але звичайний текст після посилання — ні.
 */
const DATA_URI_RE = new RegExp(
  'data:image\\/([a-z0-9.+-]+);base64,\\s*([A-Za-z0-9+/=]+(?:\\s*[A-Za-z0-9+/=]{16,})*)',
  'gi'
);

const RELATIVE_ASSET_RE = new RegExp(`(^|[^\\w/.-])assets/([A-Za-z0-9._-]+\\.(?:${IMAGE_EXT}))`, 'gi');

export function assetApiUrl(sectionId: string, versionNumber: number, fileName: string): string {
  return `/api/sections/${encodeURIComponent(sectionId)}/assets/v${versionNumber}/${encodeURIComponent(fileName)}`;
}

function absoluteAssetRe(sectionId: string): RegExp {
  const escapedId = escapeRegExp(encodeURIComponent(sectionId));
  return new RegExp(`/api/sections/${escapedId}/assets/v\\d+/([A-Za-z0-9._%-]+)`, 'gi');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface NormalizeAssetsOptions {
  sectionId: string;
  versionNumber: number;
  /** Тека з зображеннями, витягнутими з PDF під час аналізу (ще не прив'язана до розділу) */
  pendingAssetsToken?: string;
  /** Записати instruction.md на диск (за замовчуванням так) */
  writeMarkdownFile?: boolean;
}

export interface NormalizeAssetsResult {
  /** Оновлені поля розділу з абсолютними посиланнями — присвоюються розділу */
  fields: Record<string, any>;
  /** Markdown з відносними посиланнями `assets/...` */
  rawMarkdown: string;
  assets: DocumentAssetMeta[];
  markdownFile?: SourceFileMeta;
}

/**
 * Приводить один документ (розділ + його Markdown) до файлової схеми зберігання зображень.
 * `source` — звичайний об'єкт (для mongoose-документа передавайте `.toObject()`).
 */
export function normalizeDocumentAssets(
  source: Record<string, any>,
  options: NormalizeAssetsOptions
): NormalizeAssetsResult {
  const { sectionId, versionNumber } = options;

  const assets: DocumentAssetMeta[] = [];
  const register = (asset: DocumentAssetMeta) => {
    if (!assets.some(a => a.fileName === asset.fileName)) assets.push(asset);
    return asset;
  };

  // 1. Зображення, витягнуті з PDF, переїжджають у теку документа
  if (options.pendingAssetsToken) {
    finalizePendingAssets(options.pendingAssetsToken, sectionId, versionNumber).forEach(register);
  }

  // Усе, що вже лежить у теці цієї редакції (успадковане з попередньої версії тощо)
  listVersionAssets(sectionId, versionNumber).forEach(register);

  const knownFiles = new Set(assets.map(a => a.fileName));
  const savedByPayload = new Map<string, string>();

  // 2. Base64 → файл
  const replaceDataUris = (text: string, toUrl: (fileName: string) => string): string =>
    text.replace(DATA_URI_RE, (whole, subtype: string, payload: string) => {
      const base64 = payload.replace(/\s+/g, '');
      const cached = savedByPayload.get(base64);
      if (cached) return toUrl(cached);

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch {
        return whole;
      }
      if (buffer.length === 0) return whole;

      const mimeType = `image/${String(subtype).toLowerCase()}`;
      const fileName = `inline-${String(savedByPayload.size + 1).padStart(3, '0')}${extensionForImageMime(mimeType)}`;
      const asset = register(
        saveVersionAsset(sectionId, versionNumber, fileName, buffer, mimeType, 'inline')
      );
      savedByPayload.set(base64, asset.fileName);
      knownFiles.add(asset.fileName);
      return toUrl(asset.fileName);
    });

  const toAbsolute = (fileName: string) => assetApiUrl(sectionId, versionNumber, fileName);
  const toRelative = (fileName: string) => `assets/${fileName}`;

  // 3. rawMarkdown — самодостатній файл із відносними посиланнями
  let rawMarkdown = typeof source.rawMarkdown === 'string' ? source.rawMarkdown : '';
  if (rawMarkdown) {
    rawMarkdown = replaceDataUris(rawMarkdown, toRelative);
    rawMarkdown = rawMarkdown.replace(absoluteAssetRe(sectionId), (_m, file: string) =>
      toRelative(decodeURIComponent(file))
    );
    rawMarkdown = dropMissingAssetLinks(rawMarkdown, knownFiles);
  }

  // 4. Поля розділу — абсолютні посилання, придатні для рендеру
  const fields: Record<string, any> = {};
  for (const key of CONTENT_FIELDS) {
    if (!(key in source)) continue;
    fields[key] = mapStrings(source[key], text => {
      let next = replaceDataUris(text, toAbsolute);
      next = next.replace(RELATIVE_ASSET_RE, (_m, prefix: string, file: string) =>
        `${prefix}${toAbsolute(file)}`
      );
      return next;
    });
  }

  // 5. Прибираємо посилання на неіснуючі файли (ШІ інколи вигадує назву скріншота)
  const assetExists = (url: string): boolean => {
    const match = new RegExp(`^/api/sections/[^/]+/assets/v(\\d+)/(.+)$`).exec(url);
    if (!match) return true; // зовнішні або data-URL сюди вже не потрапляють
    return resolveVersionAssetPath(sectionId, Number(match[1]), decodeURIComponent(match[2])) !== null;
  };

  for (const key of Object.keys(fields)) {
    fields[key] = pruneMissingAssets(fields[key], assetExists);
  }

  const result: NormalizeAssetsResult = { fields, rawMarkdown, assets };

  if (options.writeMarkdownFile !== false && rawMarkdown) {
    result.markdownFile = saveMarkdownFile(sectionId, versionNumber, rawMarkdown);
  }

  return result;
}

/** Рекурсивно застосовує перетворення до всіх рядків у структурі (масиви, вкладені об'єкти). */
function mapStrings(value: any, transform: (text: string) => string): any {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, transform));
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) next[key] = mapStrings(item, transform);
    return next;
  }
  return value;
}

/** Викидає `![alt](assets/файл)`, якщо такого файлу не існує. */
function dropMissingAssetLinks(markdown: string, knownFiles: Set<string>): string {
  return markdown.replace(
    new RegExp(`!\\[[^\\]]*\\]\\(\\s*assets/([A-Za-z0-9._-]+\\.(?:${IMAGE_EXT}))\\s*\\)\\n?`, 'gi'),
    (whole, fileName: string) => (knownFiles.has(fileName) ? whole : '')
  );
}

/**
 * Прибирає «мертві» посилання: у тексті — разом із розміткою зображення,
 * у масивах `images` / полі `imageUrl` — як окремий елемент.
 */
function pruneMissingAssets(value: any, exists: (url: string) => boolean): any {
  if (typeof value === 'string') {
    if (value.startsWith('/api/sections/')) return exists(value) ? value : '';
    return value.replace(
      /!\[[^\]]*\]\(\s*(\/api\/sections\/[^)\s]+)\s*\)\n?/gi,
      (whole, url: string) => (exists(url) ? whole : '')
    );
  }
  if (Array.isArray(value)) {
    return value
      .map(item => pruneMissingAssets(item, exists))
      .filter(item => !(typeof item === 'string' && item === ''));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      const mapped = pruneMissingAssets(item, exists);
      if (key === 'imageUrl' && mapped === '') continue;
      next[key] = mapped;
    }
    return next;
  }
  return value;
}
