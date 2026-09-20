import mongoose from 'mongoose';
import crypto from 'crypto';
import { User, Section, Course, Progress } from '../../models.js';
import {
  ReadingProgress,
  QuizAttempt,
  CertificateRecord,
  Acknowledgment,
  LearningNotification,
  LearningAssignment
} from './models.js';
import { NotificationService } from '../notifications/service.js';
import { OnboardingService } from '../onboarding/service.js';

// Minimum quiz score required before an employee is allowed to sign the compliance
// acknowledgment sheet (matches the qualification threshold shown throughout the UI).
const ACKNOWLEDGMENT_PASS_THRESHOLD = 80;

/**
 * Позначка часу legacy-документа, з якого користувача вже синхронізували в цьому
 * процесі. Клієнт опитує /api/progress кожні 15 секунд, а syncFromLegacy для
 * кожного виклику робив запит плюс по одному updateOne на кожну прочитану
 * секцію та кожне сповіщення. Для людини з 60 прочитаними розділами це понад
 * сотня звернень до бази щохвилини — і всі вони після першої міграції нічого не
 * змінюють. Legacy-документ пише лише syncToLegacy, і той щоразу оновлює
 * updatedAt, тож незмінна позначка часу однозначно означає «імпортувати нічого».
 * Кеш живе в пам'яті процесу: після перезапуску або в іншому воркері перша
 * синхронізація просто відпрацює повністю, тому коректність не залежить від нього.
 */
const legacySyncWatermarks = new Map<string, number>();

export class ProgressService {
  /**
   * One-way or two-way migration sync: if user has records in monolithic Progress,
   * ensure they exist in granular collections without duplicating.
   */
  static async syncFromLegacy(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const legacy = await Progress.findOne({ userId: userObjectId }).lean<any>();
    if (!legacy) return;
    await this.applyLegacy(userObjectId, legacy);
  }

  /**
   * Те саме, але для списку користувачів: один запит по всіх legacy-документах
   * замість окремого findOne на кожного. Звіт адміністратора будується по сотнях
   * співробітників, і саме ці findOne були там основним джерелом затримки.
   */
  static async syncManyFromLegacy(userIds: mongoose.Types.ObjectId[]): Promise<void> {
    if (userIds.length === 0) return;
    const legacyDocs = await Progress.find({ userId: { $in: userIds } } as any).lean<any[]>();
    await Promise.all(
      legacyDocs.map(legacy => this.applyLegacy(new mongoose.Types.ObjectId(legacy.userId), legacy))
    );
  }

