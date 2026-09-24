import { useCallback, useEffect, useState } from 'react';
import { MaterialFolder, MaterialFolderKind } from '../types';

/**
 * Дерево тек одного типу матеріалів та операції над ним.
 *
 * Самі матеріали лишаються там, де й були, — у списках `sections` / `courses` /
 * `cases`, які завантажує `/api/content`. Тека зберігається полем `folderId`
 * на матеріалі, тож після переносу треба перечитати контент: за це відповідає
 * `onMaterialsChanged`, куди вкладка передає свій `onRefresh`.
 */
export interface UseMaterialFoldersResult {
  folders: MaterialFolder[];
  loading: boolean;
  /** Триває збереження: створення, перейменування, видалення чи перенос. */
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** `silent` перечитує теки без показу заглушки завантаження. */
  reload: (silent?: boolean) => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<boolean>;
  renameFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (id: string, cascade?: boolean) => Promise<boolean>;
  moveFolder: (id: string, parentId: string | null) => Promise<boolean>;
  moveMaterials: (ids: string[], folderId: string | null) => Promise<boolean>;
}

const readError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
};

export const useMaterialFolders = (
  kind: MaterialFolderKind,
  onMaterialsChanged?: () => Promise<void> | void
): UseMaterialFoldersResult => {
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Під час збереження дерево перечитується «тихо»: інакше заглушка
  // завантаження підміняла б увесь перелік після кожного перейменування.
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/v2/folders?kind=${kind}`);
      if (!res.ok) {
        setError(await readError(res, 'Не вдалося завантажити теки'));
        return;
      }
      const data = await res.json();
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setError(null);
    } catch {
      setError('Не вдалося завантажити теки');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Спільна обгортка: один індикатор зайнятості й один текст помилки на всі дії. */
  const run = useCallback(
    async (
      request: () => Promise<Response>,
      fallbackMessage: string,
      refreshMaterials = false
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await request();
        if (!res.ok) {
          setError(await readError(res, fallbackMessage));
          return false;
        }
        await reload(true);
        if (refreshMaterials && onMaterialsChanged) await onMaterialsChanged();
        return true;
      } catch {
        setError(fallbackMessage);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload, onMaterialsChanged]
  );

  const createFolder = useCallback(
    (name: string, parentId: string | null) =>
      run(
        () =>
          fetch('/api/v2/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId, kind })
          }),
        'Не вдалося створити теку'
      ),
    [run, kind]
  );

  const renameFolder = useCallback(
    (id: string, name: string) =>
      run(
        () =>
          fetch(`/api/v2/folders/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          }),
        'Не вдалося перейменувати теку'
      ),
    [run]
  );

  const moveFolder = useCallback(
    (id: string, parentId: string | null) =>
      run(
        () =>
          fetch(`/api/v2/folders/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId })
          }),
        'Не вдалося перемістити теку'
      ),
    [run]
  );

  // Матеріали з видаленої теки піднімаються на рівень вище, тому перелік
  // обовʼязково перечитуємо — інакше вони зникли б з екрана до перезавантаження.
  const deleteFolder = useCallback(
    (id: string, cascade = false) =>
      run(
        () =>
          fetch(`/api/v2/folders/${encodeURIComponent(id)}?cascade=${cascade ? 'true' : 'false'}`, {
            method: 'DELETE'
          }),
        'Не вдалося видалити теку',
        true
      ),
    [run]
  );

  const moveMaterials = useCallback(
    (ids: string[], folderId: string | null) =>
      run(
        () =>
          fetch('/api/v2/folders/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, ids, folderId })
          }),
        'Не вдалося перемістити матеріали',
        true
      ),
    [run, kind]
  );

  return {
    folders,
    loading,
    busy,
    error,
    clearError: () => setError(null),
    reload,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveMaterials
  };
};
