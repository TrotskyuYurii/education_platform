import {
  DocumentAssetMeta,
  SourceFileMeta,
  extensionForImageMime,
  finalizePendingAssets,
  listVersionAssets,
  storedFileExists,
  getVersionAssetPath,
  saveMarkdownFile,
  saveVersionAsset
} from './fileStorage.js';

/**
 * Єдине місце, де вирішується, як зображення документа потрапляють у сховище та які
 * посилання опиняються в базі.
 *
 * Правило: зображення НІКОЛИ не зберігаються вбудованим base64 — ні в Markdown, ні в
 * полях розділу. Будь-який `data:image/...;base64,...`, що приходить з імпорту, від ШІ
 * або з редактора, вивантажується окремим файлом у GridFS, а на його місце
 * підставляється посилання:
 *   • у `rawMarkdown` (і в instruction.md) — відносне `assets/img-001.png`;
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
  /** Токен зображень, витягнутих з документа під час аналізу (ще не прив'язаних до розділу) */
  pendingAssetsToken?: string;
  /** Записати instruction.md у сховище (за замовчуванням так) */
  writeMarkdownFile?: boolean;
}

export interface NormalizeAssetsResult {
  /** Оновлені поля розділу з абсолютними посиланнями — присвоюються розділу */
  fields: Record<string, any>;
  /** Markdown з відносними посиланнями `assets/...` */
  rawMarkdown: string;
  assets: DocumentAssetMeta[];
  markdownFile?: SourceFileMeta;
  /** Скільки збережених скріншотів модель справді розставила в тексті */
  usedAssetCount: number;
  /** Скільки посилань прибрано, бо файлу з такою назвою не існує */
  droppedLinkCount: number;
}

/** Рекурсивно збирає всі рядки структури — потрібно, щоб зібрати base64 до запису у сховище. */
function collectStrings(value: any, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, out));
}

/**
 * Приводить один документ (розділ + його Markdown) до схеми зберігання зображень у GridFS.
 * `source` — звичайний об'єкт (для mongoose-документа передавайте `.toObject()`).
 */
