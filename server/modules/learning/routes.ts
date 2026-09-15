import { Router, Request, Response } from 'express';
import { ProgressService } from './service.js';
import { requirePermission, scopeFilter } from '../core/permissions.js';

export const progressV2Router = Router();

// 1. Current user: get structured progress summary
progressV2Router.get('/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const progress = await ProgressService.getUserProgress(user._id);
    res.json({ progress });
  } catch (err: any) {
    console.error('Failed to get progress summary', err);
    res.status(500).json({ error: 'Помилка отримання прогресу' });
  }
});

// 2. Current user: save read sections
progressV2Router.post('/reads', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { sectionIds } = req.body;
    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ error: 'sectionIds must be an array' });
    }

    const savedIds = await ProgressService.saveReadSections(user._id, sectionIds);
    res.json({ success: true, readSectionIds: savedIds });
  } catch (err: any) {
    console.error('Failed to save read sections', err);
    res.status(500).json({ error: 'Помилка збереження прочитаних матеріалів' });
  }
});

// 3. Current user: record test/quiz attempt
progressV2Router.post('/attempts', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { testScore } = req.body;
    if (!testScore || typeof testScore.score !== 'number' || typeof testScore.total !== 'number') {
      return res.status(400).json({ error: 'Invalid testScore payload' });
    }

    const attempt = await ProgressService.recordAttempt(user._id, testScore);
    const updatedProgress = await ProgressService.getUserProgress(user._id);
    res.json({ success: true, attempt, progress: updatedProgress });
  } catch (err: any) {
    console.error('Failed to record attempt', err);
    res.status(500).json({ error: 'Помилка фіксації спроби тестування' });
  }
});

// 4. Current user: save acknowledgment / profile
progressV2Router.post('/acknowledgment', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { employeeInfo } = req.body;
    if (!employeeInfo) {
      return res.status(400).json({ error: 'employeeInfo is required' });
    }

    const ack = await ProgressService.saveAcknowledgment(user._id, employeeInfo);
    res.json({ success: true, acknowledgment: ack });
  } catch (err: any) {
    console.error('Failed to save acknowledgment', err);
    res.status(500).json({ error: 'Помилка збереження ознайомлення' });
  }
});

// 5. Current user: mark notification as read
progressV2Router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    await ProgressService.markNotificationRead(user._id, String(id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to mark notification as read', err);
    res.status(500).json({ error: 'Помилка оновлення сповіщення' });
  }
});

// 6. Admin / Manager: Get users analytics report scoped by permissions
progressV2Router.get('/admin/users-report', requirePermission('analytics.report.view'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userFilter = await scopeFilter(user, 'analytics.report.view');
    if (userFilter._id === null) {
      return res.json({ users: [] });
    }

    const users = await ProgressService.getUsersProgressReport(userFilter);
    res.json({ users });
  } catch (err: any) {
    console.error('Failed to get users progress report', err);
    res.status(500).json({ error: 'Помилка отримання аналітичного звіту' });
  }
});

// 7. Admin / Manager: Get specific user progress
progressV2Router.get('/admin/user/:userId', requirePermission('analytics.report.view'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const progress = await ProgressService.getUserProgress(String(userId));
    res.json({ progress });
  } catch (err: any) {
    console.error('Failed to get user progress', err);
    res.status(500).json({ error: 'Помилка отримання даних користувача' });
  }
});

// 8. Admin / Manager: Revoke a user's certificate
progressV2Router.delete('/admin/certificates/:userId/:courseId', requirePermission('certificate.revoke'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { userId, courseId } = req.params;
    const { reason } = req.body || {};

    const result = await ProgressService.revokeCertificate(String(userId), String(courseId), currentUser._id, reason);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to revoke certificate', err);
    res.status(500).json({ error: err.message || 'Не вдалося анулювати сертифікат' });
  }
});
