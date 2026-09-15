import mongoose from 'mongoose';
import { User, Section, Course, Progress } from '../../models.js';
import { 
  ReadingProgress, 
  QuizAttempt, 
  CertificateRecord, 
  Acknowledgment, 
  LearningNotification 
} from './models.js';

export class ProgressService {
  /**
   * One-way or two-way migration sync: if user has records in monolithic Progress,
   * ensure they exist in granular collections without duplicating.
   */
  static async syncFromLegacy(userId: string | mongoose.Types.ObjectId): Promise<void> {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const legacy = await Progress.findOne({ userId: userObjectId });
    if (!legacy) return;

    // 1. Sync read sections
    if (Array.isArray(legacy.readSectionIds) && legacy.readSectionIds.length > 0) {
      for (const sId of legacy.readSectionIds) {
        if (!sId) continue;
        await ReadingProgress.updateOne(
          { userId: userObjectId, sectionId: sId },
          { $setOnInsert: { userId: userObjectId, sectionId: sId, completedAt: legacy.updatedAt || new Date() } },
          { upsert: true }
        );
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
        await CertificateRecord.updateOne(
          { userId: userObjectId, courseId: c.courseId, status: 'active' },
          {
            $setOnInsert: {
              userId: userObjectId,
              courseId: c.courseId,
              courseTitle: c.courseTitle || 'Курс',
              issuedAt: c.issuedAt ? new Date(c.issuedAt) : new Date(),
              expiresAt: c.expiresAt ? new Date(c.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: 'active'
            }
          },
          { upsert: true }
        );
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
        await LearningNotification.updateOne(
          { userId: userObjectId, notificationId: n.id },
          {
            $setOnInsert: {
              userId: userObjectId,
              notificationId: n.id,
              message: n.message || '',
              read: !!n.read,
              date: n.date ? new Date(n.date) : new Date()
            }
          },
          { upsert: true }
        );
      }
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

    const [currentSections, reads, attempts, certs, ack, notifs] = await Promise.all([
      Section.find({} as any, { id: 1 } as any),
      ReadingProgress.find({ userId: userObjectId }),
      QuizAttempt.find({ userId: userObjectId }).sort({ date: 1 }),
      CertificateRecord.find({ userId: userObjectId, status: 'active' }).sort({ issuedAt: -1 }),
      Acknowledgment.findOne({ userId: userObjectId }),
      LearningNotification.find({ userId: userObjectId }).sort({ date: -1 })
    ]);

    const validSectionIds = new Set(currentSections.map(s => s.id));
    const validReadIds = reads
      .map(r => r.sectionId)
      .filter(id => validSectionIds.has(id));

    const bestScore = attempts.length > 0 
      ? Math.max(...attempts.map(a => a.percentage || 0)) 
      : 0;
    const totalAnswers = attempts.reduce((sum, a) => sum + (a.total || 0), 0);

      const attemptsList = attempts.map(a => ({
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
          isSigned: ack.isSigned
        } : {
          fullName: '',
          position: '',
          department: '',
          signedDate: '',
          isSigned: false
        },
        quizHistory: attemptsList,
        testScores: attemptsList,
        certificates: certs.map(c => ({
          courseId: c.courseId,
          courseTitle: c.courseTitle,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt.toISOString()
        })),
        notifications: notifs.map(n => ({
          id: n.notificationId,
          message: n.message,
        date: n.date.toISOString(),
        read: n.read
      }))
    };
  }

  /**
   * Save read sections
   */
  static async saveReadSections(userId: string | mongoose.Types.ObjectId, rawSectionIds: string[]) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    
    // Filter against real sections
    const currentSections = await Section.find({} as any, { id: 1 } as any);
    const validSectionIds = new Set(currentSections.map(s => s.id));
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

    // Check certificate issuance
    if (testScore.courseId && testScore.percentage >= 80) {
      const course = await Course.findOne({ id: testScore.courseId } as any);
      if (course && course.hasCertificate) {
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

    const ack = await Acknowledgment.findOneAndUpdate(
      { userId: userObjectId },
      {
        $set: {
          fullName: employeeInfo.fullName || '',
          position: employeeInfo.position || '',
          department: employeeInfo.department || '',
          signedDate: employeeInfo.signedDate || '',
          isSigned: !!employeeInfo.isSigned,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

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

    // Create notification
    const notifId = Math.random().toString(36).substring(7);
    const courseTitle = cert?.courseTitle || 'Курс';
    await LearningNotification.create({
      userId: userObjectId,
      notificationId: notifId,
      message: `Ваш сертифікат за курс «${courseTitle}» був анульований адміністратором.`,
      type: 'certificate_revoked',
      read: false,
      date: new Date()
    });

    // Update legacy progress
    const legacy = await Progress.findOne({ userId: userObjectId });
    if (legacy) {
      const idx = legacy.certificates.findIndex((c: any) => c.courseId === courseId);
      if (idx !== -1) {
        legacy.certificates.splice(idx, 1);
      }
      legacy.notifications.push({
        id: notifId,
        message: `Ваш сертифікат за курс «${courseTitle}» був анульований адміністратором.`,
        date: new Date(),
        read: false
      });
      await legacy.save();
    }

    return { success: true, notificationId: notifId };
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
  static async getUsersProgressReport(userFilter: any) {
    const currentSections = await Section.find({} as any, { id: 1 } as any);
    const validSectionIds = new Set(currentSections.map(s => s.id));
    const totalSectionsCount = currentSections.length;

    const users = await User.find(userFilter)
      .select('-passwordHash -authCode')
      .populate('departmentId', 'name')
      .populate('managerId', 'fullName email username')
      .sort({ createdAt: -1 });

    const userIds = users.map(u => u._id);

    // Sync from legacy for each user in list to ensure up-to-date data
    await Promise.all(userIds.map(id => this.syncFromLegacy(id)));

    // Fetch granular data in parallel
    const [allReads, allAttempts, allCerts, allAcks] = await Promise.all([
      ReadingProgress.find({ userId: { $in: userIds } }),
      QuizAttempt.find({ userId: { $in: userIds } }).sort({ date: 1 }),
      CertificateRecord.find({ userId: { $in: userIds }, status: 'active' }),
      Acknowledgment.find({ userId: { $in: userIds } })
    ]);

    // Group by userId
    const readsMap = new Map<string, Set<string>>();
    allReads.forEach(r => {
      const uid = r.userId.toString();
      if (!readsMap.has(uid)) readsMap.set(uid, new Set());
      if (validSectionIds.has(r.sectionId)) {
        readsMap.get(uid)!.add(r.sectionId);
      }
    });

    const attemptsMap = new Map<string, any[]>();
    allAttempts.forEach(a => {
      const uid = a.userId.toString();
      if (!attemptsMap.has(uid)) attemptsMap.set(uid, []);
      attemptsMap.get(uid)!.push(a);
    });

    const certsMap = new Map<string, any[]>();
    allCerts.forEach(c => {
      const uid = c.userId.toString();
      if (!certsMap.has(uid)) certsMap.set(uid, []);
      certsMap.get(uid)!.push(c);
    });

    const acksMap = new Map<string, any>();
    allAcks.forEach(ack => {
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
}
