import { Router, Request, Response } from 'express';
import { ProgressService } from './service.js';
import { requirePermission, scopeFilter, isUserInScope } from '../core/permissions.js';
import { User } from '../../models.js';
import { LearningAssignment } from './models.js';

export const progressV2Router = Router();

// SECURITY: requirePermission('learning.assignment.create'/'certificate.revoke') only confirms
// the caller holds the permission at SOME scope (self/team/department/all) — it has no idea
// which record :id/:userId refers to. Without this helper a manager/HR granted a narrower scope
// could mutate/revoke any user's data by guessing/reusing an id from outside their scope.
async function assertAssignmentInScope(req: Request, res: Response, assignmentId: string, permission: string) {
  const assignment = await LearningAssignment.findById(assignmentId);
  if (!assignment) {
    res.status(404).json({ error: 'Призначення не знайдено' });
    return null;
  }
  const target = await User.findById(assignment.userId).select('_id departmentId managerId');
  if (!target) {
    res.status(404).json({ error: 'Користувача не знайдено' });
    return null;
  }
  const allowed = await isUserInScope((req as any).user, target, permission);
  if (!allowed) {
    res.status(403).json({ error: 'Немає доступу до цього призначення' });
    return null;
  }
  return assignment;
}

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

// 7. Admin / Manager: Get specific user progress
progressV2Router.get('/admin/user/:userId', requirePermission('analytics.report.view'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // SECURITY: requirePermission only confirms the caller holds analytics.report.view at
    // SOME scope — without this check a manager/HR with a narrower scope (e.g. 'team')
    // could read any user's full progress by just changing the :userId in the URL.
    const target = await User.findById(String(userId)).select('_id departmentId managerId');
    if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
    const allowed = await isUserInScope((req as any).user, target, 'analytics.report.view');
    if (!allowed) return res.status(403).json({ error: 'Немає доступу до аналітики цього користувача' });

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

    const target = await User.findById(userId).select('_id departmentId managerId');
    if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
    if (!(await isUserInScope(currentUser, target, 'certificate.revoke'))) {
      return res.status(403).json({ error: 'Немає доступу до сертифіката цього користувача' });
    }

    const result = await ProgressService.revokeCertificate(String(userId), String(courseId), currentUser._id, reason);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to revoke certificate', err);
    res.status(500).json({ error: err.message || 'Не вдалося анулювати сертифікат' });
  }
});

// ==========================================
// Крок 7. Рушій призначень (Assignment Engine)
// ==========================================

// 9. Current user: get my assignments
progressV2Router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const assignments = await ProgressService.getUserAssignments(user._id);
    res.json({ assignments });
  } catch (err: any) {
    console.error('Failed to get user assignments', err);
    res.status(500).json({ error: 'Помилка отримання призначень' });
  }
});

// 9.1 Current user: get My Day aggregated summary (Крок 9. Головна сторінка «Мій день»)
progressV2Router.get('/my-day', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const assignments = await ProgressService.getUserAssignments(user._id);
    const progress = await ProgressService.getUserProgress(user._id);

    const pendingCount = assignments.filter((a: any) => a.status !== 'completed').length;
    const overdueCount = assignments.filter((a: any) => a.status === 'overdue' || (a.status !== 'completed' && (a.daysRemaining || 0) < 0)).length;
    const completedCount = assignments.filter((a: any) => a.status === 'completed').length;

    res.json({
      assignments,
      summary: {
        totalAssignments: assignments.length,
        pendingAssignments: pendingCount,
        overdueAssignments: overdueCount,
        completedAssignments: completedCount,
        isSigned: !!progress?.employeeInfo?.isSigned,
        bestScore: progress?.bestScore || 0,
        readCount: progress?.readSectionIds?.length || 0,
        certificatesCount: progress?.certificates?.length || 0
      }
    });
  } catch (err: any) {
    console.error('Failed to get My Day summary', err);
    res.status(500).json({ error: 'Помилка отримання зведення Мій день' });
  }
});

// 10. Admin / Manager: get assignments report (with RBAC scoping)
progressV2Router.get('/admin/assignments', requirePermission('learning.assignment.view'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userFilter = await scopeFilter(user, 'learning.assignment.view');
    if (userFilter._id === null) {
      return res.json({ stats: { total: 0, completed: 0, inProgress: 0, assigned: 0, overdue: 0, complianceRate: 100 }, assignments: [] });
    }

    const report = await ProgressService.getAssignmentsReport(userFilter);
    res.json(report);
  } catch (err: any) {
    console.error('Failed to get assignments report', err);
    res.status(500).json({ error: 'Помилка завантаження звіту призначень' });
  }
});

// 11. Admin / Manager: create assignment (single, multiple, department, all)
progressV2Router.post('/admin/assignments', requirePermission('learning.assignment.create'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { targetType, targetId, title, targetScope, userId, userIds, department, dueDate, priority, notes } = req.body;

    if (!targetId || !title || !dueDate) {
      return res.status(400).json({ error: 'targetId, title та dueDate є обов\'язковими' });
    }

    const result = await ProgressService.createAssignment({
      assignedBy: currentUser._id,
      assignedByName: currentUser.fullName || currentUser.username || 'Керівник',
      targetType: targetType || 'course',
      targetId,
      title,
      targetScope: targetScope || 'single',
      userId,
      userIds,
      department,
      dueDate,
      priority: priority || 'mandatory',
      notes
    });

    res.json({ success: true, count: result.length, assignments: result });
  } catch (err: any) {
    console.error('Failed to create assignment', err);
    res.status(500).json({ error: err.message || 'Помилка створення призначення' });
  }
});

// 12. Admin / Manager: update assignment (deadline, priority, notes, status)
progressV2Router.patch('/admin/assignments/:id', requirePermission('learning.assignment.create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await assertAssignmentInScope(req, res, String(id), 'learning.assignment.create'))) return;

    const { dueDate, priority, notes, status } = req.body;
    const updated = await ProgressService.updateAssignment(String(id), { dueDate, priority, notes, status });
    res.json({ success: true, assignment: updated });
  } catch (err: any) {
    console.error('Failed to update assignment', err);
    res.status(500).json({ error: err.message || 'Помилка оновлення призначення' });
  }
});

// 13. Admin / Manager: send deadline reminder to employee
progressV2Router.post('/admin/assignments/:id/remind', requirePermission('learning.assignment.create'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { id } = req.params;
    if (!(await assertAssignmentInScope(req, res, String(id), 'learning.assignment.create'))) return;

    const result = await ProgressService.remindAssignment(String(id), currentUser.fullName || currentUser.username);
    res.json(result);
  } catch (err: any) {
    console.error('Failed to send reminder', err);
    res.status(500).json({ error: err.message || 'Помилка надсилання нагадування' });
  }
});

// 14. Admin / Manager: delete assignment
progressV2Router.delete('/admin/assignments/:id', requirePermission('learning.assignment.create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await assertAssignmentInScope(req, res, String(id), 'learning.assignment.create'))) return;

    const result = await ProgressService.deleteAssignment(String(id));
    res.json(result);
  } catch (err: any) {
    console.error('Failed to delete assignment', err);
    res.status(500).json({ error: err.message || 'Помилка видалення призначення' });
  }
});
