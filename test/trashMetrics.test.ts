import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import 'dotenv/config';

/**
 * Матеріали в корзині не впливають на показники: найкращий бал, історію спроб,
 * сертифікати, прочитане, призначення, звіти аналітики та прогрес онбордингу.
 * Після відновлення все знову враховується.
 */
vi.mock('../server/services/fileStorage.js', () => ({ deleteDocumentStorage: vi.fn() }));
vi.mock('../server/modules/notifications/service.js', () => ({ NotificationService: { send: vi.fn(async () => ({})) } }));

const { User, Section, Course, Case, Progress, Question } = await import('../server/models.js');
const { ReadingProgress, QuizAttempt, CertificateRecord, LearningAssignment } = await import('../server/modules/learning/models.js');
const { OnboardingAssignment, OnboardingStepProgress } = await import('../server/modules/onboarding/models.js');
const { TrashItem } = await import('../server/modules/trash/models.js');
const { TrashService } = await import('../server/modules/trash/service.js');
const { ProgressService } = await import('../server/modules/learning/service.js');
const { AnalyticsService } = await import('../server/modules/analytics/service.js');

const TEST_DB_NAME = 'viatec_trash_metrics_test';

function withDatabase(uri: string, dbName: string): string {
  const [base, query] = uri.split('?');
  const host = base.replace(/\/+$/, '').replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/, '$1');
  return `${host}/${dbName}${query ? `?${query}` : ''}`;
}

const mongoUri = process.env.MONGODB_URI;
const hasDatabase = Boolean(mongoUri);
const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin', roleKeys: ['admin'], fullName: 'Адмін' };
let userId: mongoose.Types.ObjectId;

beforeAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connect(withDatabase(mongoUri!, TEST_DB_NAME));
  await mongoose.connection.db!.dropDatabase();
}, 30000);

afterAll(async () => {
  if (!hasDatabase) return;
  await mongoose.connection.db!.dropDatabase();
  await mongoose.connection.close();
}, 30000);

beforeEach(async () => {
  if (!hasDatabase) return;
  await Promise.all([
    User, Section, Course, Case, Progress, Question, ReadingProgress, QuizAttempt, CertificateRecord,
    LearningAssignment, OnboardingAssignment, OnboardingStepProgress, TrashItem
  ].map(m => (m as any).deleteMany({})));

  const user = await User.create({ username: 'emp', email: 'emp@viatec.ua', passwordHash: 'x' } as any);
  userId = user._id as any;

  await Section.create([
    { id: 'sec-1', title: 'Каса', department: 'Роздріб' },
    { id: 'sec-2', title: 'Склад', department: 'Роздріб' }
  ] as any);
  await Course.create({ id: 'course-1', title: 'Курс каси', department: 'Роздріб', instructionIds: ['sec-1'], hasCertificate: true } as any);

  await ReadingProgress.create([{ userId, sectionId: 'sec-1' }, { userId, sectionId: 'sec-2' }] as any);
  await Progress.create({ userId, readSectionIds: ['sec-1', 'sec-2'] } as any);
  await QuizAttempt.create([
    { userId, courseId: 'course-1', score: 19, total: 20, percentage: 95, passed: true },
    { userId, sectionId: 'sec-2', score: 6, total: 10, percentage: 60 },
    { userId, score: 5, total: 10, percentage: 50 }
  ] as any);
  await CertificateRecord.create({ userId, courseId: 'course-1', courseTitle: 'Курс каси', expiresAt: new Date(Date.now() + 86400000 * 20) } as any);
  await LearningAssignment.create([
    { userId, targetType: 'course', targetId: 'course-1', title: 'Курс каси', dueDate: new Date(Date.now() - 86400000) },
    { userId, targetType: 'instruction', targetId: 'sec-2', title: 'Склад', dueDate: new Date(Date.now() + 86400000) }
  ] as any);
});

const snapshot = async () => {
  const progress = await ProgressService.getUserProgress(userId);
  const assignments = await ProgressService.getUserAssignments(userId);
  const [report] = await ProgressService.getUsersProgressReport({ _id: userId });
  const tests = await AnalyticsService.getTestResults(admin, {});
  const coverage = await AnalyticsService.getCoverageByDepartment(admin, {});
  const certs = await AnalyticsService.getCertificatesSummary(admin, {});
  return {
    bestScore: progress.bestScore,
    attempts: progress.testScores.length,
    answers: progress.totalQuestionsAnswered,
    certificates: progress.certificates.length,
    read: progress.readSectionIds.slice().sort(),
    assignments: assignments.map((a: any) => a.targetId).sort(),
    reportTests: report.stats.testsCount,
    reportBest: report.stats.bestScore,
    reportCerts: report.stats.certificatesCount,
    analyticsAttempts: tests.totalAttempts,
    analyticsAvg: tests.avgScore,
    coverageTotal: coverage.totals?.total ?? 0,
    activeCerts: certs.active,
    expiring: certs.expiringIn30
  };
};

