import { Router } from 'express';
import { KnowledgeService } from './service.js';
import { requirePermission } from '../core/permissions.js';
import { getFileAbsolutePath, fileExists } from '../../services/fileStorage.js';

export const knowledgeRouter = Router();

// Middleware to ensure req.user exists
const ensureUser = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * 1. Get all knowledge spaces (accessible to all logged-in employees)
 */
knowledgeRouter.get('/spaces', ensureUser, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const spaces = await KnowledgeService.getSpaces(includeInactive);
    res.json({ spaces });
  } catch (err: any) {
    console.error('Failed to get knowledge spaces', err);
    res.status(500).json({ error: err.message || 'Не вдалося завантажити простори знань' });
  }
});

/**
 * 2. Create a new knowledge space
 */
knowledgeRouter.post('/spaces', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const { name, id, code, description, icon, color, department, order, isActive } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Назва простору обов’язкова' });
    }

    const space = await KnowledgeService.createSpace(
      { name, id, code, description, icon, color, department, order, isActive },
      (req as any).user
    );
    res.status(201).json({ success: true, space });
  } catch (err: any) {
    console.error('Failed to create space', err);
    res.status(500).json({ error: err.message || 'Не вдалося створити простір' });
  }
});

/**
 * 3. Update an existing knowledge space
 */
knowledgeRouter.put('/spaces/:id', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const spaceId = String(req.params.id);
    const space = await KnowledgeService.updateSpace(spaceId, req.body);
    res.json({ success: true, space });
  } catch (err: any) {
    console.error('Failed to update space', err);
    res.status(500).json({ error: err.message || 'Не вдалося оновити простір' });
  }
});

/**
 * 4. Delete a knowledge space
 */
knowledgeRouter.delete('/spaces/:id', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const spaceId = String(req.params.id);
    const result = await KnowledgeService.deleteSpace(spaceId);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to delete space', err);
    res.status(500).json({ error: err.message || 'Не вдалося видалити простір' });
  }
});

/**
 * 5. Get overall knowledge base metrics
 */
knowledgeRouter.get('/metrics', ensureUser, async (req, res) => {
  try {
    const metrics = await KnowledgeService.getKnowledgeMetrics();
    res.json({ metrics });
  } catch (err: any) {
    console.error('Failed to get knowledge metrics', err);
    res.status(500).json({ error: 'Не вдалося завантажити показники бази знань' });
  }
});

/**
 * 6. Get version history for a specific section
 */
knowledgeRouter.get('/sections/:id/versions', ensureUser, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const versions = await KnowledgeService.getSectionVersions(sectionId);
    res.json({ versions });
  } catch (err: any) {
    console.error('Failed to get section versions', err);
    res.status(500).json({ error: 'Не вдалося завантажити історію версій регламенту' });
  }
});

/**
 * 7. Publish a new version / revision of a section
 */
knowledgeRouter.post('/sections/:id/versions', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const { sectionUpdate, incrementType, changeSummary, status } = req.body;

    const result = await KnowledgeService.createVersion(
      sectionId,
      sectionUpdate || {},
      (req as any).user,
      { incrementType, changeSummary, status }
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Failed to create new version', err);
    res.status(500).json({ error: err.message || 'Не вдалося зберегти нову версію' });
  }
});

/**
 * 8. Restore a historical version of a section
 */
knowledgeRouter.post('/sections/:id/revert', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const { versionNumber } = req.body;
    if (typeof versionNumber !== 'number') {
      return res.status(400).json({ error: 'Номер версії для відновлення обов’язковий' });
    }

    const result = await KnowledgeService.restoreVersion(
      sectionId,
      versionNumber,
      (req as any).user
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Failed to restore version', err);
    res.status(500).json({ error: err.message || 'Не вдалося відновити версію' });
  }
});

/**
 * 9b. Download the original source file (PDF/DOCX) attached to a specific historical revision
 */
knowledgeRouter.get('/sections/:id/versions/:versionNumber/source-file', ensureUser, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const versionNumber = Number(req.params.versionNumber);
    const version = await KnowledgeService.getVersionSourceFile(sectionId, versionNumber);
    const sourceFile = (version as any).sourceFile;

    if (!sourceFile?.storagePath || !fileExists(sourceFile.storagePath)) {
      return res.status(404).json({ error: 'Оригінальний файл для цієї версії не знайдено' });
    }

    res.download(getFileAbsolutePath(sourceFile.storagePath), sourceFile.fileName || 'original');
  } catch (err: any) {
    console.error('Failed to download version source file', err);
    res.status(404).json({ error: err.message || 'Файл не знайдено' });
  }
});

/**
 * 9c. Download the full raw Markdown (with quiz/stop-lists) for a specific historical revision
 */
knowledgeRouter.get('/sections/:id/versions/:versionNumber/source-file.md', ensureUser, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const versionNumber = Number(req.params.versionNumber);
    const version = await KnowledgeService.getVersionSourceFile(sectionId, versionNumber);

    // Файл на диску (documents/<id>/v<N>/instruction.md) — першоджерело редакції
    const markdownFile = (version as any).markdownFile;
    if (markdownFile?.storagePath && fileExists(markdownFile.storagePath)) {
      return res.download(getFileAbsolutePath(markdownFile.storagePath), `${sectionId}-v${versionNumber}.md`);
    }

    const rawMarkdown = (version as any).rawMarkdown;
    if (!rawMarkdown) {
      return res.status(404).json({ error: 'Markdown-файл для цієї версії не знайдено' });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sectionId}-v${versionNumber}.md"`);
    res.send(rawMarkdown);
  } catch (err: any) {
    console.error('Failed to download version markdown', err);
    res.status(404).json({ error: err.message || 'Файл не знайдено' });
  }
});

/**
 * 9. Update lifecycle status (draft, in_review, published, archived)
 */
knowledgeRouter.patch('/sections/:id/status', ensureUser, requirePermission('knowledge.article.publish'), async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const { status, reviewNotes } = req.body;
    if (!['draft', 'in_review', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Недійсний статус документа' });
    }

    const result = await KnowledgeService.updateStatus(
      sectionId,
      status,
      reviewNotes || '',
      (req as any).user
    );

    res.json(result);
  } catch (err: any) {
    console.error('Failed to update document status', err);
    res.status(500).json({ error: err.message || 'Не вдалося змінити статус документа' });
  }
});
