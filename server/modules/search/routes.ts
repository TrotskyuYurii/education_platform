import { Router } from 'express';
import { SearchService } from './service.js';
import { SearchQueryLog } from '../analytics/models.js';

export const searchRouter = Router();

/**
 * GET /api/search
 * Global omni-search across instructions, questions, cases, courses, and glossary
 */
searchRouter.get('/', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const spaceId = typeof req.query.spaceId === 'string' ? req.query.spaceId : undefined;
    const type = typeof req.query.type === 'string' ? (req.query.type as any) : 'all';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;

    const data = await SearchService.search({
      q,
      spaceId,
      type,
      limit: isNaN(limit) ? 30 : limit
    });

    res.json({ success: true, ...data });

    // Крок 12: log real (non-empty) queries for the "запити без результатів" report.
    // Fire-and-forget, after the response — must never delay or break search itself.
    if (q.trim()) {
      SearchQueryLog.create({
        userId: (req as any).user?._id,
        query: q.trim(),
        resultCount: data.total
      }).catch((err: any) => console.error('Failed to log search query:', err));
    }
  } catch (err: any) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Помилка виконання пошуку', details: err.message });
  }
});