export async function normalizeDocumentAssets(
  source: Record<string, any>,
  options: NormalizeAssetsOptions
): Promise<NormalizeAssetsResult> {
  const { sectionId, versionNumber } = options;

  const assets: DocumentAssetMeta[] = [];
  const register = (asset: DocumentAssetMeta) => {
    if (!assets.some(a => a.fileName === asset.fileName)) assets.push(asset);
    return asset;
  };

  // 1. Зображення, витягнуті з документа, прив'язуються до розділу
  if (options.pendingAssetsToken) {
    (await finalizePendingAssets(options.pendingAssetsToken, sectionId, versionNumber)).forEach(register);
  }

  // Усе, що вже належить цій редакції (успадковане з попередньої версії тощо)
  (await listVersionAssets(sectionId, versionNumber)).forEach(register);

  const knownFiles = new Set(assets.map(a => a.fileName));

  // 2. Base64 → файл. Запис у сховище асинхронний, а заміна в тексті — ні, тому
  //    спершу збираємо всі вставки, зберігаємо їх, і лише потім підставляємо посилання.
  const allStrings: string[] = [];
  collectStrings(source.rawMarkdown, allStrings);
  for (const key of CONTENT_FIELDS) {
    if (key in source) collectStrings(source[key], allStrings);
  }

  const savedByPayload = new Map<string, string>();
  const subtypeByPayload = new Map<string, string>();
  for (const text of allStrings) {
    for (const match of text.matchAll(DATA_URI_RE)) {
      const base64 = match[2].replace(/\s+/g, '');
      if (!subtypeByPayload.has(base64)) subtypeByPayload.set(base64, String(match[1]).toLowerCase());
    }
  }

  let inlineIndex = 0;
  for (const [base64, subtype] of subtypeByPayload) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      continue;
    }
    if (buffer.length === 0) continue;

    const mimeType = `image/${subtype}`;
    const fileName = `inline-${String(++inlineIndex).padStart(3, '0')}${extensionForImageMime(mimeType)}`;
    const asset = register(await saveVersionAsset(sectionId, versionNumber, fileName, buffer, mimeType, 'inline'));
    savedByPayload.set(base64, asset.fileName);
    knownFiles.add(asset.fileName);
  }

  const replaceDataUris = (text: string, toUrl: (fileName: string) => string): string =>
    text.replace(DATA_URI_RE, (whole, _subtype: string, payload: string) => {
      const saved = savedByPayload.get(payload.replace(/\s+/g, ''));
      return saved ? toUrl(saved) : whole;
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

  // 5. Прибираємо посилання на неіснуючі файли (ШІ інколи вигадує назву скріншота).
  //    Посилання можуть указувати й на іншу редакцію, тож наявність перевіряємо
  //    заздалегідь — під час самої заміни асинхронні виклики вже неможливі.
  const referenced = new Set<string>();
  const fieldStrings: string[] = [];
  Object.values(fields).forEach(value => collectStrings(value, fieldStrings));
  const URL_RE = /\/api\/sections\/[^/]+\/assets\/v(\d+)\/([A-Za-z0-9._%-]+)/g;
  for (const text of fieldStrings) {
    for (const match of text.matchAll(URL_RE)) referenced.add(`${match[1]}|${decodeURIComponent(match[2])}`);
  }

  const existingUrls = new Set<string>();
  for (const key of referenced) {
    const [version, fileName] = key.split('|');
    const isCurrent = Number(version) === versionNumber;
    const exists = isCurrent
      ? knownFiles.has(fileName)
      : await storedFileExists(getVersionAssetPath(sectionId, Number(version), fileName));
    if (exists) existingUrls.add(key);
  }

  const assetExists = (url: string): boolean => {
    const match = /^\/api\/sections\/[^/]+\/assets\/v(\d+)\/(.+)$/.exec(url);
    if (!match) return true; // зовнішні або data-URL сюди вже не потрапляють
    return existingUrls.has(`${match[1]}|${decodeURIComponent(match[2])}`);
  };

  let droppedLinkCount = 0;
  for (const key of Object.keys(fields)) {
    fields[key] = pruneMissingAssets(fields[key], assetExists, () => droppedLinkCount++);
  }

  // Скільки скріншотів реально дійшло до читача: решта або не згадана моделлю,
  // або згадана під вигаданою назвою — і те, і те варто бачити при імпорті.
  const renderedContent = JSON.stringify(fields);
  const usedAssetCount = assets.filter(a =>
    renderedContent.includes(assetApiUrl(sectionId, versionNumber, a.fileName))
  ).length;

  const result: NormalizeAssetsResult = {
    fields,
    rawMarkdown,
    assets,
    usedAssetCount,
    droppedLinkCount
  };

  if (options.writeMarkdownFile !== false && rawMarkdown) {
    result.markdownFile = await saveMarkdownFile(sectionId, versionNumber, rawMarkdown);
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
function pruneMissingAssets(value: any, exists: (url: string) => boolean, onDropped: () => void): any {
  if (typeof value === 'string') {
    if (value.startsWith('/api/sections/')) {
      if (exists(value)) return value;
      onDropped();
      return '';
    }
    return value.replace(
      /!\[[^\]]*\]\(\s*(\/api\/sections\/[^)\s]+)\s*\)\n?/gi,
      (whole, url: string) => {
        if (exists(url)) return whole;
        onDropped();
        return '';
      }
    );
  }
  if (Array.isArray(value)) {
    return value
      .map(item => pruneMissingAssets(item, exists, onDropped))
      .filter(item => !(typeof item === 'string' && item === ''));
  }
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      const mapped = pruneMissingAssets(item, exists, onDropped);
      if (key === 'imageUrl' && mapped === '') continue;
      next[key] = mapped;
    }
    return next;
  }
  return value;
}
