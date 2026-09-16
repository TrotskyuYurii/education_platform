import { Router, Request, Response, NextFunction } from 'express';
import { OnboardingService } from './service.js';
import { OnboardingAssignment } from './models.js';
import { requirePermission, scopeFilter, isUserInScope } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { User } from '../../models.js';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  AssignTemplateSchema,
  CompleteStepSchema,
  SubmitSurveySchema,
  AutoRuleSchema
} from './validation.js';

export const onboardingRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/**
 * SECURITY: requirePermission підтверджує лише, що право є хоч у якомусь скоупі,
 * і нічого не знає про те, чий саме онбординг лежить за :id. Без цієї перевірки
 * керівник зі скоупом 'team' міг би відкрити/змінити онбординг будь-кого,
 * просто підставивши інший id у URL.
 */
async function assertAssignmentInScope(req: Request, res: Response, assignmentId: string, permission: string) {
  const assignment = await OnboardingAssignment.findById(assignmentId);
  if (!assignment) {
    res.status(404).json({ error: 'Онбординг не знайдено' });
    return null;
  }
  const viewer = (req as any).user;

  // Наставник і керівник конкретного онбордінгу бачать його завжди — це їхня
  // операційна роль у цьому процесі, а не ширший доступ до чужих даних.
  const isDirectlyInvolved =
    assignment.userId.toString() === viewer._id.toString() ||
    assignment.buddyUserId?.toString() === viewer._id.toString() ||
    assignment.managerUserId?.toString() === viewer._id.toString();

  if (isDirectlyInvolved) return assignment;

  const target = await User.findById(assignment.userId).select('_id departmentId managerId');
  if (!target) {
    res.status(404).json({ error: 'Користувача не знайдено' });
    return null;
  }
  if (!(await isUserInScope(viewer, target, permission))) {
    res.status(403).json({ error: 'Немає доступу до цього онбордінгу' });
    return null;
  }
  return assignment;
}

// ==========================================================
// Каталог шаблонів
// ==========================================================

onboardingRouter.get('/templates', requirePermission('onboarding.assignment.view'), asyncHandler(async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const templates = await OnboardingService.listTemplates({ includeArchived });
  res.json({ templates });
}));

onboardingRouter.get('/templates/:id', requirePermission('onboarding.assignment.view'), asyncHandler(async (req, res) => {
  const template = await OnboardingService.getTemplate(String(req.params.id));
  const issues = OnboardingService.validateGraph(template.nodes, template.edges);
  res.json({ template, issues });
}));

onboardingRouter.post(
  '/templates',
  requirePermission('onboarding.template.manage'),
  validateRequest(CreateTemplateSchema),
  asyncHandler(async (req, res) => {
    const template = await OnboardingService.createTemplate(req.body, (req as any).user);
    res.status(201).json({ success: true, template });
  })
);

onboardingRouter.put(
  '/templates/:id',
  requirePermission('onboarding.template.manage'),
  validateRequest(UpdateTemplateSchema),
  asyncHandler(async (req, res) => {
    const template = await OnboardingService.updateTemplate(String(req.params.id), req.body);
    const issues = OnboardingService.validateGraph(template.nodes, template.edges);
    res.json({ success: true, template, issues });
  })
);

onboardingRouter.post('/templates/:id/duplicate', requirePermission('onboarding.template.manage'), asyncHandler(async (req, res) => {
  const template = await OnboardingService.duplicateTemplate(String(req.params.id), (req as any).user);
  res.status(201).json({ success: true, template });
}));

onboardingRouter.delete('/templates/:id', requirePermission('onboarding.template.manage'), asyncHandler(async (req, res) => {
  const result = await OnboardingService.deleteTemplate(String(req.params.id));
  res.json(result);
}));

// ==========================================================
// Призначення
// ==========================================================

