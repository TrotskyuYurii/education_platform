import mongoose from 'mongoose';
import { User, Department, Position, Section, Course, Case } from '../../models.js';
import { NotificationService } from '../notifications/service.js';
import {
  OnboardingTemplate,
  OnboardingAssignment,
  OnboardingStepProgress,
  OnboardingAutoRule,
  OnboardingSurveyResponse,
  DEFAULT_STAGES,
  OnboardingStepType
} from './models.js';
import { validateOnboardingGraph, AUTO_STEP_TYPES } from '../../../shared/onboardingGraph.js';

type ObjectIdLike = string | mongoose.Types.ObjectId;

const toObjectId = (id: ObjectIdLike): mongoose.Types.ObjectId =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

const formatDate = (d: Date): string =>
  d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

/**
 * Перелік службових кроків і сама перевірка графа живуть у shared/, бо тими самими
 * правилами користується редактор схеми — інакше клієнт і сервер розходяться
 * у відповіді на питання «чи можна це публікувати».
 */


export class OnboardingService {

  // ==========================================================
  // Шаблони
  // ==========================================================

  /**
   * Перевіряє граф перед збереженням: без циклів, без «висячих» ребер,
   * і хоча б один крок, до якого можна дійти. Повертає список проблем —
   * чернетку з проблемами зберегти можна, опублікувати — ні.
   */
  static validateGraph(nodes: any[], edges: any[]): string[] {
    return validateOnboardingGraph(nodes, edges);
  }

  static async listTemplates(options: { includeArchived?: boolean } = {}) {
    const filter: any = options.includeArchived ? {} : { status: { $ne: 'archived' } };
    const templates = await OnboardingTemplate.find(filter).sort({ updatedAt: -1 });

    const ids = templates.map(t => t.id);
    const counts = await OnboardingAssignment.aggregate([
      { $match: { templateId: { $in: ids } } },
      { $group: { _id: { templateId: '$templateId', status: '$status' }, count: { $sum: 1 } } }
    ]);

    const statsByTemplate = new Map<string, { active: number; completed: number; total: number }>();
    for (const row of counts) {
      const key = row._id.templateId;
      const entry = statsByTemplate.get(key) || { active: 0, completed: 0, total: 0 };
      entry.total += row.count;
      if (row._id.status === 'completed') entry.completed += row.count;
      else if (row._id.status !== 'cancelled') entry.active += row.count;
      statsByTemplate.set(key, entry);
    }

    const [departments, positions] = await Promise.all([
      Department.find({}, { name: 1 }),
      Position.find({}, { title: 1 })
    ]);
    const deptNames = new Map(departments.map((d: any) => [d._id.toString(), d.name]));
    const posTitles = new Map(positions.map((p: any) => [p._id.toString(), p.title]));

    return templates.map(t => {
      const stats = statsByTemplate.get(t.id) || { active: 0, completed: 0, total: 0 };
      const realSteps = (t.nodes || []).filter((n: any) => !AUTO_STEP_TYPES.includes(n.type));
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        status: t.status,
        version: t.version,
        durationDays: t.durationDays,
        requiresBuddy: t.requiresBuddy,
        departmentId: t.departmentId?.toString() || null,
        departmentName: t.departmentId ? deptNames.get(t.departmentId.toString()) || null : null,
        positionId: t.positionId?.toString() || null,
        positionTitle: t.positionId ? posTitles.get(t.positionId.toString()) || null : null,
        stepsCount: realSteps.length,
        estimatedMinutes: realSteps.reduce((sum: number, n: any) => sum + (n.estimatedMinutes || 0), 0),
        assignedTotal: stats.total,
        assignedActive: stats.active,
        assignedCompleted: stats.completed,
        createdByName: t.createdByName,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });
  }

  static async getTemplate(id: string) {
    const template = await OnboardingTemplate.findOne({ id });
    if (!template) throw Object.assign(new Error('Шаблон онбордінгу не знайдено'), { statusCode: 404 });
    return template;
  }

  static async createTemplate(data: any, actor: any) {
    const slug = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nodes = Array.isArray(data.nodes) && data.nodes.length > 0
      ? data.nodes
      : [
          { id: 'start', type: 'start', title: 'Початок', position: { x: 80, y: 200 }, isRequired: false },
          { id: 'finish', type: 'finish', title: 'Онбординг завершено', position: { x: 620, y: 200 }, isRequired: false }
        ];
    const edges = Array.isArray(data.edges) ? data.edges : [];

    const template = await OnboardingTemplate.create({
      id: data.id || slug,
      name: data.name,
      description: data.description || '',
      icon: data.icon || 'Rocket',
      color: data.color || 'blue',
      departmentId: data.departmentId || undefined,
      positionId: data.positionId || undefined,
      status: 'draft',
      durationDays: data.durationDays ?? 90,
      requiresBuddy: Boolean(data.requiresBuddy),
      surveyDayOffsets: Array.isArray(data.surveyDayOffsets) ? data.surveyDayOffsets : [7, 30, 90],
      stages: Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : DEFAULT_STAGES,
      nodes,
      edges,
      createdBy: actor?._id,
      createdByName: actor?.fullName || actor?.username || ''
    });
    return template;
  }

  static async updateTemplate(id: string, data: any) {
    const template = await this.getTemplate(id);

    const nextNodes = data.nodes ?? template.nodes;
    const nextEdges = data.edges ?? template.edges;

    // Валідуємо саме перехід у «опубліковано», а не кожне збереження вже
    // опублікованої схеми: інакше видалений матеріал робив би шаблон
    // неможливим ані зберегти, ані виправити. Призначення зламаної схеми
    // окремо блокує assignTemplate.
    if (data.status === 'published') {
      const issues = this.validateGraph(nextNodes, nextEdges);
      if (issues.length > 0) {
        throw Object.assign(
          new Error(`Неможливо опублікувати: ${issues.join('; ')}`),
          { statusCode: 400 }
        );
      }
    }

    // Запам'ятовуємо статус ДО застосування полів: цикл нижче вже перезапише
    // template.status, і перевірка переходу «чернетка → опубліковано» стала б
    // завжди хибною, а версія — назавжди застрягла б на 1.
    const previousStatus = template.status;

    const fields = [
      'name', 'description', 'icon', 'color', 'durationDays',
      'requiresBuddy', 'surveyDayOffsets', 'stages', 'nodes', 'edges', 'status'
    ];
    for (const f of fields) {
      if (data[f] !== undefined) (template as any)[f] = data[f];
    }
    // Порожній рядок з форми означає «прибрати прив'язку», а не «не міняти».
    if (data.departmentId !== undefined) template.departmentId = data.departmentId || undefined;
    if (data.positionId !== undefined) template.positionId = data.positionId || undefined;

    // Кожна публікація — нова версія. Вже призначені онбординги працюють
    // зі своєю замороженою копією графа і не зачіпаються.
    if (data.status === 'published' && previousStatus !== 'published') {
      template.version = (template.version || 1) + 1;
    }
    template.updatedAt = new Date();
    await template.save();
    return template;
  }

