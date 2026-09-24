import { Router } from 'express';
import { requirePermission } from '../core/permissions.js';
import { FolderError, FolderService } from './service.js';
import { MATERIAL_FOLDER_KINDS, MATERIAL_FOLDER_MAX_DEPTH } from './models.js';

export const foldersRouter = Router();

/** Теки — інструмент адміністратора, тож і читання, і зміни під тим самим правом. */
const requireFolderAccess = requirePermission('admin.access');

const fail = (res: any, err: any, fallback: string) => {
  if (err instanceof FolderError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ error: fallback });
};

/**
 * Дерево тек одного типу матеріалів.
 * Без `kind` віддає всі теки — зручно для експорту та діагностики.
 *
 * Лічильники вмісту рахує клієнт: матеріали в нього вже завантажені, і його
 * число збігається з тим, що видно на екрані при активному пошуку.
 */
foldersRouter.get('/', requireFolderAccess, async (req, res) => {
  try {
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const folders = await FolderService.list(kind);
    res.json({ folders, maxDepth: MATERIAL_FOLDER_MAX_DEPTH, kinds: MATERIAL_FOLDER_KINDS });
  } catch (err) {
    fail(res, err, 'Не вдалося завантажити теки');
  }
});

foldersRouter.post('/', requireFolderAccess, async (req, res) => {
  try {
    const folder = await FolderService.create(req.body);
    res.status(201).json({ success: true, folder });
  } catch (err) {
    fail(res, err, 'Не вдалося створити теку');
  }
});

foldersRouter.put('/:id', requireFolderAccess, async (req, res) => {
  try {
    const folder = await FolderService.update(String(req.params.id), req.body);
    res.json({ success: true, folder });
  } catch (err) {
    fail(res, err, 'Не вдалося оновити теку');
  }
});

foldersRouter.delete('/:id', requireFolderAccess, async (req, res) => {
  try {
    const cascade = req.query.cascade === 'true';
    const result = await FolderService.remove(String(req.params.id), cascade);
    res.json(result);
  } catch (err) {
    fail(res, err, 'Не вдалося видалити теку');
  }
});

/** Перекласти матеріали в іншу теку: `{ kind, ids: string[], folderId: string | null }`. */
foldersRouter.post('/move', requireFolderAccess, async (req, res) => {
  try {
    const { kind, ids, folderId } = req.body || {};
    const result = await FolderService.moveMaterials(kind, ids, folderId);
    res.json(result);
  } catch (err) {
    fail(res, err, 'Не вдалося перемістити матеріали');
  }
});