  private static async applyLegacy(
    userObjectId: mongoose.Types.ObjectId,
    legacy: any
  ): Promise<void> {
    const cacheKey = userObjectId.toString();
    const legacyStamp = legacy.updatedAt ? new Date(legacy.updatedAt).getTime() : 0;
    if (legacyStamp > 0 && legacySyncWatermarks.get(cacheKey) === legacyStamp) {
      return;
    }

    // Усі upsert-и нижче складаємо в один bulkWrite на колекцію: та сама робота,
    // але один похід у базу замість циклу окремих запитів.
    const readingOps: any[] = [];
    const certOps: any[] = [];
    const notificationOps: any[] = [];

    // 1. Sync read sections
    if (Array.isArray(legacy.readSectionIds) && legacy.readSectionIds.length > 0) {
      for (const sId of legacy.readSectionIds) {
        if (!sId) continue;
        readingOps.push({
          updateOne: {
            filter: { userId: userObjectId, sectionId: sId },
            update: { $setOnInsert: { userId: userObjectId, sectionId: sId, completedAt: legacy.updatedAt || new Date() } },
            upsert: true
          }
        });
      }
    }

    // 2. Sync test scores
    if (Array.isArray(legacy.testScores) && legacy.testScores.length > 0) {
      const existingAttemptsCount = await QuizAttempt.countDocuments({ userId: userObjectId });
      if (existingAttemptsCount === 0) {
        const attemptsToInsert = legacy.testScores.map((ts: any) => ({
          userId: userObjectId,
          sectionId: ts.sectionId || undefined,
          courseId: ts.courseId || undefined,
          department: ts.department || 'Загальний',
          mode: ts.mode === 'cases' ? 'cases' : 'quiz',
          score: ts.score || 0,
          total: ts.total || 0,
          percentage: ts.percentage || 0,
          passed: (ts.percentage || 0) >= 80,
          date: ts.date ? new Date(ts.date) : new Date()
        }));
        if (attemptsToInsert.length > 0) {
          await QuizAttempt.insertMany(attemptsToInsert);
        }
      }
    }

    // 3. Sync certificates
    if (Array.isArray(legacy.certificates) && legacy.certificates.length > 0) {
      for (const c of legacy.certificates) {
        if (!c.courseId) continue;
        certOps.push({
          updateOne: {
            filter: { userId: userObjectId, courseId: c.courseId, status: 'active' },
            update: {
              $setOnInsert: {
                userId: userObjectId,
                courseId: c.courseId,
                courseTitle: c.courseTitle || 'Курс',
                issuedAt: c.issuedAt ? new Date(c.issuedAt) : new Date(),
                expiresAt: c.expiresAt ? new Date(c.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                status: 'active'
              }
            },
            upsert: true
          }
        });
      }
    }

    // 4. Sync employee info acknowledgment
    if (legacy.employeeInfo && (legacy.employeeInfo.fullName || legacy.employeeInfo.isSigned)) {
      await Acknowledgment.updateOne(
        { userId: userObjectId },
        {
          $set: {
            fullName: legacy.employeeInfo.fullName || '',
            position: legacy.employeeInfo.position || '',
            department: legacy.employeeInfo.department || '',
            signedDate: legacy.employeeInfo.signedDate || '',
            isSigned: !!legacy.employeeInfo.isSigned,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 5. Sync notifications
    if (Array.isArray(legacy.notifications) && legacy.notifications.length > 0) {
      for (const n of legacy.notifications) {
        if (!n.id) continue;
        notificationOps.push({
          updateOne: {
            filter: { userId: userObjectId, notificationId: n.id },
            update: {
              $setOnInsert: {
                userId: userObjectId,
                notificationId: n.id,
                message: n.message || '',
                read: !!n.read,
                date: n.date ? new Date(n.date) : new Date()
              }
            },
            upsert: true
          }
        });
      }
    }

    // Колекції незалежні одна від одної, тож пакети йдуть паралельно.
    // ordered: false — щоб гонка з паралельним записом в одну секцію не
    // обривала решту операцій пакета.
    await Promise.all([
      readingOps.length ? ReadingProgress.bulkWrite(readingOps, { ordered: false }) : null,
      certOps.length ? CertificateRecord.bulkWrite(certOps, { ordered: false }) : null,
      notificationOps.length ? LearningNotification.bulkWrite(notificationOps, { ordered: false }) : null
    ]);

    if (legacyStamp > 0) {
      legacySyncWatermarks.set(cacheKey, legacyStamp);
    }
  }

  /**
   * Keep legacy Progress document synced so legacy queries remain fully functional.
   */
  static async syncToLegacy(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const [reads, attempts, certs, ack, notifs] = await Promise.all([
      ReadingProgress.find({ userId: userObjectId }).select('sectionId'),
      QuizAttempt.find({ userId: userObjectId }).sort({ date: 1 }),
      CertificateRecord.find({ userId: userObjectId, status: 'active' }),
      Acknowledgment.findOne({ userId: userObjectId }),
      LearningNotification.find({ userId: userObjectId }).sort({ date: -1 })
    ]);

    const readSectionIds = reads.map(r => r.sectionId);
    const testScores = attempts.map(a => ({
      sectionId: a.sectionId,
      courseId: a.courseId,
      department: a.department,
      mode: a.mode,
      score: a.score,
      total: a.total,
      percentage: a.percentage,
      date: a.date
    }));
    const certificates = certs.map(c => ({
      courseId: c.courseId,
      courseTitle: c.courseTitle,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt
    }));
    const notifications = notifs.map(n => ({
      id: n.notificationId,
      message: n.message,
      date: n.date,
      read: n.read
    }));
    const employeeInfo = ack ? {
      fullName: ack.fullName,
      position: ack.position,
      department: ack.department,
      signedDate: ack.signedDate,
      isSigned: ack.isSigned
    } : null;

    await Progress.updateOne(
      { userId: userObjectId },
      {
        $set: {
          readSectionIds,
          testScores,
          certificates,
          notifications,
          employeeInfo: employeeInfo || undefined,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  /**
   * Get complete structured progress for a user
   */
  static async getUserProgress(userId: string | mongoose.Types.ObjectId) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Run legacy sync first if needed
    await this.syncFromLegacy(userObjectId);

    // Обробник лише читає й одразу віддає JSON, тож документи Mongoose тут ні до
    // чого: .lean() прибирає гідрацію на найгарячішому маршруті додатка
    // (клієнт смикає /api/progress кожні 15 секунд).
    const [currentSections, reads, attempts, certs, ack, notifs] = await Promise.all([
      Section.find({} as any, { id: 1 } as any).lean<any[]>(),
      ReadingProgress.find({ userId: userObjectId }).select('sectionId').lean<any[]>(),
      QuizAttempt.find({ userId: userObjectId }).sort({ date: 1 }).lean<any[]>(),
      CertificateRecord.find({ userId: userObjectId, status: 'active' }).sort({ issuedAt: -1 }).lean<any[]>(),
      Acknowledgment.findOne({ userId: userObjectId }).lean<any>(),
      LearningNotification.find({ userId: userObjectId }).sort({ date: -1 }).lean<any[]>()
    ]);

    const validSectionIds = new Set(currentSections.map((s: any) => s.id));
    const validReadIds = reads
      .map((r: any) => r.sectionId)
      .filter(id => validSectionIds.has(id));

    const bestScore = attempts.length > 0 
      ? Math.max(...attempts.map((a: any) => a.percentage || 0)) 
      : 0;
    const totalAnswers = attempts.reduce((sum: number, a: any) => sum + (a.total || 0), 0);

      const attemptsList = attempts.map((a: any) => ({
        date: a.date ? (a.date instanceof Date ? a.date.toISOString() : new Date(a.date).toISOString()) : new Date().toISOString(),
        score: a.score,
        total: a.total,
        percentage: a.percentage,
        sectionId: a.sectionId,
        courseId: a.courseId,
        department: a.department || 'Загальний',
        mode: a.mode
      }));

      return {
        readSectionIds: validReadIds,
        quizCompleted: attempts.length > 0,
        bestScore,
        totalQuestionsAnswered: totalAnswers,
        employeeInfo: ack ? {
          fullName: ack.fullName,
          position: ack.position,
          department: ack.department,
          signedDate: ack.signedDate,
          isSigned: ack.isSigned,
          signatureHash: ack.signatureHash || ''
        } : {
          fullName: '',
          position: '',
          department: '',
          signedDate: '',
          isSigned: false,
          signatureHash: ''
        },
        quizHistory: attemptsList,
        testScores: attemptsList,
        certificates: certs.map((c: any) => ({
          courseId: c.courseId,
          courseTitle: c.courseTitle,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt.toISOString()
        })),
        notifications: notifs.map((n: any) => ({
          id: n.notificationId,
          message: n.message,
          date: n.date.toISOString(),
          read: n.read,
          title: n.title || undefined,
          type: n.type,
          isCritical: n.isCritical
        }))
    };
  }

  /**
   * Save read sections
   */
  static async saveReadSections(userId: string | mongoose.Types.ObjectId, rawSectionIds: string[]) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    
    // Filter against real sections
    const currentSections = await Section.find({} as any, { id: 1 } as any).lean<any[]>();
    const validSectionIds = new Set(currentSections.map((s: any) => s.id));
    const seen = new Set<string>();
    const sanitizedIds: string[] = [];

    for (const id of rawSectionIds) {
      if (validSectionIds.has(id) && !seen.has(id)) {
        seen.add(id);
        sanitizedIds.push(id);
      }
    }

    // Overwrite in ReadingProgress
    await ReadingProgress.deleteMany({ userId: userObjectId });
    if (sanitizedIds.length > 0) {
      await ReadingProgress.insertMany(
        sanitizedIds.map(sId => ({
          userId: userObjectId,
          sectionId: sId,
          completedAt: new Date()
        }))
      );

      // Auto-complete assignments for read sections
      for (const sId of sanitizedIds) {
        await this.syncAssignmentCompletion(userObjectId, 'instruction', sId);
      }
    }

    await this.syncToLegacy(userObjectId);
    return sanitizedIds;
  }

  /**
   * Record a quiz / case test attempt
   */
  static async recordAttempt(userId: string | mongoose.Types.ObjectId, testScore: any) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const attempt = await QuizAttempt.create({
      userId: userObjectId,
      sectionId: testScore.sectionId || undefined,
      courseId: testScore.courseId || undefined,
      department: testScore.department || 'Загальний',
      mode: testScore.mode === 'cases' ? 'cases' : 'quiz',
      score: testScore.score || 0,
      total: testScore.total || 0,
      percentage: testScore.percentage || 0,
      passed: (testScore.percentage || 0) >= 80,
      date: testScore.date ? new Date(testScore.date) : new Date()
    });

    // Auto-complete assignments for passed course or test
    if (testScore.percentage >= 80) {
      if (testScore.courseId) {
        await this.syncAssignmentCompletion(userObjectId, 'course', testScore.courseId, testScore.percentage);
      }
      if (testScore.sectionId) {
        await this.syncAssignmentCompletion(userObjectId, 'instruction', testScore.sectionId, testScore.percentage);
      }
    }

    // Check certificate issuance
    if (testScore.courseId && testScore.percentage >= 80) {
      const course = await Course.findOne({ id: testScore.courseId } as any);
      let certificateIssued = false;

      if (course && course.hasCertificate) {
        const existingCert = await CertificateRecord.findOne({
          userId: userObjectId, courseId: course.id, status: 'active'
        });

        const validityYears = course.certificateValidityYears || 1;
        const issuedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setFullYear(issuedAt.getFullYear() + validityYears);

        await CertificateRecord.findOneAndUpdate(
          { userId: userObjectId, courseId: course.id, status: 'active' },
          {
            $set: {
              courseTitle: course.title,
              issuedAt,
              expiresAt,
              status: 'active'
            }
          },
          { upsert: true, new: true }
        );

        // Only notify on a genuinely new issuance, not on retaking an already-passed course.
        if (!existingCert) {
          certificateIssued = true;
          await NotificationService.send({
            userId: userObjectId,
            type: 'certificate_issued',
            payload: { courseTitle: course.title }
          });
        }
      }

      // "Курс завершено" is its own event, but skip it when certificate_issued
      // already covers the same accomplishment to avoid two notifications for one action.
      if (!certificateIssued) {
        const courseForTitle = course || await Course.findOne({ id: testScore.courseId } as any);
        if (courseForTitle) {
          await NotificationService.send({
            userId: userObjectId,
            type: 'course_completed',
            payload: { courseTitle: courseForTitle.title }
          });
        }
      }
    }

    await this.syncToLegacy(userObjectId);
    return attempt;
  }

  /**
   * Save Acknowledgment / Employee Info
   */
  static async saveAcknowledgment(userId: string | mongoose.Types.ObjectId, employeeInfo: any) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const existing = await Acknowledgment.findOne({ userId: userObjectId });
    const wasSignedBefore = Boolean(existing?.isSigned);

    const fullName = employeeInfo.fullName || '';
    const position = employeeInfo.position || '';
    const department = employeeInfo.department || '';
    const signedDate = employeeInfo.signedDate || '';
    const wantsToSign = !!employeeInfo.isSigned;

    if (wantsToSign && !fullName.trim()) {
      throw new Error('Вкажіть ПІБ перед підписанням листа ознайомлення.');
    }

    if (wantsToSign) {
      // A compliance signature is only valid once the employee has actually passed
      // the qualification quiz — enforce this server-side, not just in the UI.
      const attempts = await QuizAttempt.find({ userId: userObjectId });
      const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.percentage || 0)) : 0;
      if (bestScore < ACKNOWLEDGMENT_PASS_THRESHOLD) {
        throw new Error(
          `Підпис недоступний: спочатку потрібно скласти атестаційний тест (мінімум ${ACKNOWLEDGMENT_PASS_THRESHOLD}%). Поточний найкращий результат: ${bestScore}%.`
        );
      }
    }

    // A real, verifiable signature fingerprint (not shown/derived on the client) —
    // ties the signer, their declared identity and the moment of signing together.
    const signatureHash = wantsToSign
      ? crypto
          .createHash('sha256')
          .update(`${userObjectId.toString()}|${fullName}|${position}|${department}|${signedDate}`)
          .digest('hex')
      : existing?.signatureHash;

    const ack = await Acknowledgment.findOneAndUpdate(
      { userId: userObjectId },
      {
        $set: {
          fullName,
          position,
          department,
          signedDate,
          isSigned: wantsToSign,
          signatureHash,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    if (!wasSignedBefore && ack.isSigned) {
      await NotificationService.send({ userId: userObjectId, type: 'acknowledgement_confirmed' });
      await OnboardingService.syncFromAcknowledgement(userObjectId);
    }

    await this.syncToLegacy(userObjectId);
    return ack;
  }

  /**
   * Revoke certificate
   */
  static async revokeCertificate(
    userId: string | mongoose.Types.ObjectId,
    courseId: string,
    revokedBy?: string | mongoose.Types.ObjectId,
    reason?: string
  ) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const cert = await CertificateRecord.findOne({
      userId: userObjectId,
      courseId,
      status: 'active'
    });

    if (!cert) {
      // Fallback check on legacy progress
      const legacy = await Progress.findOne({ userId: userObjectId });
      const legacyCert = legacy?.certificates?.find((c: any) => c.courseId === courseId);
      if (!legacyCert) {
        throw new Error('Сертифікат не знайдено');
      }
    }

    // Mark as revoked in granular collection
    await CertificateRecord.updateMany(
      { userId: userObjectId, courseId, status: 'active' },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: revokedBy ? new mongoose.Types.ObjectId(revokedBy.toString()) : undefined,
          revocationReason: reason || 'Анульовано адміністратором'
        }
      }
    );

    const courseTitle = cert?.courseTitle || 'Курс';

    // Remove the revoked certificate from the legacy embedded array (unrelated
    // to the notification below — NotificationService only touches .notifications).
    const legacy = await Progress.findOne({ userId: userObjectId });
    if (legacy) {
      const idx = legacy.certificates.findIndex((c: any) => c.courseId === courseId);
      if (idx !== -1) {
        legacy.certificates.splice(idx, 1);
        await legacy.save();
      }
    }

    const { notificationId } = await NotificationService.send({
      userId: userObjectId,
      type: 'certificate_revoked',
      payload: { courseTitle }
    });

    return { success: true, notificationId };
  }

  /**
   * Mark notification as read
   */
  static async markNotificationRead(userId: string | mongoose.Types.ObjectId, notificationId: string) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    await LearningNotification.updateMany(
      { userId: userObjectId, notificationId },
      { $set: { read: true } }
    );

    const legacy = await Progress.findOne({ userId: userObjectId });
    if (legacy && legacy.notifications) {
      const n = legacy.notifications.find((notif: any) => notif.id === notificationId);
      if (n) {
        n.read = true;
        await legacy.save();
      }
    }
  }

  /**
   * Analytics summary report for a list of users (scoped)
   */
  static async getUsersProgressReport(userFilter: any, limit: number = 1000, skip: number = 0) {
    const currentSections = await Section.find({} as any, { id: 1 } as any).lean<any[]>();
    const validSectionIds = new Set(currentSections.map((s: any) => s.id));
    const totalSectionsCount = currentSections.length;

    const users = await User.find(userFilter)
      .select('-passwordHash -authCode')
      .populate('departmentId', 'name')
      .populate('managerId', 'fullName email username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const userIds = users.map(u => u._id);

    // Sync from legacy for each user in list to ensure up-to-date data
    await this.syncManyFromLegacy(userIds as mongoose.Types.ObjectId[]);

    // Fetch granular data in parallel
    const [allReads, allAttempts, allCerts, allAcks] = await Promise.all([
      ReadingProgress.find({ userId: { $in: userIds } }).select('userId sectionId').lean<any[]>(),
      QuizAttempt.find({ userId: { $in: userIds } }).sort({ date: 1 }).lean<any[]>(),
      CertificateRecord.find({ userId: { $in: userIds }, status: 'active' }).lean<any[]>(),
      Acknowledgment.find({ userId: { $in: userIds } }).lean<any[]>()
    ]);

    // Group by userId
    const readsMap = new Map<string, Set<string>>();
    allReads.forEach((r: any) => {
      const uid = r.userId.toString();
      if (!readsMap.has(uid)) readsMap.set(uid, new Set());
      if (validSectionIds.has(r.sectionId)) {
        readsMap.get(uid)!.add(r.sectionId);
      }
    });

    const attemptsMap = new Map<string, any[]>();
    allAttempts.forEach((a: any) => {
      const uid = a.userId.toString();
      if (!attemptsMap.has(uid)) attemptsMap.set(uid, []);
      attemptsMap.get(uid)!.push(a);
    });

    const certsMap = new Map<string, any[]>();
    allCerts.forEach((c: any) => {
      const uid = c.userId.toString();
      if (!certsMap.has(uid)) certsMap.set(uid, []);
      certsMap.get(uid)!.push(c);
    });

    const acksMap = new Map<string, any>();
    allAcks.forEach((ack: any) => {
      acksMap.set(ack.userId.toString(), ack);
    });

    return users.map(u => {
      const uid = u._id.toString();
      const userAttempts = attemptsMap.get(uid) || [];
      const userReads = readsMap.get(uid) || new Set();
      const userCerts = certsMap.get(uid) || [];
      const ack = acksMap.get(uid);

      const bestScore = userAttempts.length > 0 
        ? Math.max(...userAttempts.map(a => a.percentage || 0)) 
        : 0;
      const totalAnswers = userAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
      const readCount = Math.min(userReads.size, totalSectionsCount);
      const lastActivity = userAttempts.length > 0 
        ? userAttempts[userAttempts.length - 1].date 
        : null;

      return {
        _id: u._id,
        id: uid,
        email: u.email || u.username,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        roleKeys: u.roleKeys || [],
        departments: u.departments || [],
        departmentId: u.departmentId,
        managerId: u.managerId,
        allowedInstructionIds: u.allowedInstructionIds || [],
        createdAt: u.createdAt,
        employeeInfo: ack ? {
          fullName: ack.fullName,
          position: ack.position,
          department: ack.department,
          signedDate: ack.signedDate,
          isSigned: ack.isSigned
        } : null,
        stats: {
          readCount,
          testsCount: userAttempts.length,
          bestScore,
          certificatesCount: userCerts.length,
          totalQuestionsAnswered: totalAnswers,
          lastActivity
        }
      };
    });
  }

  // ==========================================
  // Крок 7. Рушій призначень (Assignment Engine)
  // ==========================================

  /**
   * Automatically synchronizes assignment completion when employee completes reading or passes quiz
   */
  static async syncAssignmentCompletion(
    userId: mongoose.Types.ObjectId,
    targetType: 'course' | 'instruction',
    targetId: string,
    score?: number
  ) {
    try {
      await LearningAssignment.updateMany(
        {
          userId,
          targetType,
          targetId,
          status: { $in: ['assigned', 'in_progress', 'overdue'] }
        },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            ...(score !== undefined ? { score } : {})
          }
        }
      );

      // Онбординг використовує ті самі матеріали — крок «прочитати інструкцію»
      // має закритись тим самим читанням, а не окремою відміткою.
      await OnboardingService.syncFromLearning(userId, targetType, targetId, score);
    } catch (err) {
      console.error('Failed to sync assignment completion:', err);
    }
  }

  /**
   * Create assignment (single user, multiple users, department, or all)
   */
  static async createAssignment(data: {
    assignedBy: string | mongoose.Types.ObjectId;
    assignedByName?: string;
    targetType: 'course' | 'instruction';
    targetId: string;
    title: string;
    targetScope: 'single' | 'multiple' | 'department' | 'all';
    userId?: string;
    userIds?: string[];
    department?: string;
    dueDate: Date | string;
    priority?: 'recommended' | 'mandatory' | 'critical';
    notes?: string;
  }) {
    let targetUserIds: mongoose.Types.ObjectId[] = [];
    if (data.targetScope === 'single' && data.userId) {
      targetUserIds = [new mongoose.Types.ObjectId(data.userId)];
    } else if (data.targetScope === 'multiple' && Array.isArray(data.userIds)) {
      targetUserIds = data.userIds.map(id => new mongoose.Types.ObjectId(id));
    } else if (data.targetScope === 'department' && data.department) {
      const deptUsers = await User.find({
        $or: [
          { departmentId: data.department },
          { departments: data.department }
        ]
      }, { _id: 1 });
      targetUserIds = deptUsers.map(u => u._id);
    } else if (data.targetScope === 'all') {
      const allUsers = await User.find({ isBlocked: { $ne: true } }, { _id: 1 });
      targetUserIds = allUsers.map(u => u._id);
    }

    if (targetUserIds.length === 0) {
      throw new Error('Не знайдено співробітників для призначення');
    }

    const assignedByObjId = typeof data.assignedBy === 'string' ? new mongoose.Types.ObjectId(data.assignedBy) : data.assignedBy;
    const dueDate = new Date(data.dueDate);
    const priority = data.priority || 'mandatory';
    const notes = data.notes || '';

    const createdAssignments = [];
    const formattedDue = dueDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

    for (const uid of targetUserIds) {
      // Check if user already completed this course or instruction
      let isAlreadyCompleted = false;
      let existingScore: number | undefined = undefined;
      if (data.targetType === 'course') {
        const cert = await CertificateRecord.findOne({ userId: uid, courseId: data.targetId, status: 'active' });
        const passedQuiz = await QuizAttempt.findOne({ userId: uid, courseId: data.targetId, passed: true }).sort({ percentage: -1 });
        isAlreadyCompleted = !!(cert || passedQuiz);
        if (passedQuiz) existingScore = passedQuiz.percentage;
      } else {
        const read = await ReadingProgress.findOne({ userId: uid, sectionId: data.targetId });
        isAlreadyCompleted = !!read;
      }

      const status = isAlreadyCompleted ? 'completed' : 'assigned';
      const user = await User.findById(uid, { departmentId: 1, departments: 1 });
      const dept = user?.departmentId || (user?.departments && user.departments[0]) || '';

      const assignment = await LearningAssignment.findOneAndUpdate(
        { userId: uid, targetType: data.targetType, targetId: data.targetId },
        {
          $set: {
            title: data.title,
            department: dept,
            assignedBy: assignedByObjId,
            assignedByName: data.assignedByName || 'Керівник',
            assignedDate: new Date(),
            dueDate,
            priority,
            status,
            completedAt: isAlreadyCompleted ? new Date() : undefined,
            score: existingScore,
            notes
          }
        },
        { upsert: true, new: true }
      );

      createdAssignments.push(assignment);

      await NotificationService.send({
        userId: uid,
        type: 'assignment_new',
        payload: {
          title: data.title,
          dueDate: formattedDue,
          notesLine: notes ? ` Вказівка керівника: ${notes}` : ''
        },
        // A recommended-priority assignment is still non-critical for notification
        // purposes; only mandatory/critical assignments escalate on overdue (see scheduler.ts).
      });
    }

    return createdAssignments;
  }

  /**
   * Get assignments for a single employee (their personalized view)
   */
  static async getUserAssignments(userId: string | mongoose.Types.ObjectId) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const assignments = await LearningAssignment.find({ userId: userObjectId }).sort({ dueDate: 1 });
    const now = new Date();

    const result = [];
    for (const a of assignments) {
      let status = a.status;
      if (status !== 'completed' && a.dueDate < now) {
        status = 'overdue';
        if (a.status !== 'overdue') {
          a.status = 'overdue';
          await a.save();
        }
      }

      const diffTime = a.dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      result.push({
        _id: a._id.toString(),
        id: a._id.toString(),
        userId: a.userId.toString(),
        targetType: a.targetType,
        targetId: a.targetId,
        title: a.title,
        department: a.department,
        assignedBy: a.assignedBy?.toString(),
        assignedByName: a.assignedByName,
        assignedDate: a.assignedDate.toISOString(),
        dueDate: a.dueDate.toISOString(),
        priority: a.priority,
        status,
        completedAt: a.completedAt?.toISOString(),
        score: a.score,
        notes: a.notes,
        daysRemaining,
        isOverdue: status === 'overdue' || (status !== 'completed' && daysRemaining < 0)
      });
    }
    return result;
  }