  static async deleteTemplate(id: string) {
    const activeCount = await OnboardingAssignment.countDocuments({
      templateId: id,
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (activeCount > 0) {
      throw Object.assign(
        new Error(`Шаблон використовується в ${activeCount} активних онбордінгах. Спершу завершіть або скасуйте їх, або переведіть шаблон в архів.`),
        { statusCode: 409 }
      );
    }
    await OnboardingTemplate.deleteOne({ id });
    await OnboardingAutoRule.deleteMany({ templateId: id });
    return { success: true };
  }

  static async duplicateTemplate(id: string, actor: any) {
    const source = await this.getTemplate(id);
    return this.createTemplate({
      name: `${source.name} (копія)`,
      description: source.description,
      icon: source.icon,
      color: source.color,
      departmentId: source.departmentId,
      positionId: source.positionId,
      durationDays: source.durationDays,
      requiresBuddy: source.requiresBuddy,
      surveyDayOffsets: source.surveyDayOffsets,
      stages: source.stages,
      nodes: source.nodes,
      edges: source.edges
    }, actor);
  }

  // ==========================================================
  // Призначення
  // ==========================================================

  /**
   * Хто фактично закриває крок. Для ролей 'hr'/'it' повертає всіх носіїв
   * ролі — задача з'являється у кожного, закриває будь-хто один.
   * 'it' не має власної ролі в базовій матриці ролей, тому підстраховуємось
   * адміністраторами, щоб крок не залишився без відповідального.
   */
  static async resolveStepOwners(node: any, assignment: any): Promise<mongoose.Types.ObjectId[]> {
    switch (node.ownerRole) {
      case 'buddy':
        return assignment.buddyUserId ? [assignment.buddyUserId] : [];
      case 'manager':
        return assignment.managerUserId ? [assignment.managerUserId] : [];
      case 'custom':
        return node.ownerUserId ? [node.ownerUserId] : [];
      case 'hr': {
        const hrs = await User.find({ roleKeys: 'hr', isActive: { $ne: false } }, { _id: 1 });
        return hrs.map((u: any) => u._id);
      }
      case 'it': {
        const its = await User.find({ roleKeys: 'it', isActive: { $ne: false } }, { _id: 1 });
        if (its.length > 0) return its.map((u: any) => u._id);
        const admins = await User.find({ $or: [{ role: 'admin' }, { roleKeys: 'admin' }] }, { _id: 1 });
        return admins.map((u: any) => u._id);
      }
      case 'employee':
      default:
        return [assignment.userId];
    }
  }

  /**
   * Призначити шаблон. targetScope:
   *  - 'single'     → одна людина
   *  - 'multiple'   → список людей
   *  - 'department' → весь підрозділ
   *  - 'position'   → всі на посаді
   */
  static async assignTemplate(data: {
    templateId: string;
    targetScope: 'single' | 'multiple' | 'department' | 'position';
    userId?: string;
    userIds?: string[];
    departmentId?: string;
    positionId?: string;
    startDate?: string | Date;
    buddyUserId?: string;
    notes?: string;
    assignedBy: ObjectIdLike;
    assignedByName?: string;
    source?: 'manual' | 'auto';
    /** Звуження вибірки до зони видимості того, хто призначає (RBAC scope). */
    allowedUserFilter?: any;
  }) {
    const template = await this.getTemplate(data.templateId);
    if (template.status === 'archived') {
      throw Object.assign(new Error('Не можна призначити архівний шаблон'), { statusCode: 400 });
    }
    const issues = this.validateGraph(template.nodes, template.edges);
    if (issues.length > 0) {
      throw Object.assign(new Error(`Шаблон містить помилки: ${issues.join('; ')}`), { statusCode: 400 });
    }

    // Порожній фільтр = повний доступ; усе інше додається до запиту як AND,
    // тож людина поза зоною видимості просто не потрапить у вибірку.
    const scope = data.allowedUserFilter && Object.keys(data.allowedUserFilter).length > 0
      ? [data.allowedUserFilter]
      : [];
    const withScope = (query: any) => (scope.length > 0 ? { $and: [query, ...scope] } : query);

    let targetUsers: any[] = [];
    if (data.targetScope === 'single' && data.userId) {
      targetUsers = await User.find(withScope({ _id: data.userId }));
    } else if (data.targetScope === 'multiple' && Array.isArray(data.userIds) && data.userIds.length > 0) {
      targetUsers = await User.find(withScope({ _id: { $in: data.userIds } }));
    } else if (data.targetScope === 'department' && data.departmentId) {
      targetUsers = await User.find(withScope({ departmentId: data.departmentId, isActive: { $ne: false } }));
    } else if (data.targetScope === 'position' && data.positionId) {
      targetUsers = await User.find(withScope({ positionId: data.positionId, isActive: { $ne: false } }));
    }

    if (targetUsers.length === 0) {
      throw Object.assign(
        new Error('Не знайдено співробітників для призначення у вашій зоні видимості'),
        { statusCode: 400 }
      );
    }

    const results = [];
    for (const target of targetUsers) {
      // Дата відліку: явно вказана → дата найму → сьогодні.
      const startDate = startOfDay(
        data.startDate ? new Date(data.startDate)
          : target.hireDate ? new Date(target.hireDate)
          : new Date()
      );
      const assignment = await this.createAssignmentForUser(template, target, startDate, data);
      results.push(assignment);
    }
    return results;
  }

  private static async createAssignmentForUser(template: any, target: any, startDate: Date, data: any) {
    const graph = {
      stages: template.stages,
      nodes: template.nodes,
      edges: template.edges
    };
    const realSteps = template.nodes.filter((n: any) => !AUTO_STEP_TYPES.includes(n.type));
    const maxOffset = template.nodes.reduce(
      (max: number, n: any) => Math.max(max, n.dueOffsetDays || 0),
      template.durationDays || 0
    );
    const dueDate = addDays(startDate, maxOffset);

    const assignment = await OnboardingAssignment.findOneAndUpdate(
      { userId: target._id, templateId: template.id },
      {
        $set: {
          templateName: template.name,
          templateVersion: template.version,
          graph,
          startDate,
          dueDate,
          status: 'not_started',
          buddyUserId: data.buddyUserId || undefined,
          managerUserId: target.managerId || undefined,
          assignedBy: toObjectId(data.assignedBy),
          assignedByName: data.assignedByName || 'Керівник',
          assignedDate: new Date(),
          source: data.source || 'manual',
          notes: data.notes || '',
          totalSteps: realSteps.length,
          completedSteps: 0,
          progressPercent: 0,
          completedAt: undefined,
          overdueNotifiedAt: undefined,
          surveysSentOffsets: []
        }
      },
      { upsert: true, new: true }
    );

    if (data.buddyUserId) {
      const buddy = await User.findById(data.buddyUserId).select('fullName username');
      assignment.buddyName = buddy?.fullName || buddy?.username || '';
      await assignment.save();
    }

    // Перепризначення того ж шаблону починає проходження з чистого аркуша.
    await OnboardingStepProgress.deleteMany({ assignmentId: assignment._id });
    await OnboardingStepProgress.insertMany(
      template.nodes.map((n: any) => ({
        assignmentId: assignment._id,
        userId: target._id,
        nodeId: n.id,
        status: 'locked',
        dueDate: addDays(startDate, n.dueOffsetDays || 0)
      }))
    );

    await this.recalcAssignment(assignment._id, { notify: false });

    await NotificationService.send({
      userId: target._id,
      type: 'onboarding_assigned',
      payload: {
        templateName: template.name,
        stepsCount: realSteps.length,
        dueDate: formatDate(dueDate)
      }
    });

    if (assignment.buddyUserId) {
      await NotificationService.send({
        userId: assignment.buddyUserId,
        type: 'onboarding_buddy_assigned',
        payload: {
          employeeName: target.fullName || target.username || target.email,
          templateName: template.name
        }
      });
    }

    return assignment;
  }

  // ==========================================================
  // Рушій проходження
  // ==========================================================

  /**
   * Перераховує стани кроків за графом: крок доступний, коли всі його
   * попередники закриті. Оновлює прогрес призначення і, якщо notify=true,
   * повідомляє про щойно розблоковані кроки.
   */
  static async recalcAssignment(assignmentId: ObjectIdLike, options: { notify?: boolean } = {}) {
    const notify = options.notify !== false;
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (!assignment || assignment.status === 'cancelled') return assignment;

    const nodes = assignment.graph?.nodes || [];
    const edges = assignment.graph?.edges || [];
    const progresses = await OnboardingStepProgress.find({ assignmentId: assignment._id });
    const progressByNode = new Map(progresses.map(p => [p.nodeId, p]));

    const incoming = new Map<string, string[]>();
    for (const n of nodes) incoming.set(n.id, []);
    for (const e of edges) {
      if (incoming.has(e.target)) incoming.get(e.target)!.push(e.source);
    }

    const isClosed = (nodeId: string) => {
      const p = progressByNode.get(nodeId);
      return p ? (p.status === 'completed' || p.status === 'skipped') : false;
    };

    const newlyUnlocked: any[] = [];

    // Кілька проходів: закриття службового вузла може розблокувати наступний
    // у тому ж перерахунку (напр. start → ... → finish).
    for (let pass = 0; pass < nodes.length + 1; pass++) {
      let changed = false;

      for (const node of nodes) {
        const progress = progressByNode.get(node.id);
        if (!progress || progress.status === 'completed' || progress.status === 'skipped') continue;

        const deps = incoming.get(node.id) || [];
        const ready = deps.every(isClosed);
        if (!ready) continue;

        if (AUTO_STEP_TYPES.includes(node.type)) {
          // 'start' відкриває граф; 'finish' закривається сам, коли все перед ним готове.
          progress.status = 'completed';
          progress.completedAt = new Date();
          await progress.save();
          changed = true;
          continue;
        }

        if (progress.status === 'locked') {
          progress.status = 'available';
          await progress.save();
          newlyUnlocked.push({ node, progress });
          changed = true;
        }
      }

      if (!changed) break;
    }

    const realNodes = nodes.filter((n: any) => !AUTO_STEP_TYPES.includes(n.type));
    const requiredNodes = realNodes.filter((n: any) => n.isRequired !== false);
    const doneRequired = requiredNodes.filter((n: any) => isClosed(n.id)).length;
    const doneAll = realNodes.filter((n: any) => isClosed(n.id)).length;

    assignment.completedSteps = doneAll;
    assignment.totalSteps = realNodes.length;
    assignment.progressPercent = requiredNodes.length > 0
      ? Math.round((doneRequired / requiredNodes.length) * 100)
      : (realNodes.length > 0 ? Math.round((doneAll / realNodes.length) * 100) : 100);

    const wasCompleted = assignment.status === 'completed';
    // Якщо обов'язкових кроків немає взагалі (усі позначені як необов'язкові
    // або в схемі лише службові вузли), критерієм завершення стають усі кроки —
    // інакше такий онбординг висів би «в процесі» назавжди.
    const isFinished = requiredNodes.length > 0
      ? doneRequired === requiredNodes.length
      : doneAll === realNodes.length;

    if (isFinished) {
      assignment.status = 'completed';
      if (!assignment.completedAt) assignment.completedAt = new Date();
    } else if (doneAll > 0) {
      assignment.status = assignment.dueDate < new Date() ? 'overdue' : 'in_progress';
    } else {
      assignment.status = assignment.dueDate < new Date() ? 'overdue' : 'not_started';
    }
    await assignment.save();

    if (notify) {
      for (const { node, progress } of newlyUnlocked) {
        if (progress.unlockNotifiedAt) continue;
        const owners = await this.resolveStepOwners(node, assignment);
        const isEmployeeStep = (node.ownerRole || 'employee') === 'employee';
        for (const ownerId of owners) {
          await NotificationService.send({
            userId: ownerId,
            type: isEmployeeStep ? 'onboarding_step_unlocked' : 'onboarding_step_task',
            payload: {
              stepTitle: node.title,
              templateName: assignment.templateName,
              employeeName: assignment.userId.toString() === ownerId.toString()
                ? 'вас'
                : await this.userDisplayName(assignment.userId),
              dueDate: progress.dueDate ? formatDate(progress.dueDate) : '—'
            }
          });
        }
        progress.unlockNotifiedAt = new Date();
        await progress.save();
      }

      if (!wasCompleted && assignment.status === 'completed') {
        await NotificationService.send({
          userId: assignment.userId,
          type: 'onboarding_completed',
          payload: { templateName: assignment.templateName }
        });
        if (assignment.managerUserId) {
          await NotificationService.send({
            userId: assignment.managerUserId,
            type: 'onboarding_completed_manager',
            payload: {
              templateName: assignment.templateName,
              employeeName: await this.userDisplayName(assignment.userId)
            }
          });
        }
      }
    }

    return assignment;
  }

  private static async userDisplayName(userId: ObjectIdLike): Promise<string> {
    const u = await User.findById(userId).select('fullName username email');
    return u?.fullName || u?.username || u?.email || 'Співробітник';
  }

  /**
   * Закрити крок. actor — хто натиснув; має бути серед відповідальних за крок
   * (перевірка виконується тут, бо вона залежить від графа, а не від RBAC-скоупу).
   */
  static async completeStep(assignmentId: ObjectIdLike, nodeId: string, actor: any, comment?: string) {
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (!assignment) throw Object.assign(new Error('Онбординг не знайдено'), { statusCode: 404 });

    const node = (assignment.graph?.nodes || []).find((n: any) => n.id === nodeId);
    if (!node) throw Object.assign(new Error('Крок не знайдено'), { statusCode: 404 });

    const progress = await OnboardingStepProgress.findOne({ assignmentId: assignment._id, nodeId });
    if (!progress) throw Object.assign(new Error('Прогрес кроку не знайдено'), { statusCode: 404 });

    if (progress.status === 'locked') {
      throw Object.assign(new Error('Крок ще заблокований — спершу завершіть попередні'), { statusCode: 409 });
    }
    if (progress.status === 'completed') {
      return { success: true, alreadyCompleted: true };
    }

    const isAdmin = actor.role === 'admin' || actor.roleKeys?.includes('admin');
    if (!isAdmin) {
      const owners = await this.resolveStepOwners(node, assignment);
      const isOwner = owners.some(o => o.toString() === actor._id.toString());
      if (!isOwner) {
        throw Object.assign(new Error('Цей крок закриває інший відповідальний'), { statusCode: 403 });
      }
    }

    progress.status = 'completed';
    progress.completedAt = new Date();
    progress.completedByUserId = actor._id;
    progress.completedByName = actor.fullName || actor.username || '';
    if (comment) progress.comment = comment;
    await progress.save();

    await this.recalcAssignment(assignment._id);
    return { success: true };
  }

  /** Адміністративне пропускання кроку (напр. людина вже має цей досвід). */
  static async skipStep(assignmentId: ObjectIdLike, nodeId: string, actor: any, comment?: string) {
    const progress = await OnboardingStepProgress.findOne({ assignmentId, nodeId });
    if (!progress) throw Object.assign(new Error('Крок не знайдено'), { statusCode: 404 });

    progress.status = 'skipped';
    progress.completedAt = new Date();
    progress.completedByUserId = actor._id;
    progress.completedByName = actor.fullName || actor.username || '';
    progress.comment = comment || 'Крок пропущено відповідальним';
    await progress.save();

    await this.recalcAssignment(assignmentId);
    return { success: true };
  }

  /** Повернути крок у роботу (помилково закритий). */
  static async reopenStep(assignmentId: ObjectIdLike, nodeId: string) {
    const progress = await OnboardingStepProgress.findOne({ assignmentId, nodeId });
    if (!progress) throw Object.assign(new Error('Крок не знайдено'), { statusCode: 404 });

    // Не ставимо одразу 'available': якщо попередні кроки теж відкотили,
    // цей має лишитись заблокованим. Фінальний стан визначить recalcAssignment.
    progress.status = 'locked';
    progress.completedAt = undefined;
    progress.completedByUserId = undefined;
    progress.completedByName = '';
    progress.unlockNotifiedAt = undefined;
    await progress.save();

    // Нащадки могли розблокуватись через цей крок. Свідомо чіпаємо лише ті,
    // що ще не закриті: якщо людина вже склала тест нижче за графом, відкат
    // попереднього кроку не має примушувати її складати його заново.
    // Сам онбординг при цьому перестає бути «завершеним» — це робить recalc.
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (assignment) {
      const descendants = this.collectDescendants(assignment.graph?.edges || [], progress.nodeId);
      if (descendants.length > 0) {
        await OnboardingStepProgress.updateMany(
          { assignmentId, nodeId: { $in: descendants }, status: { $in: ['available', 'in_progress'] } },
          { $set: { status: 'locked' }, $unset: { unlockNotifiedAt: 1 } }
        );
      }
      assignment.completedAt = undefined;
      await assignment.save();
    }

    await this.recalcAssignment(assignmentId);
    return { success: true };
  }

  private static collectDescendants(edges: any[], rootId: string): string[] {
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    }
    const seen = new Set<string>();
    const queue = [...(adjacency.get(rootId) || [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...(adjacency.get(id) || []));
    }
    return [...seen];
  }

  // ==========================================================
  // Автоматичне закриття кроків з навчального прогресу
  // ==========================================================

  /**
   * Викликається з ProgressService, коли людина прочитала інструкцію або
   * склала тест. Закриває відповідні кроки онбордінгу, щоб новачку не
   * доводилось відмічати одне й те саме двічі.
   */
  static async syncFromLearning(
    userId: mongoose.Types.ObjectId,
    targetType: 'course' | 'instruction',
    targetId: string,
    score?: number
  ) {
    try {
      const assignments = await OnboardingAssignment.find({
        userId,
        status: { $nin: ['completed', 'cancelled'] }
      });

      for (const assignment of assignments) {
        // 'quiz' — теж курс, лише з вимогою скласти тест, тому обидва типи
        // закриваються успішною спробою по тому ж courseId.
        const matchTypes: OnboardingStepType[] = targetType === 'course'
          ? ['course', 'quiz']
          : ['instruction'];

        const matching = (assignment.graph?.nodes || []).filter(
          (n: any) => matchTypes.includes(n.type) && n.targetId === targetId
        );
        if (matching.length === 0) continue;

        let touched = false;
        for (const node of matching) {
          const progress = await OnboardingStepProgress.findOne({
            assignmentId: assignment._id,
            nodeId: node.id
          });
          if (!progress || progress.status === 'completed' || progress.status === 'skipped') continue;

          progress.status = 'completed';
          progress.completedAt = new Date();
          progress.comment = score !== undefined
            ? `Автоматично зараховано (результат ${score}%)`
            : 'Автоматично зараховано за прогресом навчання';
          await progress.save();
          touched = true;
        }

        if (touched) await this.recalcAssignment(assignment._id);
      }
    } catch (err) {
      console.error('Failed to sync onboarding from learning progress:', err);
    }
  }

  /** Закриває кроки типу 'acknowledgement' після електронного підпису. */
  static async syncFromAcknowledgement(userId: mongoose.Types.ObjectId) {
    try {
      const assignments = await OnboardingAssignment.find({
        userId,
        status: { $nin: ['completed', 'cancelled'] }
      });
      for (const assignment of assignments) {
        const matching = (assignment.graph?.nodes || []).filter((n: any) => n.type === 'acknowledgement');
        if (matching.length === 0) continue;

        let touched = false;
        for (const node of matching) {
          const progress = await OnboardingStepProgress.findOne({
            assignmentId: assignment._id,
            nodeId: node.id
          });
          if (!progress || progress.status === 'completed' || progress.status === 'skipped') continue;
          progress.status = 'completed';
          progress.completedAt = new Date();
          progress.comment = 'Автоматично зараховано за електронним підписом';
          await progress.save();
          touched = true;
        }
        if (touched) await this.recalcAssignment(assignment._id);
      }
    } catch (err) {
      console.error('Failed to sync onboarding from acknowledgement:', err);
    }
  }

  // ==========================================================
  // Подання для співробітника
  // ==========================================================

  /** Онбординги поточного користувача з розгорнутими кроками. */
  static async getUserOnboardings(viewer: any) {
    const userObjectId = toObjectId(viewer._id);
    const assignments = await OnboardingAssignment.find({
      userId: userObjectId,
      status: { $ne: 'cancelled' }
    }).sort({ assignedDate: -1 });

    const result = [];
    for (const a of assignments) {
      result.push(await this.buildAssignmentView(a, viewer));
    }
    return result;
  }

  static async getAssignmentDetail(assignmentId: ObjectIdLike, viewer?: any) {
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (!assignment) throw Object.assign(new Error('Онбординг не знайдено'), { statusCode: 404 });
    return this.buildAssignmentView(assignment, viewer);
  }

  /**
   * Збирає повне подання: граф + прогрес + назви прив'язаних матеріалів,
   * щоб фронтенд міг намалювати маршрут і відкрити потрібну інструкцію.
   */
  private static async buildAssignmentView(assignment: any, viewer?: any) {
    const viewerId: mongoose.Types.ObjectId | undefined = viewer?._id
      ? toObjectId(viewer._id)
      : undefined;
    const viewerRoleKeys: string[] = viewer?.roleKeys || [];
    const viewerIsAdmin = viewer?.role === 'admin' || viewerRoleKeys.includes('admin');
    const progresses = await OnboardingStepProgress.find({ assignmentId: assignment._id });
    const progressByNode = new Map(progresses.map(p => [p.nodeId, p]));

    const nodes = assignment.graph?.nodes || [];
    const sectionIds = nodes.filter((n: any) => n.type === 'instruction').map((n: any) => n.targetId);
    const courseIds = nodes.filter((n: any) => n.type === 'course' || n.type === 'quiz').map((n: any) => n.targetId);
    const caseIds = nodes.filter((n: any) => n.type === 'case').map((n: any) => n.targetId);

    const [sections, courses, cases, owner] = await Promise.all([
      sectionIds.length ? Section.find({ id: { $in: sectionIds } }, { id: 1, title: 1, readTimeMin: 1 }) : [],
      courseIds.length ? Course.find({ id: { $in: courseIds } }, { id: 1, title: 1 }) : [],
      caseIds.length ? Case.find({ id: { $in: caseIds } }, { id: 1, title: 1 }) : [],
      User.findById(assignment.userId).select('fullName username email avatarUrl departmentId positionId hireDate')
    ]);

    const sectionMap = new Map((sections as any[]).map(s => [s.id, s]));
    const courseMap = new Map((courses as any[]).map(c => [c.id, c]));
    const caseMap = new Map((cases as any[]).map(c => [c.id, c]));

    const isStepOwnedByViewer = (n: any): boolean => {
      if (!viewerId) return false;
      switch (n.ownerRole || 'employee') {
        case 'employee': return assignment.userId.toString() === viewerId.toString();
        case 'buddy': return assignment.buddyUserId?.toString() === viewerId.toString();
        case 'manager': return assignment.managerUserId?.toString() === viewerId.toString();
        case 'custom': return n.ownerUserId?.toString() === viewerId.toString();
        case 'hr': return viewerRoleKeys.includes('hr') || viewerIsAdmin;
        case 'it': return viewerRoleKeys.includes('it') || viewerIsAdmin;
        default: return false;
      }
    };

    const now = new Date();
    const steps = nodes.map((n: any) => {
      const p = progressByNode.get(n.id);
      const target = n.type === 'instruction' ? sectionMap.get(n.targetId)
        : (n.type === 'course' || n.type === 'quiz') ? courseMap.get(n.targetId)
        : n.type === 'case' ? caseMap.get(n.targetId)
        : null;
      const dueDate = p?.dueDate || null;

      return {
        nodeId: n.id,
        type: n.type,
        title: n.title,
        description: n.description || '',
        targetId: n.targetId || '',
        targetTitle: target?.title || '',
        url: n.url || '',
        stageKey: n.stageKey || '',
        ownerRole: n.ownerRole || 'employee',
        ownerUserId: n.ownerUserId?.toString() || null,
        isRequired: n.isRequired !== false,
        estimatedMinutes: n.estimatedMinutes || 0,
        position: n.position || { x: 0, y: 0 },
        status: p?.status || 'locked',
        dueDate: dueDate ? dueDate.toISOString() : null,
        isOverdue: Boolean(dueDate && dueDate < now && p?.status !== 'completed' && p?.status !== 'skipped'),
        completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
        completedByName: p?.completedByName || '',
        comment: p?.comment || '',
        // Чи може саме цей глядач закрити крок (визначає, чи показувати кнопку).
        // Дзеркалить resolveStepOwners: показувати кнопку тому, кому сервер
        // все одно відмовить — гірше, ніж не показувати її взагалі.
        isMine: viewerId ? isStepOwnedByViewer(n) : false
      };
    });

    return {
      id: assignment._id.toString(),
      templateId: assignment.templateId,
      templateName: assignment.templateName,
      userId: assignment.userId.toString(),
      userName: owner?.fullName || owner?.username || owner?.email || '',
      userAvatarUrl: owner?.avatarUrl || '',
      startDate: assignment.startDate.toISOString(),
      dueDate: assignment.dueDate.toISOString(),
      status: assignment.status,
      progressPercent: assignment.progressPercent,
      completedSteps: assignment.completedSteps,
      totalSteps: assignment.totalSteps,
      completedAt: assignment.completedAt ? assignment.completedAt.toISOString() : null,
      buddyUserId: assignment.buddyUserId?.toString() || null,
      buddyName: assignment.buddyName || '',
      managerUserId: assignment.managerUserId?.toString() || null,
      assignedByName: assignment.assignedByName,
      assignedDate: assignment.assignedDate.toISOString(),
      notes: assignment.notes || '',
      daysRemaining: Math.ceil((assignment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      stages: assignment.graph?.stages || [],
      edges: assignment.graph?.edges || [],
      steps
    };
  }

  /**
   * Кроки, де поточний користувач — відповідальний за чужий онбординг
   * (наставник, керівник, HR, IT). Показується в «Мій день».
   */
  static async getOwnerTasks(user: any) {
    const userId = toObjectId(user._id);

    const assignments = await OnboardingAssignment.find({
      status: { $nin: ['completed', 'cancelled'] },
      userId: { $ne: userId }
    });

    // resolveStepOwners для 'hr'/'it' ходить у базу, а ці ролі не залежать
    // від конкретного призначення — тримаємо відповідь у кеші на один виклик.
    const roleOwnerCache = new Map<string, string[]>();
    const isOwner = async (node: any, assignment: any): Promise<boolean> => {
      const role = node.ownerRole || 'employee';
      if (role === 'employee') return false;
      if (role === 'hr' || role === 'it') {
        if (!roleOwnerCache.has(role)) {
          const owners = await this.resolveStepOwners(node, assignment);
          roleOwnerCache.set(role, owners.map(o => o.toString()));
        }
        return roleOwnerCache.get(role)!.includes(userId.toString());
      }
      const owners = await this.resolveStepOwners(node, assignment);
      return owners.some(o => o.toString() === userId.toString());
    };

    const tasks: any[] = [];
    for (const assignment of assignments) {
      const relevantNodes: any[] = [];
      for (const n of assignment.graph?.nodes || []) {
        if (await isOwner(n, assignment)) relevantNodes.push(n);
      }
      if (relevantNodes.length === 0) continue;

      const progresses = await OnboardingStepProgress.find({
        assignmentId: assignment._id,
        nodeId: { $in: relevantNodes.map((n: any) => n.id) },
        status: { $in: ['available', 'in_progress'] }
      });
      if (progresses.length === 0) continue;

      const employeeName = await this.userDisplayName(assignment.userId);
      const nodeMap = new Map(relevantNodes.map((n: any) => [n.id, n]));

      for (const p of progresses) {
        const node: any = nodeMap.get(p.nodeId);
        tasks.push({
          assignmentId: assignment._id.toString(),
          nodeId: p.nodeId,
          title: node.title,
          description: node.description || '',
          type: node.type,
          ownerRole: node.ownerRole,
          employeeName,
          employeeId: assignment.userId.toString(),
          templateName: assignment.templateName,
          dueDate: p.dueDate ? p.dueDate.toISOString() : null,
          isOverdue: Boolean(p.dueDate && p.dueDate < new Date())
        });
      }
    }

    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    return tasks;
  }

  // ==========================================================
  // Звітність для HR / керівника
  // ==========================================================

  static async getReport(userFilter: any = {}) {
    const targetUsers = await User.find(userFilter, {
      _id: 1, fullName: 1, username: 1, email: 1, departmentId: 1, positionId: 1, hireDate: 1, avatarUrl: 1
    });
    const userMap = new Map(targetUsers.map((u: any) => [u._id.toString(), u]));

    const assignments = await OnboardingAssignment.find({
      userId: { $in: targetUsers.map((u: any) => u._id) },
      status: { $ne: 'cancelled' }
    }).sort({ startDate: -1 });

    const [departments, positions] = await Promise.all([
      Department.find({}, { name: 1 }),
      Position.find({}, { title: 1 })
    ]);
    const deptNames = new Map(departments.map((d: any) => [d._id.toString(), d.name]));
    const posTitles = new Map(positions.map((p: any) => [p._id.toString(), p.title]));

    const now = new Date();
    const rows = assignments.map((a: any) => {
      const u: any = userMap.get(a.userId.toString());
      const isOverdue = a.status !== 'completed' && a.dueDate < now;
      return {
        id: a._id.toString(),
        userId: a.userId.toString(),
        userName: u?.fullName || u?.username || u?.email || 'Користувач',
        userAvatarUrl: u?.avatarUrl || '',
        departmentName: u?.departmentId ? deptNames.get(u.departmentId.toString()) || '' : '',
        positionTitle: u?.positionId ? posTitles.get(u.positionId.toString()) || '' : '',
        hireDate: u?.hireDate ? new Date(u.hireDate).toISOString() : null,
        templateId: a.templateId,
        templateName: a.templateName,
        startDate: a.startDate.toISOString(),
        dueDate: a.dueDate.toISOString(),
        status: isOverdue ? 'overdue' : a.status,
        progressPercent: a.progressPercent,
        completedSteps: a.completedSteps,
        totalSteps: a.totalSteps,
        buddyName: a.buddyName || '',
        assignedByName: a.assignedByName,
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
        daysRemaining: Math.ceil((a.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      };
    });

    const completed = rows.filter(r => r.status === 'completed');
    // Середній час адаптації рахуємо лише по завершених — інакше показник
    // «покращується» щоразу, коли хтось лише починає онбординг.
    const avgDaysToComplete = completed.length > 0
      ? Math.round(completed.reduce((sum, r) => {
          const start = new Date(r.startDate).getTime();
          const end = new Date(r.completedAt!).getTime();
          return sum + (end - start) / (1000 * 60 * 60 * 24);
        }, 0) / completed.length)
      : 0;

    return {
      stats: {
        total: rows.length,
        notStarted: rows.filter(r => r.status === 'not_started').length,
        inProgress: rows.filter(r => r.status === 'in_progress').length,
        completed: completed.length,
        overdue: rows.filter(r => r.status === 'overdue').length,
        completionRate: rows.length > 0 ? Math.round((completed.length / rows.length) * 100) : 0,
        avgProgress: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.progressPercent, 0) / rows.length) : 0,
        avgDaysToComplete
      },
      assignments: rows
    };
  }

  /** Найчастіші «затики»: кроки, на яких люди зупиняються найдовше. */
  static async getBottlenecks(userFilter: any = {}) {
    const targetUsers = await User.find(userFilter, { _id: 1 });
    const assignments = await OnboardingAssignment.find({
      userId: { $in: targetUsers.map((u: any) => u._id) },
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (assignments.length === 0) return [];

    const titleByNode = new Map<string, string>();
    for (const a of assignments) {
      for (const n of a.graph?.nodes || []) {
        titleByNode.set(`${a.templateId}:${n.id}`, n.title);
      }
    }
    const assignmentTemplate = new Map(assignments.map((a: any) => [a._id.toString(), a.templateId]));

    const stuck = await OnboardingStepProgress.find({
      assignmentId: { $in: assignments.map((a: any) => a._id) },
      status: { $in: ['available', 'in_progress'] },
      dueDate: { $lt: new Date() }
    });

    const counter = new Map<string, { title: string; count: number; totalDaysLate: number }>();
    const now = Date.now();
    for (const p of stuck) {
      const templateId = assignmentTemplate.get(p.assignmentId.toString());
      const key = `${templateId}:${p.nodeId}`;
      const entry = counter.get(key) || { title: titleByNode.get(key) || p.nodeId, count: 0, totalDaysLate: 0 };
      entry.count += 1;
      entry.totalDaysLate += p.dueDate ? Math.ceil((now - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      counter.set(key, entry);
    }

    return [...counter.entries()]
      .map(([key, v]) => ({
        key,
        title: v.title,
        stuckCount: v.count,
        avgDaysLate: Math.round(v.totalDaysLate / v.count)
      }))
      .sort((a, b) => b.stuckCount - a.stuckCount)
      .slice(0, 10);
  }

  static async cancelAssignment(assignmentId: ObjectIdLike) {
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (!assignment) throw Object.assign(new Error('Онбординг не знайдено'), { statusCode: 404 });
    assignment.status = 'cancelled';
    await assignment.save();
    return { success: true };
  }

  static async updateAssignment(
    assignmentId: ObjectIdLike,
    data: { startDate?: string; buddyUserId?: string; notes?: string },
    actor?: any
  ) {
    const assignment = await OnboardingAssignment.findById(assignmentId);
    if (!assignment) throw Object.assign(new Error('Онбординг не знайдено'), { statusCode: 404 });

    if (data.startDate) {
      // Зсув дати виходу перераховує всі дедлайни кроків — інакше новачок,
      // що вийшов на два тижні пізніше, одразу отримує прострочення.
      // Зберігаємо початкову тривалість онбордінгу, а не перераховуємо її
      // з offset-ів кроків: інакше перенос старту непомітно вкорочував строк.
      const previousSpanDays = Math.round(
        (assignment.dueDate.getTime() - assignment.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newStart = startOfDay(new Date(data.startDate));
      assignment.startDate = newStart;
      assignment.dueDate = addDays(newStart, previousSpanDays);

      for (const node of assignment.graph?.nodes || []) {
        await OnboardingStepProgress.updateOne(
          { assignmentId: assignment._id, nodeId: node.id },
          { $set: { dueDate: addDays(newStart, node.dueOffsetDays || 0) }, $unset: { dueReminderSentAt: 1 } }
        );
      }
      assignment.overdueNotifiedAt = undefined;
    }

    if (data.buddyUserId !== undefined) {
      const previousBuddy = assignment.buddyUserId?.toString();
      assignment.buddyUserId = data.buddyUserId || undefined;
      if (data.buddyUserId) {
        const buddy = await User.findById(data.buddyUserId).select('fullName username');
        assignment.buddyName = buddy?.fullName || buddy?.username || '';
        if (previousBuddy !== data.buddyUserId) {
          await NotificationService.send({
            userId: data.buddyUserId,
            type: 'onboarding_buddy_assigned',
            payload: {
              employeeName: await this.userDisplayName(assignment.userId),
              templateName: assignment.templateName
            }
          });
        }
      } else {
        assignment.buddyName = '';
      }
    }

    if (data.notes !== undefined) assignment.notes = data.notes;

    await assignment.save();
    await this.recalcAssignment(assignment._id);
    return this.getAssignmentDetail(assignment._id, actor);
  }

  // ==========================================================
  // Правила автозапуску
  // ==========================================================

  static async listAutoRules() {
    const rules = await OnboardingAutoRule.find({}).sort({ priority: -1, createdAt: -1 });
    const [departments, positions] = await Promise.all([
      Department.find({}, { name: 1 }),
      Position.find({}, { title: 1 })
    ]);
    const deptNames = new Map(departments.map((d: any) => [d._id.toString(), d.name]));
    const posTitles = new Map(positions.map((p: any) => [p._id.toString(), p.title]));

    return rules.map((r: any) => ({
      id: r._id.toString(),
      templateId: r.templateId,
      templateName: r.templateName,
      departmentId: r.departmentId?.toString() || null,
      departmentName: r.departmentId ? deptNames.get(r.departmentId.toString()) || '' : '',
      positionId: r.positionId?.toString() || null,
      positionTitle: r.positionId ? posTitles.get(r.positionId.toString()) || '' : '',
      locationId: r.locationId?.toString() || null,
      isActive: r.isActive,
      priority: r.priority
    }));
  }

  static async createAutoRule(data: any, actor: any) {
    const template = await this.getTemplate(data.templateId);
    return OnboardingAutoRule.create({
      templateId: template.id,
      templateName: template.name,
      departmentId: data.departmentId || undefined,
      positionId: data.positionId || undefined,
      locationId: data.locationId || undefined,
      isActive: data.isActive !== false,
      priority: data.priority || 0,
      createdBy: actor?._id
    });
  }

  static async updateAutoRule(id: string, data: any) {
    const rule = await OnboardingAutoRule.findById(id);
    if (!rule) throw Object.assign(new Error('Правило не знайдено'), { statusCode: 404 });
    if (data.isActive !== undefined) rule.isActive = data.isActive;
    if (data.priority !== undefined) rule.priority = data.priority;
    if (data.departmentId !== undefined) rule.departmentId = data.departmentId || undefined;
    if (data.positionId !== undefined) rule.positionId = data.positionId || undefined;
    if (data.locationId !== undefined) rule.locationId = data.locationId || undefined;
    await rule.save();
    return rule;
  }

  static async deleteAutoRule(id: string) {
    await OnboardingAutoRule.deleteOne({ _id: id });
    return { success: true };
  }

  /**
   * Підбирає і запускає онбординг для щойно створеного співробітника.
   * Викликається при створенні користувача; мовчки нічого не робить,
   * якщо жодне правило не підходить — щоб не блокувати створення акаунта.
   */
  static async applyAutoRulesForUser(user: any, actor: any) {
    try {
      const rules = await OnboardingAutoRule.find({ isActive: true }).sort({ priority: -1 });
      if (rules.length === 0) return null;

      const matched = rules.find(r => {
        if (r.departmentId && String(r.departmentId) !== String(user.departmentId)) return false;
        if (r.positionId && String(r.positionId) !== String(user.positionId)) return false;
        if (r.locationId && String(r.locationId) !== String(user.locationId)) return false;
        // Правило без жодного критерію — загальний онбординг для всіх новачків.
        return true;
      });
      if (!matched) return null;

      const template = await OnboardingTemplate.findOne({ id: matched.templateId, status: 'published' });
      if (!template) return null;

      const results = await this.assignTemplate({
        templateId: matched.templateId,
        targetScope: 'single',
        userId: user._id.toString(),
        startDate: user.hireDate || new Date(),
        assignedBy: actor?._id || user._id,
        assignedByName: actor?.fullName || 'Автоматичне правило',
        source: 'auto'
      });
      return results[0] || null;
    } catch (err) {
      console.error('Failed to auto-assign onboarding:', err);
      return null;
    }
  }

  // ==========================================================
  // Опитування-фідбек
  // ==========================================================

  /** Опитування, які поточний користувач ще не заповнив, але вже має заповнити. */
  static async getPendingSurveys(userId: ObjectIdLike) {
    const userObjectId = toObjectId(userId);
    const assignments = await OnboardingAssignment.find({
      userId: userObjectId,
      status: { $nin: ['cancelled'] }
    });

    const pending: any[] = [];
    const now = new Date();
    for (const a of assignments) {
      const template = await OnboardingTemplate.findOne({ id: a.templateId }, { surveyDayOffsets: 1 });
      const offsets: number[] = template?.surveyDayOffsets || [];
      for (const offset of offsets) {
        const dueOn = addDays(a.startDate, offset);
        if (dueOn > now) continue;
        const existing = await OnboardingSurveyResponse.findOne({ assignmentId: a._id, dayOffset: offset });
        if (existing) continue;
        pending.push({
          assignmentId: a._id.toString(),
          templateName: a.templateName,
          dayOffset: offset,
          availableSince: dueOn.toISOString()
        });
      }
    }
    return pending;
  }

  static async submitSurvey(userId: ObjectIdLike, data: {
    assignmentId: string;
    dayOffset: number;
    satisfaction: number;
    nps?: number;
    clarity?: number;
    supportLevel?: number;
    comment?: string;
  }) {
    const userObjectId = toObjectId(userId);
    const assignment = await OnboardingAssignment.findOne({ _id: data.assignmentId, userId: userObjectId });
    if (!assignment) throw Object.assign(new Error('Онбординг не знайдено'), { statusCode: 404 });

    const response = await OnboardingSurveyResponse.findOneAndUpdate(
      { assignmentId: assignment._id, dayOffset: data.dayOffset },
      {
        $set: {
          userId: userObjectId,
          satisfaction: data.satisfaction,
          nps: data.nps,
          clarity: data.clarity,
          supportLevel: data.supportLevel,
          comment: data.comment || '',
          submittedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    return response;
  }

  static async getSurveyReport(userFilter: any = {}) {
    const targetUsers = await User.find(userFilter, { _id: 1, fullName: 1, username: 1 });
    const userMap = new Map(targetUsers.map((u: any) => [u._id.toString(), u]));
    const responses = await OnboardingSurveyResponse.find({
      userId: { $in: targetUsers.map((u: any) => u._id) }
    }).sort({ submittedAt: -1 });

    const byOffset = new Map<number, { count: number; satisfaction: number; nps: number; npsCount: number; clarity: number; clarityCount: number; support: number; supportCount: number }>();
    for (const r of responses) {
      const entry = byOffset.get(r.dayOffset) || { count: 0, satisfaction: 0, nps: 0, npsCount: 0, clarity: 0, clarityCount: 0, support: 0, supportCount: 0 };
      entry.count += 1;
      entry.satisfaction += r.satisfaction;
      if (typeof r.nps === 'number') { entry.nps += r.nps; entry.npsCount += 1; }
      if (typeof r.clarity === 'number') { entry.clarity += r.clarity; entry.clarityCount += 1; }
      if (typeof r.supportLevel === 'number') { entry.support += r.supportLevel; entry.supportCount += 1; }
      byOffset.set(r.dayOffset, entry);
    }

    const summary = [...byOffset.entries()]
      .map(([dayOffset, v]) => ({
        dayOffset,
        responses: v.count,
        avgSatisfaction: Math.round((v.satisfaction / v.count) * 10) / 10,
        avgNps: v.npsCount > 0 ? Math.round((v.nps / v.npsCount) * 10) / 10 : null,
        avgClarity: v.clarityCount > 0 ? Math.round((v.clarity / v.clarityCount) * 10) / 10 : null,
        avgSupport: v.supportCount > 0 ? Math.round((v.support / v.supportCount) * 10) / 10 : null
      }))
      .sort((a, b) => a.dayOffset - b.dayOffset);

    return {
      summary,
      responses: responses.map((r: any) => ({
        id: r._id.toString(),
        userId: r.userId.toString(),
        userName: (userMap.get(r.userId.toString()) as any)?.fullName
          || (userMap.get(r.userId.toString()) as any)?.username || '',
        dayOffset: r.dayOffset,
        satisfaction: r.satisfaction,
        nps: r.nps ?? null,
        clarity: r.clarity ?? null,
        supportLevel: r.supportLevel ?? null,
        comment: r.comment,
        submittedAt: r.submittedAt.toISOString()
      }))
    };
  }

  // ==========================================================
  // Щоденні завдання (викликаються з планувальника сповіщень)
  // ==========================================================

  static async runDailyJob() {
    const now = new Date();

    // 1. Нагадування про кроки, дедлайн яких настає за 2 дні.
    const soon = addDays(now, 2);
    const upcoming = await OnboardingStepProgress.find({
      status: { $in: ['available', 'in_progress'] },
      dueDate: { $gte: now, $lte: soon },
      dueReminderSentAt: { $exists: false }
    });
    for (const p of upcoming) {
      try {
        const assignment = await OnboardingAssignment.findById(p.assignmentId);
        if (!assignment || assignment.status === 'cancelled') continue;
        const node = (assignment.graph?.nodes || []).find((n: any) => n.id === p.nodeId);
        if (!node) continue;

        const owners = await this.resolveStepOwners(node, assignment);
        for (const ownerId of owners) {
          await NotificationService.send({
            userId: ownerId,
            type: 'onboarding_step_due',
            payload: {
              stepTitle: node.title,
              templateName: assignment.templateName,
              dueDate: p.dueDate ? formatDate(p.dueDate) : '—'
            }
          });
        }
        p.dueReminderSentAt = now;
        await p.save();
      } catch (err) {
        console.error(`Failed onboarding due reminder for step ${p._id}:`, err);
      }
    }

    // 2. Прострочені онбординги — новачку і його керівнику.
    const overdue = await OnboardingAssignment.find({
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: now },
      overdueNotifiedAt: { $exists: false }
    });
    for (const a of overdue) {
      try {
        a.status = 'overdue';
        await NotificationService.send({
          userId: a.userId,
          type: 'onboarding_overdue',
          payload: { templateName: a.templateName },
          forceCritical: true
        });
        if (a.managerUserId) {
          await NotificationService.send({
            userId: a.managerUserId,
            type: 'onboarding_overdue_manager',
            payload: {
              templateName: a.templateName,
              employeeName: await this.userDisplayName(a.userId)
            }
          });
        }
        a.overdueNotifiedAt = now;
        await a.save();
      } catch (err) {
        console.error(`Failed onboarding overdue notification for ${a._id}:`, err);
      }
    }

    // 3. Запити на опитування-фідбек (7/30/90 день).
    const active = await OnboardingAssignment.find({ status: { $ne: 'cancelled' } });
    const templates = await OnboardingTemplate.find(
      { id: { $in: [...new Set(active.map((a: any) => a.templateId))] } },
      { id: 1, surveyDayOffsets: 1 }
    );
    const offsetsByTemplate = new Map<string, number[]>(
      templates.map((t: any) => [t.id, t.surveyDayOffsets || []])
    );
    for (const a of active) {
      try {
        const offsets: number[] = offsetsByTemplate.get(a.templateId) || [];
        for (const offset of offsets) {
          if ((a.surveysSentOffsets || []).includes(offset)) continue;
          if (addDays(a.startDate, offset) > now) continue;
          const answered = await OnboardingSurveyResponse.findOne({ assignmentId: a._id, dayOffset: offset });
          if (answered) continue;

          await NotificationService.send({
            userId: a.userId,
            type: 'onboarding_survey_request',
            payload: { dayOffset: offset, templateName: a.templateName }
          });
          a.surveysSentOffsets = [...(a.surveysSentOffsets || []), offset];
          await a.save();
        }
      } catch (err) {
        console.error(`Failed onboarding survey dispatch for ${a._id}:`, err);
      }
    }
  }
}
