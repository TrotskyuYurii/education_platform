import { Router } from 'express';
import { requirePermission } from '../core/permissions.js';
import { sanitizeAppSettingsPatch } from '../../../shared/appSettings.js';
import { AppSettingsService } from './service.js';

export const settingsRouter = Router();

// Читати налаштування може кожен, хто увійшов: від них залежить, що бачить
// співробітник (наприклад, висловлювання в тестах).
settingsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ settings: await AppSettingsService.get() });
  } catch (err) { next(err); }
});

settingsRouter.patch('/', requirePermission('system.settings.manage'), async (req: any, res, next) => {
  try {
    const { patch, rejected } = sanitizeAppSettingsPatch(req.body?.settings);
    if (rejected.length > 0) {
      return res.status(400).json({ error: `Невідоме налаштування або хибне значення: ${rejected.join(', ')}` });
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Немає змін для збереження' });
    }
    const settings = await AppSettingsService.update(patch, req.user?._id?.toString());
    res.json({ settings });
  } catch (err) { next(err); }
});
