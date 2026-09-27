import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  OfflineLibrary,
  LibraryContent,
  PendingReadOp,
  emptyLibrary,
  isSavedInLibrary,
  addToLibrary,
  removeFromLibrary,
  refreshLibrary,
  collectImageUrls,
  loadLibrary,
  persistLibrary,
  deleteOtherLibraries,
  cacheMaterialImages,
  pruneMaterialImages,
  requestPersistentStorage
} from '../utils/offlineLibrary';

export interface OfflineLibraryApi {
  /** Чи є зараз з'єднання з мережею. */
  isOnline: boolean;
  /** Матеріали на екрані взяті з офлайн-бібліотеки (сервер недоступний). */
  isOfflineMode: boolean;
  library: OfflineLibrary;
  savedCount: number;
  isSaved: (id: string) => boolean;
  isBusy: (id: string) => boolean;
  /** Зберегти курс або інструкцію на пристрої. Потребує мережі (для зображень). */
  save: (kind: 'course' | 'section', id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  lastError: string | null;
  dismissError: () => void;
}

/** Внутрішні операції, потрібні лише MainApp для синхронізації. */
export interface OfflineLibraryController extends OfflineLibraryApi {
  /** Бібліотека, завантажена з пристрою (раз на сесію). */
  ready: Promise<OfflineLibrary>;
  syncFromServer: (content: LibraryContent) => void;
  rememberReadIds: (ids: string[]) => void;
  queueReadOp: (sectionId: string, read: boolean) => void;
  pendingReadOps: () => PendingReadOp[];
  clearPendingReadOps: (ops: PendingReadOp[]) => void;
}

const OfflineLibraryContext = createContext<OfflineLibraryApi | null>(null);

export const OfflineLibraryProvider: React.FC<{ value: OfflineLibraryApi; children: React.ReactNode }> = ({ value, children }) => (
  <OfflineLibraryContext.Provider value={value}>{children}</OfflineLibraryContext.Provider>
);

/** Доступ до офлайн-бібліотеки з компонентів. Поза провайдером повертає null. */
export const useOfflineLibrary = () => useContext(OfflineLibraryContext);

/**
 * Стан офлайн-бібліотеки поточного користувача. `content` — матеріали, які зараз
 * показує додаток (з сервера або з самої бібліотеки).
 */
export function useOfflineLibraryController(
  userId: string,
  content: LibraryContent,
  isOnline: boolean,
  isOfflineMode: boolean
): OfflineLibraryController {
  const [library, setLibrary] = useState<OfflineLibrary>(() => emptyLibrary(userId));
  const libRef = useRef(library);
  const contentRef = useRef(content);
  contentRef.current = content;
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);

  // Записи в IndexedDB ідуть строго по черзі, щоб старіший стан не перезаписав новіший.
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const commit = useCallback((next: OfflineLibrary) => {
    libRef.current = next;
    setLibrary(next);
    writeChain.current = writeChain.current
      .then(() => persistLibrary(next))
      .catch(() => setLastError('Не вдалося записати матеріали на пристрій. Можливо, бракує вільного місця.'));
  }, []);

  const readyRef = useRef<Promise<OfflineLibrary> | null>(null);
  if (!readyRef.current) {
    readyRef.current = (async () => {
      await deleteOtherLibraries(userId);
      const loaded = await loadLibrary(userId);
      libRef.current = loaded;
      setLibrary(loaded);
      // Кеш зображень спільний — лишаємо в ньому тільки матеріали цього користувача.
      pruneMaterialImages(collectImageUrls(loaded.sections)).catch(() => {});
      return loaded;
    })();
  }

  const setItemBusy = (id: string, on: boolean) =>
    setBusy(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const save = useCallback(async (kind: 'course' | 'section', id: string) => {
    if (!navigator.onLine) {
      setLastError('Щоб зберегти матеріал, потрібне підключення до інтернету.');
      return;
    }
    setItemBusy(id, true);
    try {
      await readyRef.current;
      const next = addToLibrary(libRef.current, contentRef.current, kind, id);
      commit(next);
      void requestPersistentStorage();
      const failed = await cacheMaterialImages(collectImageUrls(next.sections));
      if (failed > 0) {
        setLastError(`Матеріал збережено, але ${failed} зображень не вдалося завантажити — вони не показуватимуться офлайн.`);
      }
    } finally {
      setItemBusy(id, false);
    }
  }, [commit]);

  const remove = useCallback(async (id: string) => {
    await readyRef.current;
    const next = removeFromLibrary(libRef.current, id);
    commit(next);
    await pruneMaterialImages(collectImageUrls(next.sections)).catch(() => {});
  }, [commit]);

  const clearAll = useCallback(async () => {
    await readyRef.current;
    const cur = libRef.current;
    commit({ ...emptyLibrary(userId), readSectionIds: cur.readSectionIds, pendingReadOps: cur.pendingReadOps });
    await pruneMaterialImages([]).catch(() => {});
  }, [commit, userId]);

  const syncFromServer = useCallback((fresh: LibraryContent) => {
    void readyRef.current!.then(() => {
      const cur = libRef.current;
      if (cur.savedCourseIds.length === 0 && cur.savedSectionIds.length === 0) return;
      const next = refreshLibrary(cur, fresh);
      commit(next);
      // Оновлені інструкції можуть посилатися на нові зображення.
      const urls = collectImageUrls(next.sections);
      cacheMaterialImages(urls).then(() => pruneMaterialImages(urls)).catch(() => {});
    });
  }, [commit]);

  const rememberReadIds = useCallback((ids: string[]) => {
    void readyRef.current!.then(() => {
      const cur = libRef.current;
      if (cur.readSectionIds.length === ids.length && cur.readSectionIds.every((x, i) => x === ids[i])) return;
      commit({ ...cur, readSectionIds: ids });
    });
  }, [commit]);

  const queueReadOp = useCallback((sectionId: string, read: boolean) => {
    const cur = libRef.current;
    const readSectionIds = read
      ? Array.from(new Set([...cur.readSectionIds, sectionId]))
      : cur.readSectionIds.filter(id => id !== sectionId);
    commit({
      ...cur,
      readSectionIds,
      pendingReadOps: [...cur.pendingReadOps, { sectionId, read, at: new Date().toISOString() }]
    });
  }, [commit]);

  const pendingReadOps = useCallback(() => libRef.current.pendingReadOps, []);

  const clearPendingReadOps = useCallback((sent: PendingReadOp[]) => {
    const cur = libRef.current;
    const sentSet = new Set(sent);
    commit({ ...cur, pendingReadOps: cur.pendingReadOps.filter(op => !sentSet.has(op)) });
  }, [commit]);

  useEffect(() => {
    if (isOnline && lastError?.startsWith('Щоб зберегти')) setLastError(null);
  }, [isOnline, lastError]);

  return useMemo(() => ({
    isOnline,
    isOfflineMode,
    library,
    savedCount: library.savedCourseIds.length + library.savedSectionIds.length,
    isSaved: (id: string) => isSavedInLibrary(library, id),
    isBusy: (id: string) => busy.has(id),
    save,
    remove,
    clearAll,
    lastError,
    dismissError: () => setLastError(null),
    ready: readyRef.current!,
    syncFromServer,
    rememberReadIds,
    queueReadOp,
    pendingReadOps,
    clearPendingReadOps
  }), [isOnline, isOfflineMode, library, busy, save, remove, clearAll, lastError, syncFromServer, rememberReadIds, queueReadOp, pendingReadOps, clearPendingReadOps]);
}
