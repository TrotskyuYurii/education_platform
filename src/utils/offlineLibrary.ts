/**
 * Офлайн-бібліотека: навчальні матеріали, які користувач явно зберіг на пристрої.
 *
 * Зберігається в IndexedDB окремо для кожного користувача. Питань тестів і кейсів
 * тут немає навмисно: тестування офлайн недоступне. Зображення інструкцій лежать у
 * Cache Storage (MATERIALS_CACHE), звідки їх віддає service worker (public/sw.js).
 */
import type { InstructionSection, KnowledgeSpace } from '../types';

/** Назву поділяє з public/sw.js. */
export const MATERIALS_CACHE = 'viatec-materials-v1';

export interface OfflineCourse {
  id: string;
  title?: string;
  instructionIds?: string[];
  spaceId?: string;
  [key: string]: any;
}

/** Позначка «прочитано/не прочитано», зроблена без мережі й ще не відправлена. */
export interface PendingReadOp {
  sectionId: string;
  read: boolean;
  at: string;
}

export interface OfflineLibrary {
  userId: string;
  /** Збережені курси разом з усіма своїми інструкціями. */
  savedCourseIds: string[];
  /** Окремо збережені інструкції (поза курсом). */
  savedSectionIds: string[];
  /** Коли кожен матеріал було збережено вперше. */
  savedAt: Record<string, string>;
  courses: OfflineCourse[];
  sections: InstructionSection[];
  spaces: KnowledgeSpace[];
  /** Останній відомий з сервера прогрес читання — для роботи без мережі. */
  readSectionIds: string[];
  pendingReadOps: PendingReadOp[];
  /** Коли вміст бібліотеки востаннє звірявся з сервером. */
  syncedAt: string | null;
}

export interface LibraryContent {
  sections: InstructionSection[];
  courses: OfflineCourse[];
  spaces: KnowledgeSpace[];
}

export const emptyLibrary = (userId: string): OfflineLibrary => ({
  userId,
  savedCourseIds: [],
  savedSectionIds: [],
  savedAt: {},
  courses: [],
  sections: [],
  spaces: [],
  readSectionIds: [],
  pendingReadOps: [],
  syncedAt: null
});

export const isSavedInLibrary = (lib: OfflineLibrary | null, id: string) =>
  !!lib && (lib.savedCourseIds.includes(id) || lib.savedSectionIds.includes(id));

export const courseSections = (course: OfflineCourse, sections: InstructionSection[]) => {
  const ids = new Set(course.instructionIds || []);
  return sections.filter(s => ids.has(s.id) && s.isActive !== false);
};

/**
 * Перебудовує вміст бібліотеки зі списків збережених id: лишає лише ті курси,
 * інструкції та простори, на які хтось посилається. Матеріали, яких більше немає
 * в `source` (видалені або доступ відкликано), з бібліотеки випадають.
 */
export function rebuildLibrary(
  lib: OfflineLibrary,
  source: LibraryContent,
  savedCourseIds: string[],
  savedSectionIds: string[]
): OfflineLibrary {
  const courses = savedCourseIds
    .map(id => source.courses.find(c => c.id === id))
    .filter((c): c is OfflineCourse => !!c);

  const sectionMap = new Map<string, InstructionSection>();
  for (const course of courses) {
    for (const sec of courseSections(course, source.sections)) sectionMap.set(sec.id, sec);
  }
  const standalone = savedSectionIds
    .map(id => source.sections.find(s => s.id === id))
    .filter((s): s is InstructionSection => !!s);
  for (const sec of standalone) sectionMap.set(sec.id, sec);
  const sections = Array.from(sectionMap.values());

  const spaceIds = new Set(
    [...courses.map(c => c.spaceId), ...sections.map(s => s.spaceId)].filter(Boolean) as string[]
  );
  const spaces = source.spaces.filter(sp => spaceIds.has(sp.id));

  const keptIds = new Set([...courses.map(c => c.id), ...standalone.map(s => s.id)]);
  const savedAt = Object.fromEntries(Object.entries(lib.savedAt).filter(([id]) => keptIds.has(id)));

  return {
    ...lib,
    savedCourseIds: courses.map(c => c.id),
    savedSectionIds: standalone.map(s => s.id),
    savedAt,
    courses,
    sections,
    spaces
  };
}

/** Поточний вміст бібліотеки — джерело для `rebuildLibrary`, коли сервер недоступний. */
export const libraryAsContent = (lib: OfflineLibrary): LibraryContent => ({
  sections: lib.sections,
  courses: lib.courses,
  spaces: lib.spaces
});

export function addToLibrary(
  lib: OfflineLibrary,
  source: LibraryContent,
  kind: 'course' | 'section',
  id: string,
  now = new Date().toISOString()
): OfflineLibrary {
  const courseIds = kind === 'course' ? Array.from(new Set([...lib.savedCourseIds, id])) : lib.savedCourseIds;
  const sectionIds = kind === 'section' ? Array.from(new Set([...lib.savedSectionIds, id])) : lib.savedSectionIds;
  // Решту збережених матеріалів беремо з бібліотеки, якщо в `source` їх немає.
  const merged = mergeContent(source, libraryAsContent(lib));
  const next = rebuildLibrary({ ...lib, savedAt: { ...lib.savedAt, [id]: lib.savedAt[id] || now } }, merged, courseIds, sectionIds);
  return next;
}

