import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  AlertCircle,
  Loader2,
  ChevronsDownUp,
  ChevronsUpDown,
  Inbox
} from 'lucide-react';
import { MaterialFolder } from '../../types';
import { UseMaterialFoldersResult } from '../../hooks/useMaterialFolders';

/**
 * Ієрархічний перелік матеріалів адміністративного розділу.
 *
 * Інструкції, курси та кейси лежали пласким списком: коли їх набирається
 * кількасот, знайти потрібний можна тільки пошуком, а згрупувати споріднені —
 * ніяк. Тут той самий перелік показано деревом тек, які адміністратор заводить
 * сам, а рядок матеріалу лишається тим, що передала вкладка (`MaterialRow`),
 * тож дії, бейджі та лічильники скрізь однакові.
 *
 * Тека — суто організаційний шар: на підрозділи, простори знань і права
 * доступу вона не впливає, і співробітник її не бачить.
 */

export interface MaterialFolderTreeItem {
  /** id матеріалу — саме його сервер шукає під час переносу. */
  id: string;
  folderId?: string | null;
  /** Текст, за яким шукає поле пошуку над деревом. */
  searchText?: string;
  /** Готовий рядок матеріалу (зазвичай `MaterialRow`). */
  node: React.ReactNode;
}

interface MaterialFolderTreeProps {
  controller: UseMaterialFoldersResult;
  items: MaterialFolderTreeItem[];
  /** Як називати матеріали у підказках: «інструкцію», «курс», «кейс». */
  itemNoun: string;
  /** Текст, коли матеріалів немає зовсім. */
  empty?: React.ReactNode;
  /** Ключ для запам'ятовування розгорнутих тек між відвідуваннями вкладки. */
  storageKey: string;
}

const FOLDER_TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200'
};

/** Що саме тягне користувач: матеріал чи цілу теку. */
type DragPayload = { type: 'item' | 'folder'; id: string } | null;

const ROOT_KEY = '__root__';

const loadExpanded = (storageKey: string): Set<string> => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