onboardingRouter.post(
  '/assignments',
  requirePermission('onboarding.assignment.create'),
  validateRequest(AssignTemplateSchema),
  asyncHandler(async (req, res) => {
    const actor = (req as any).user;
    const body = req.body;

    // Той самий контроль скоупу, що й для читання: керівник з правом 'team'
    // не має призначати онбординг людям поза своєю командою. Для явних
    // списків відповідаємо 403 (людина бачить, що обрала когось зайвого),
    // для підрозділу/посади фільтр просто звужує вибірку в сервісі.
    const allowedFilter = await scopeFilter(actor, 'onboarding.assignment.create');
    if (allowedFilter._id === null) {
      return res.status(403).json({ error: 'Немає доступу до призначення онбордінгу' });
    }
    const candidateIds =
      body.targetScope === 'single' ? [body.userId]
        : body.targetScope === 'multiple' ? (body.userIds || [])
        : [];
    for (const id of candidateIds) {
      const target = await User.findById(id).select('_id departmentId managerId');
      if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
      if (!(await isUserInScope(actor, target, 'onboarding.assignment.create'))) {
        return res.status(403).json({ error: 'Немає доступу до одного з обраних співробітників' });
      }
    }

    const assignments = await OnboardingService.assignTemplate({
      ...body,
      allowedUserFilter: allowedFilter,
      assignedBy: actor._id,
      assignedByName: actor.fullName || actor.username || 'Керівник'
    });
    res.status(201).json({ success: true, count: assignments.length, assignments });
  })
);

onboardingRouter.get('/assignments/report', requirePermission('onboarding.assignment.view'), asyncHandler(async (req, res) => {
  const userFilter = await scopeFilter((req as any).user, 'onboarding.assignment.view');
  if (userFilter._id === null) {
    return res.json({ stats: { total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0, completionRate: 0, avgProgress: 0, avgDaysToComplete: 0 }, assignments: [] });
  }
  const report = await OnboardingService.getReport(userFilter);
  res.json(report);
}));

onboardingRouter.get('/assignments/bottlenecks', requirePermission('onboarding.assignment.view'), asyncHandler(async (req, res) => {
  const userFilter = await scopeFilter((req as any).user, 'onboarding.assignment.view');
  if (userFilter._id === null) return res.json({ bottlenecks: [] });
  const bottlenecks = await OnboardingService.getBottlenecks(userFilter);
  res.json({ bottlenecks });
}));

onboardingRouter.get('/assignments/:id', asyncHandler(async (req, res) => {
  const assignment = await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.view');
  if (!assignment) return;
  const detail = await OnboardingService.getAssignmentDetail(assignment._id, (req as any).user);
  res.json({ assignment: detail });
}));

onboardingRouter.patch('/assignments/:id', requirePermission('onboarding.assignment.create'), asyncHandler(async (req, res) => {
  const assignment = await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.create');
  if (!assignment) return;
  const updated = await OnboardingService.updateAssignment(assignment._id, req.body, (req as any).user);
  res.json({ success: true, assignment: updated });
}));

onboardingRouter.delete('/assignments/:id', requirePermission('onboarding.assignment.create'), asyncHandler(async (req, res) => {
  const assignment = await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.create');
  if (!assignment) return;
  const result = await OnboardingService.cancelAssignment(assignment._id);
  res.json(result);
}));

// ==========================================================
// Проходження
// ==========================================================

// Онбординги поточного користувача (його власна сторінка проходження).
onboardingRouter.get('/my', asyncHandler(async (req, res) => {
  const onboardings = await OnboardingService.getUserOnboardings((req as any).user);
  res.json({ onboardings });
}));

// Кроки, де поточний користувач — наставник/керівник/HR/IT для чужого онбордінгу.
onboardingRouter.get('/my/tasks', asyncHandler(async (req, res) => {
  const tasks = await OnboardingService.getOwnerTasks((req as any).user);
  res.json({ tasks });
}));