export function removeFromLibrary(lib: OfflineLibrary, id: string): OfflineLibrary {
  return rebuildLibrary(
    lib,
    libraryAsContent(lib),
    lib.savedCourseIds.filter(x => x !== id),
    lib.savedSectionIds.filter(x => x !== id)
  );
}

/** Звіряє збережені матеріали зі свіжими даними сервера: оновлює текст, прибирає зниклі. */
export function refreshLibrary(lib: OfflineLibrary, fresh: LibraryContent, now = new Date().toISOString()): OfflineLibrary {
  return { ...rebuildLibrary(lib, fresh, lib.savedCourseIds, lib.savedSectionIds), syncedAt: now };
}

function mergeContent(primary: LibraryContent, fallback: LibraryContent): LibraryContent {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map<string, T>();
    for (const item of b) map.set(item.id, item);
    for (const item of a) map.set(item.id, item);
    return Array.from(map.values());
  };
  return {
    sections: byId(primary.sections, fallback.sections),
    courses: byId(primary.courses, fallback.courses),
    spaces: byId(primary.spaces, fallback.spaces)
  };
}

/** Накладає офлайн-позначки прочитання на прогрес, отриманий із сервера. */
export function applyReadOps(readIds: string[], ops: PendingReadOp[]): string[] {
  const set = new Set(readIds);
  for (const op of ops) {
    if (op.read) set.add(op.sectionId);
    else set.delete(op.sectionId);
  }
  return Array.from(set);
}

const IMAGE_PATH_RE = /\/api\/sections\/[^\s"'()<>\]]+/g;
const EXTERNAL_IMAGE_RE = /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)|<img\s+[^>]*src=["']\s*(https?:\/\/[^"'\s]+)/gi;

/** Усі зображення, на які посилаються інструкції (без data:-URL, вони вже всередині тексту). */
export function collectImageUrls(sections: InstructionSection[]): string[] {
  const urls = new Set<string>();
  const addUrl = (u?: string) => {
    if (!u) return;
    const t = u.trim();
    if (t.startsWith('/') || /^https?:\/\//i.test(t)) urls.add(t);
  };
  const scan = (text?: string) => {
    if (!text) return;
    for (const m of text.matchAll(IMAGE_PATH_RE)) addUrl(m[0]);
    for (const m of text.matchAll(EXTERNAL_IMAGE_RE)) addUrl(m[1] || m[2]);
  };

  for (const sec of sections) {
    scan(sec.contentMarkdown);
    scan(sec.contentHtml);
    (sec.images || []).forEach(addUrl);
    for (const step of sec.steps || []) {
      scan(step.description);
      addUrl(step.imageUrl);
      (step.images || []).forEach(addUrl);
    }
  }
  return Array.from(urls);
}

// ---------------------------------------------------------------------------
// Сховище: IndexedDB для тексту, Cache Storage для зображень
// ---------------------------------------------------------------------------

const DB_NAME = 'viatec-offline';
const STORE = 'libraries';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступний'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'userId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadLibrary(userId: string): Promise<OfflineLibrary> {
  try {
    const stored = await withStore<OfflineLibrary | undefined>('readonly', s => s.get(userId));
    return stored ? { ...emptyLibrary(userId), ...stored } : emptyLibrary(userId);
  } catch {
    return emptyLibrary(userId);
  }
}

export async function persistLibrary(lib: OfflineLibrary): Promise<void> {
  await withStore('readwrite', s => s.put(lib));
}

/** На спільному пристрої бібліотеки попередніх користувачів не лишаються. */
export async function deleteOtherLibraries(userId: string): Promise<void> {
  try {
    const keys = await withStore<IDBValidKey[]>('readonly', s => s.getAllKeys());
    const others = keys.filter(k => k !== userId);
    for (const key of others) await withStore('readwrite', s => s.delete(key));
  } catch {
    // Немає IndexedDB — немає й чужих даних.
  }
}

/** Завантажує зображення в офлайн-кеш. Повертає кількість тих, що не вдалося зберегти. */
export async function cacheMaterialImages(urls: string[]): Promise<number> {
  if (typeof caches === 'undefined' || urls.length === 0) return 0;
  const cache = await caches.open(MATERIALS_CACHE);
  let failed = 0;
  await Promise.all(urls.map(async (url) => {
    try {
      if (await cache.match(url, { ignoreSearch: true })) return;
      const sameOrigin = url.startsWith('/') || url.startsWith(location.origin);
      const res = await fetch(url, sameOrigin ? { credentials: 'same-origin' } : { mode: 'no-cors' });
      if (res.ok || res.type === 'opaque') await cache.put(url, res);
      else failed++;
    } catch {
      failed++;
    }
  }));
  return failed;
}

/** Прибирає з кешу зображення, на які більше не посилається жоден збережений матеріал. */
export async function pruneMaterialImages(keepUrls: string[]): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keep = new Set(keepUrls.map(u => new URL(u, location.origin).href));
  const cache = await caches.open(MATERIALS_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.filter(req => !keep.has(req.url)).map(req => cache.delete(req)));
}

/** Скільки місця на пристрої займають дані сайту (разом з кешем оболонки). */
export async function estimateStorageUsage(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

/** Просить браузер не витирати збережене при нестачі місця. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    // Браузер може відмовити — матеріали все одно збережені, просто без гарантії.
  }
}