export const MaterialFolderTree: React.FC<MaterialFolderTreeProps> = ({
  controller,
  items,
  itemNoun,
  empty,
  storageKey
}) => {
  const { folders, loading, busy, error, clearError, createFolder, renameFolder, deleteFolder, moveFolder, moveMaterials } =
    controller;

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(storageKey));
  const [drag, setDrag] = useState<DragPayload>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  /** id теки, всередині якої зараз відкрита форма створення (ROOT_KEY — корінь). */
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...expanded]));
    } catch {
      /* приватний режим браузера — просто не запам'ятовуємо стан дерева */
    }
  }, [expanded, storageKey]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, MaterialFolder[]>();
    for (const folder of folders) {
      const key = folder.parentId || null;
      const list = map.get(key) || [];
      list.push(folder);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'uk'));
    }
    return map;
  }, [folders]);

  const foldersById = useMemo(() => new Map(folders.map(f => [f.id, f])), [folders]);

  /** Плаский перелік тек із відступами — для випадайки «Перемістити у теку». */
  const flatFolders = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of childrenByParent.get(parentId) || []) {
        out.push({ id: folder.id, label: `${'  '.repeat(depth)}${depth > 0 ? '└ ' : ''}${folder.name}` });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [childrenByParent]);

  const descendantsOf = useCallback(
    (folderId: string): string[] => {
      const out: string[] = [];
      const walk = (id: string) => {
        for (const child of childrenByParent.get(id) || []) {
          out.push(child.id);
          walk(child.id);
        }
      };
      walk(folderId);
      return out;
    },
    [childrenByParent]
  );

  const ancestorsOf = useCallback(
    (folderId: string | null): string[] => {
      const out: string[] = [];
      let cursor = folderId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        out.push(cursor);
        cursor = foldersById.get(cursor)?.parentId || null;
      }
      return out;
    },
    [foldersById]
  );

  // --- Пошук -------------------------------------------------------------
  // Збіг у назві теки показує всю теку цілком: людина шукає «Каса», щоб
  // побачити її вміст, а не порожню теку з нульовим лічильником.
  const search = query.trim().toLowerCase();

  const { visibleItems, visibleFolderIds } = useMemo(() => {
    if (!search) {
      return { visibleItems: items, visibleFolderIds: null as Set<string> | null };
    }

    const nameMatched = folders.filter(f => f.name.toLowerCase().includes(search)).map(f => f.id);
    const fullyVisible = new Set<string>();
    for (const id of nameMatched) {
      fullyVisible.add(id);
      for (const child of descendantsOf(id)) fullyVisible.add(child);
    }

    const matchedItems = items.filter(
      item =>
        (item.searchText || '').toLowerCase().includes(search) ||
        (item.folderId ? fullyVisible.has(item.folderId) : false)
    );

    const visible = new Set<string>();
    for (const id of fullyVisible) {
      for (const ancestor of ancestorsOf(id)) visible.add(ancestor);
    }
    for (const item of matchedItems) {
      for (const ancestor of ancestorsOf(item.folderId || null)) visible.add(ancestor);
    }

    return { visibleItems: matchedItems, visibleFolderIds: visible };
  }, [search, items, folders, descendantsOf, ancestorsOf]);

  const itemsByFolder = useMemo(() => {
    const map = new Map<string | null, MaterialFolderTreeItem[]>();
    for (const item of visibleItems) {
      // Матеріал у теці, яку встигли видалити в іншій вкладці, не має зникати
      // з екрана — показуємо його серед нерозкладених.
      const key = item.folderId && foldersById.has(item.folderId) ? item.folderId : null;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [visibleItems, foldersById]);

  /** Скільки матеріалів у теці разом із вкладеними. */
  const subtreeCount = useCallback(
    (folderId: string): number => {
      let total = (itemsByFolder.get(folderId) || []).length;
      for (const child of childrenByParent.get(folderId) || []) total += subtreeCount(child.id);
      return total;
    },
    [itemsByFolder, childrenByParent]
  );

  const isExpanded = (folderId: string) => (search ? true : expanded.has(folderId));

  const toggle = (folderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(folders.map(f => f.id)));
  const collapseAll = () => setExpanded(new Set());

  // --- Перетягування -----------------------------------------------------
  const canDropOn = (targetFolderId: string | null): boolean => {
    if (!drag) return false;
    if (drag.type === 'item') return true;
    if (targetFolderId === drag.id) return false;
    // Тека, вкладена сама в себе, відірвала б цілу гілку від кореня.
    return !descendantsOf(drag.id).includes(targetFolderId || '');
  };

  const handleDrop = async (targetFolderId: string | null) => {
    const payload = drag;
    setDrag(null);
    setDragOver(null);
    if (!payload) return;

    if (payload.type === 'item') {
      const current = items.find(i => i.id === payload.id)?.folderId || null;
      if (current === targetFolderId) return;
      await moveMaterials([payload.id], targetFolderId);
      return;
    }

    if (!canDropOn(targetFolderId)) return;
    if ((foldersById.get(payload.id)?.parentId || null) === targetFolderId) return;
    const ok = await moveFolder(payload.id, targetFolderId);
    if (ok && targetFolderId) setExpanded(prev => new Set(prev).add(targetFolderId));
  };

  const dropZoneProps = (targetFolderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!drag || !canDropOn(targetFolderId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOver(targetFolderId || ROOT_KEY);
    },
    onDragLeave: () => setDragOver(prev => (prev === (targetFolderId || ROOT_KEY) ? null : prev)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleDrop(targetFolderId);
    }
  });

  const isDropTarget = (targetFolderId: string | null) =>
    dragOver === (targetFolderId || ROOT_KEY) && canDropOn(targetFolderId);

  // --- Дії над теками ----------------------------------------------------
  const submitCreate = async (parentId: string | null) => {
    const name = newName.trim();
    if (!name) return;
    const ok = await createFolder(name, parentId);
    if (ok) {
      setNewName('');
      setCreatingIn(null);
      if (parentId) setExpanded(prev => new Set(prev).add(parentId));
    }
  };

  const submitRename = async (folderId: string) => {
    const name = renameValue.trim();
    if (!name) return;
    const ok = await renameFolder(folderId, name);
    if (ok) setRenamingId(null);
  };

  const openCreate = (parentId: string | null) => {
    setNewName('');
    setCreatingIn(parentId || ROOT_KEY);
    if (parentId) setExpanded(prev => new Set(prev).add(parentId));
  };

  // --- Рендер ------------------------------------------------------------
  const renderItem = (item: MaterialFolderTreeItem) => (
    <div
      key={item.id}
      className={`flex items-stretch gap-2 ${drag?.type === 'item' && drag.id === item.id ? 'opacity-40' : ''}`}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <span
          draggable
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.id);
            setDrag({ type: 'item', id: item.id });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDragOver(null);
          }}
          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition"
          title={`Перетягніть, щоб перекласти ${itemNoun} в іншу теку`}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        {/*
          Клавіатурна заміна перетягування.
          Прозорий <select> поверх іконки: миша й клавіатура отримують звичайний
          список тек, а в рядку він займає стільки ж місця, скільки ручка
          перетягування поруч, і не тисне назву матеріалу.
        */}
        <span className="relative w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition">
          <Folder className="w-3.5 h-3.5 pointer-events-none" />
          <select
            value={item.folderId && foldersById.has(item.folderId) ? item.folderId : ''}
            disabled={busy}
            onChange={e => moveMaterials([item.id], e.target.value || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            title="Перемістити у теку"
            aria-label="Перемістити у теку"
          >
            <option value="">Без теки</option>
            {flatFolders.map(f => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="grow min-w-0">{item.node}</div>
    </div>
  );

  const renderCreateForm = (parentId: string | null, depth: number) => {
    if (creatingIn !== (parentId || ROOT_KEY)) return null;
    return (
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 20 }}>
        <FolderPlus className="w-4 h-4 text-blue-500 shrink-0" />
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitCreate(parentId);
            if (e.key === 'Escape') setCreatingIn(null);
          }}
          placeholder={parentId ? 'Назва вкладеної теки' : 'Назва теки'}
          className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 focus:outline-hidden focus:ring-2 focus:ring-blue-200 min-w-0 grow max-w-xs"
        />
        <button
          onClick={() => submitCreate(parentId)}
          disabled={busy || !newName.trim()}
          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
          title="Створити теку"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCreatingIn(null)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
          title="Скасувати"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderFolder = (folder: MaterialFolder, depth: number): React.ReactNode => {
    if (visibleFolderIds && !visibleFolderIds.has(folder.id)) return null;

    const childFolders = childrenByParent.get(folder.id) || [];
    const folderItems = itemsByFolder.get(folder.id) || [];
    const count = subtreeCount(folder.id);
    const open = isExpanded(folder.id);
    const tone = FOLDER_TONES[folder.color || 'blue'] || FOLDER_TONES.blue;
    const dropping = isDropTarget(folder.id);

    return (
      <div key={folder.id} className="space-y-1">
        <div
          {...dropZoneProps(folder.id)}
          draggable={renamingId !== folder.id}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', folder.id);
            setDrag({ type: 'folder', id: folder.id });
          }}
          onDragEnd={() => {
            setDrag(null);
            setDragOver(null);
          }}
          style={{ marginLeft: depth * 20 }}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition ${
            dropping
              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
              : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100/80'
          } ${drag?.type === 'folder' && drag.id === folder.id ? 'opacity-40' : ''}`}
        >
          <button
            onClick={() => toggle(folder.id)}
            disabled={!!search}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition disabled:opacity-40"
            title={open ? 'Згорнути теку' : 'Розгорнути теку'}
            aria-expanded={open}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>

          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tone}`}>
            {open ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
          </div>

          {renamingId === folder.id ? (
            <div className="flex items-center gap-1.5 grow min-w-0">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitRename(folder.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="px-2.5 py-1 text-sm rounded-lg border border-blue-300 focus:outline-hidden focus:ring-2 focus:ring-blue-200 grow min-w-0 max-w-xs"
              />
              <button
                onClick={() => submitRename(folder.id)}
                disabled={busy || !renameValue.trim()}
                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
                title="Зберегти назву"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setRenamingId(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white transition"
                title="Скасувати"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => toggle(folder.id)} className="grow min-w-0 text-left" disabled={!!search}>
              <span className="text-sm font-bold text-slate-800 break-words">{folder.name}</span>
            </button>
          )}

          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-white text-slate-600 border-slate-200">
            {count}
          </span>

          {renamingId !== folder.id && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => openCreate(folder.id)}
                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-white rounded-lg transition"
                title="Створити вкладену теку"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setRenamingId(folder.id);
                  setRenameValue(folder.name);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition"
                title="Перейменувати теку"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {confirmDeleteId === folder.id ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  <span className="text-[11px] font-semibold text-rose-700 whitespace-nowrap">Видалити теку?</span>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      const ok = await deleteFolder(folder.id);
                      if (ok) setConfirmDeleteId(null);
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded transition disabled:opacity-50"
                    title={`Теку буде видалено, а її вміст підніметься на рівень вище`}
                  >
                    {busy ? '…' : 'Так'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-medium rounded transition"
                  >
                    Ні
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(folder.id)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Видалити теку (матеріали залишаться, піднявшись на рівень вище)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {open && (
          <div className="space-y-1.5">
            {renderCreateForm(folder.id, depth + 1)}
            {childFolders.map(child => renderFolder(child, depth + 1))}
            <div className="space-y-2" style={{ marginLeft: (depth + 1) * 20 }}>
              {folderItems.map(renderItem)}
              {folderItems.length === 0 && childFolders.length === 0 && (
                <div className="text-xs text-slate-400 italic px-3 py-2 border border-dashed border-slate-200 rounded-lg">
                  Тека порожня — перетягніть сюди {itemNoun}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const rootFolders = childrenByParent.get(null) || [];
  const rootItems = itemsByFolder.get(null) || [];
  const hasAnything = items.length > 0 || folders.length > 0;

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-slate-400" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="ml-2 text-sm">Завантаження тек…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Панель дій над деревом */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="relative grow max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук за назвою або текою…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              title="Очистити пошук"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {folders.length > 0 && (
            <button
              onClick={() => (expanded.size > 0 ? collapseAll() : expandAll())}
              disabled={!!search}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-40"
              title={expanded.size > 0 ? 'Згорнути всі теки' : 'Розгорнути всі теки'}
            >
              {expanded.size > 0 ? <ChevronsDownUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
              <span>{expanded.size > 0 ? 'Згорнути все' : 'Розгорнути все'}</span>
            </button>
          )}
          <button
            onClick={() => openCreate(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
            title="Створити теку на верхньому рівні"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Нова тека</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-medium grow">{error}</p>
          <button onClick={clearError} className="p-0.5 hover:bg-rose-100 rounded" title="Приховати">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {folders.length === 0 && !search && (
        <p className="text-xs text-slate-500 px-1">
          Тек ще немає. Створіть першу — і розкладайте {itemNoun} перетягуванням або через список тек біля кожного рядка.
        </p>
      )}

      {renderCreateForm(null, 0)}

      <div className="space-y-1.5">{rootFolders.map(folder => renderFolder(folder, 0))}</div>

      {/* Кореневий рівень: матеріали, які ще нікуди не розкладені */}
      {(rootItems.length > 0 || folders.length > 0) && (
        <div
          {...dropZoneProps(null)}
          className={`rounded-xl border border-dashed transition p-2.5 space-y-2 ${
            isDropTarget(null) ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
          }`}
        >
          {folders.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <Inbox className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Поза теками</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200">
                {rootItems.length}
              </span>
            </div>
          )}
          {rootItems.map(renderItem)}
          {rootItems.length === 0 && folders.length > 0 && (
            <div className="text-xs text-slate-400 italic px-2 py-1.5">
              Усі матеріали розкладено по теках. Перетягніть сюди {itemNoun}, щоб прибрати з теки.
            </div>
          )}
        </div>
      )}

      {!hasAnything && (
        <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
          {empty || 'Список порожній.'}
        </div>
      )}

      {hasAnything && search && visibleItems.length === 0 && (
        <div className="text-center py-10 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
          За запитом «{query}» нічого не знайдено.
        </div>
      )}
    </div>
  );
};