  /**
   * Get assignments management report (for Managers & Admins with scoping)
   */
  static async getAssignmentsReport(userFilter: any = {}) {
    const targetUsers = await User.find(userFilter, { _id: 1, fullName: 1, email: 1, username: 1, departmentId: 1, departments: 1 });
    const userMap = new Map(targetUsers.map(u => [u._id.toString(), u]));
    const targetUserIds = targetUsers.map(u => u._id);

    // Крок 14: generous safety cap — assignments scale with users × courses, the
    // single most likely list in the app to exceed a few thousand rows.
    const assignments = await LearningAssignment.find({ userId: { $in: targetUserIds } }).sort({ dueDate: 1, createdAt: -1 }).limit(5000);
    const now = new Date();

    let total = assignments.length;
    let completed = 0;
    let inProgress = 0;
    let assigned = 0;
    let overdue = 0;

    const items = [];
    for (const a of assignments) {
      let status = a.status;
      if (status !== 'completed' && a.dueDate < now) {
        status = 'overdue';
        if (a.status !== 'overdue') {
          a.status = 'overdue';
          await a.save();
        }
      }

      if (status === 'completed') completed++;
      else if (status === 'in_progress') inProgress++;
      else if (status === 'overdue') overdue++;
      else assigned++;

      const diffTime = a.dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const u = userMap.get(a.userId.toString());

      items.push({
        _id: a._id.toString(),
        id: a._id.toString(),
        userId: a.userId.toString(),
        user: u ? {
          _id: u._id.toString(),
          username: u.username,
          fullName: u.fullName || u.username,
          email: u.email || u.username,
          department: u.departmentId || (u.departments && u.departments[0]) || 'Загальний'
        } : undefined,
        targetType: a.targetType,
        targetId: a.targetId,
        title: a.title,
        department: a.department || (u?.departmentId || (u?.departments && u.departments[0]) || ''),
        assignedBy: a.assignedBy?.toString(),
        assignedByName: a.assignedByName,
        assignedDate: a.assignedDate.toISOString(),
        dueDate: a.dueDate.toISOString(),
        priority: a.priority,
        status,
        completedAt: a.completedAt?.toISOString(),
        score: a.score,
        notes: a.notes,
        daysRemaining,
        isOverdue: status === 'overdue' || (status !== 'completed' && daysRemaining < 0)
      });
    }

    const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 100;

    return {
      stats: {
        total,
        completed,
        inProgress,
        assigned,
        overdue,
        complianceRate
      },
      assignments: items
    };
  }

