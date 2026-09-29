import { Router } from 'express';
import { z } from 'zod';
import { requireAdminRole } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { auditService } from '../core/audit.js';
import { DuplicateService } from './duplicates.js';

/**
 * «Адміністрування → Інструменти». Службові інструменти обслуговування бази
 * знань; доступні лише ролі «Адміністратор», без делегування іншим ролям.
 */
export const toolsRouter = Router();
toolsRouter.use(requireAdminRole);

// Пошук дублів по всій базі інструкцій.
toolsRouter.get('/duplicates', async (req, res, next) => {
  try {
    res.json(await DuplicateService.find({ threshold: req.query.threshold }));
  } catch (err) { next(err); }
});

const CheckSchema = z.object({
  body: z.object({
    sectionIds: z.array(z.string().min(1).max(200)).min(1).max(100),
    threshold: z.number().optional()
  })
});

// Перевірка конкретних (щойно імпортованих) інструкцій на дублі з рештою бази.
toolsRouter.post('/duplicates/check', validateRequest(CheckSchema), async (req, res, next) => {
  try {
    const { sectionIds, threshold } = req.body;
    res.json(await DuplicateService.find({ focusIds: sectionIds, threshold }));
  } catch (err) { next(err); }
});

const DismissSchema = z.object({
  body: z.object({
    a: z.string().min(1).max(200),
    b: z.string().min(1).max(200)
  }).refine(v => v.a !== v.b, { message: 'Інструкції пари мають відрізнятися' })
});

// «Це не дубль, залишити обидві».
toolsRouter.post('/duplicates/dismiss', validateRequest(DismissSchema), async (req: any, res, next) => {
  try {
    const { a, b } = req.body;
    await DuplicateService.dismiss(a, b, req.user?._id?.toString());
    await auditService.log({
      actorId: req.user?._id?.toString(),
      action: 'duplicates.dismiss',
      entityType: 'Section',
      entityId: `${a}|${b}`,
      ip: req.ip,
      userAgent: req.get?.('user-agent')
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});