describe.skipIf(!hasDatabase)('показники й прогрес без матеріалів з корзини', () => {
  it('видалений курс не впливає на бал, сертифікати, призначення й аналітику; відновлення повертає', async () => {
    const before = await snapshot();
    expect(before).toMatchObject({
      bestScore: 95, attempts: 3, certificates: 1, assignments: ['course-1', 'sec-2'],
      reportTests: 3, reportCerts: 1, analyticsAttempts: 3, coverageTotal: 2, activeCerts: 1, expiring: 1
    });

    await TrashService.trashCourse('course-1', admin);
    const trashed = await snapshot();
    expect(trashed).toMatchObject({
      bestScore: 60, attempts: 2, answers: 20, certificates: 0, assignments: ['sec-2'],
      reportTests: 2, reportBest: 60, reportCerts: 0,
      analyticsAttempts: 2, analyticsAvg: 55, coverageTotal: 1, activeCerts: 0, expiring: 0
    });
    // Записи не видалено — лише не враховуються
    expect(await QuizAttempt.countDocuments({ courseId: 'course-1' })).toBe(1);

    const [item] = (await TrashService.list({})).items;
    await TrashService.restore(item.id);
    expect(await snapshot()).toEqual(before);
  });

  it('видалена інструкція: прочитане й спроби не рахуються, а після відновлення повертаються', async () => {
    await TrashService.trashInstruction('sec-2', admin);
    let s = await snapshot();
    expect(s.read).toEqual(['sec-1']);
    expect(s.attempts).toBe(2);
    expect(s.assignments).toEqual(['course-1']);

    // Браузер зберігає прогрес лише з наявними інструкціями — позначка sec-2 зникає з ReadingProgress
    await ProgressService.saveReadSections(userId, ['sec-1']);

    const [item] = (await TrashService.list({})).items;
    await TrashService.restore(item.id);
    s = await snapshot();
    expect(s.read).toEqual(['sec-1', 'sec-2']);
    expect(s.attempts).toBe(3);
    expect(s.assignments).toEqual(['course-1', 'sec-2']);
  });

  it('крок онбордингу з видаленим матеріалом не блокує маршрут і не входить у відсоток', async () => {
    const assignment = await OnboardingAssignment.create({
      templateId: 't-1', templateName: 'Адаптація', userId,
      startDate: new Date(), dueDate: new Date(Date.now() + 86400000 * 30), status: 'in_progress',
      graph: {
        nodes: [
          { id: 'n-read', type: 'instruction', title: 'Прочитати склад', targetId: 'sec-2' },
          { id: 'n-task', type: 'task', title: 'Зустріч з наставником' },
          { id: 'n-next', type: 'task', title: 'Після читання' }
        ],
        edges: [{ id: 'e1', source: 'n-read', target: 'n-next' }]
      }
    } as any);
    await OnboardingStepProgress.create([
      { assignmentId: assignment._id, userId, nodeId: 'n-read', status: 'available' },
      { assignmentId: assignment._id, userId, nodeId: 'n-task', status: 'completed' },
      { assignmentId: assignment._id, userId, nodeId: 'n-next', status: 'locked' }
    ] as any);

    const { OnboardingService } = await import('../server/modules/onboarding/service.js');
    await OnboardingService.recalcAssignment(assignment._id, { notify: false });
    expect((await OnboardingAssignment.findById(assignment._id).lean<any>()).progressPercent).toBe(33);

    await TrashService.trashInstruction('sec-2', admin);
    const after = await OnboardingAssignment.findById(assignment._id).lean<any>();
    // Лишилось два кроки, один виконано; наступний після зниклого — розблоковано
    expect(after.progressPercent).toBe(50);
    expect(after.totalSteps).toBe(2);
    expect((await OnboardingStepProgress.findOne({ nodeId: 'n-next' }).lean<any>()).status).toBe('available');
  });
});