  /**
   * Remind user about approaching or overdue deadline
   */
  static async remindAssignment(assignmentId: string, senderName?: string) {
    const assignment = await LearningAssignment.findById(assignmentId);
    if (!assignment) throw new Error('Призначення не знайдено');

    const formattedDue = assignment.dueDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await NotificationService.send({
      userId: assignment.userId,
      type: 'assignment_reminder',
      payload: {
        title: assignment.title,
        dueDate: formattedDue,
        senderLine: senderName ? ` від ${senderName}` : ''
      }
    });
    return { success: true };
  }

  /**
   * Update assignment details (due date, priority, status, notes)
   */
  static async updateAssignment(assignmentId: string, data: { dueDate?: string | Date; priority?: string; notes?: string; status?: string }) {
    const assignment = await LearningAssignment.findById(assignmentId);
    if (!assignment) throw new Error('Призначення не знайдено');

    if (data.dueDate) {
      assignment.dueDate = new Date(data.dueDate);
      if (assignment.status === 'overdue' && assignment.dueDate > new Date()) {
        assignment.status = 'assigned';
      }
      // Deadline moved — let the scheduler re-evaluate and notify again if needed.
      assignment.deadlineReminderSentAt = undefined;
      assignment.overdueNotifiedAt = undefined;
    }
    if (data.priority) assignment.priority = data.priority as any;
    if (data.notes !== undefined) assignment.notes = data.notes;
    if (data.status) assignment.status = data.status as any;

    await assignment.save();
    return assignment;
  }

  /**
   * Delete an assignment
   */
  static async deleteAssignment(assignmentId: string) {
    await LearningAssignment.findByIdAndDelete(assignmentId);
    return { success: true };
  }
}