onboardingRouter.post(
  '/assignments/:id/steps/:nodeId/complete',
  validateRequest(CompleteStepSchema),
  asyncHandler(async (req, res) => {
    const actor = (req as any).user;
    const assignment = await OnboardingAssignment.findById(String(req.params.id));
    if (!assignment) return res.status(404).json({ error: 'Онбординг не знайдено' });

    // Право закрити крок дає сам граф: відповідальний за крок (наставник,
    // призначена людина, HR/IT) мусить могти це зробити, навіть не маючи
    // ширшого права дивитись чужі онбординги. Якщо він не відповідальний —
    // повертаємось до звичайної перевірки зони видимості.
    const node = (assignment.graph?.nodes || []).find((n: any) => n.id === String(req.params.nodeId));
    if (!node) return res.status(404).json({ error: 'Крок не знайдено' });

    const owners = await OnboardingService.resolveStepOwners(node, assignment);
    const isStepOwner = owners.some(o => o.toString() === actor._id.toString());
    if (!isStepOwner) {
      if (!(await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.view'))) return;
    }

    const result = await OnboardingService.completeStep(
      assignment._id,
      String(req.params.nodeId),
      actor,
      req.body?.comment
    );
    const detail = await OnboardingService.getAssignmentDetail(assignment._id, actor);
    res.json({ ...result, assignment: detail });
  })
);

onboardingRouter.post('/assignments/:id/steps/:nodeId/skip', requirePermission('onboarding.assignment.create'), asyncHandler(async (req, res) => {
  const assignment = await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.create');
  if (!assignment) return;
  await OnboardingService.skipStep(assignment._id, String(req.params.nodeId), (req as any).user, req.body?.comment);
  const detail = await OnboardingService.getAssignmentDetail(assignment._id, (req as any).user);
  res.json({ success: true, assignment: detail });
}));

onboardingRouter.post('/assignments/:id/steps/:nodeId/reopen', requirePermission('onboarding.assignment.create'), asyncHandler(async (req, res) => {
  const assignment = await assertAssignmentInScope(req, res, String(req.params.id), 'onboarding.assignment.create');
  if (!assignment) return;
  await OnboardingService.reopenStep(assignment._id, String(req.params.nodeId));
  const detail = await OnboardingService.getAssignmentDetail(assignment._id, (req as any).user);
  res.json({ success: true, assignment: detail });
}));

// ==========================================================
// Правила автозапуску
// ==========================================================

onboardingRouter.get('/auto-rules', requirePermission('onboarding.template.manage'), asyncHandler(async (req, res) => {
  const rules = await OnboardingService.listAutoRules();
  res.json({ rules });
}));

onboardingRouter.post(
  '/auto-rules',
  requirePermission('onboarding.template.manage'),
  validateRequest(AutoRuleSchema),
  asyncHandler(async (req, res) => {
    const rule = await OnboardingService.createAutoRule(req.body, (req as any).user);
    res.status(201).json({ success: true, rule });
  })
);

onboardingRouter.patch('/auto-rules/:id', requirePermission('onboarding.template.manage'), asyncHandler(async (req, res) => {
  const rule = await OnboardingService.updateAutoRule(String(req.params.id), req.body);
  res.json({ success: true, rule });
}));

onboardingRouter.delete('/auto-rules/:id', requirePermission('onboarding.template.manage'), asyncHandler(async (req, res) => {
  const result = await OnboardingService.deleteAutoRule(String(req.params.id));
  res.json(result);
}));

// ==========================================================
// Опитування-фідбек
// ==========================================================

onboardingRouter.get('/surveys/pending', asyncHandler(async (req, res) => {
  const pending = await OnboardingService.getPendingSurveys((req as any).user._id);
  res.json({ pending });
}));

onboardingRouter.post(
  '/surveys',
  validateRequest(SubmitSurveySchema),
  asyncHandler(async (req, res) => {
    const response = await OnboardingService.submitSurvey((req as any).user._id, req.body);
    res.json({ success: true, response });
  })
);

onboardingRouter.get('/surveys/report', requirePermission('onboarding.assignment.view'), asyncHandler(async (req, res) => {
  const userFilter = await scopeFilter((req as any).user, 'onboarding.assignment.view');
  if (userFilter._id === null) return res.json({ summary: [], responses: [] });
  const report = await OnboardingService.getSurveyReport(userFilter);
  res.json(report);
}));
