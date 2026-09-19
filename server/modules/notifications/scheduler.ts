import { User } from '../../models.js';
import { CertificateRecord, LearningAssignment } from '../learning/models.js';
import { sendEmail, isEmailCircuitOpen } from '../../email.js';
import { NotificationOutbox, UserNotificationSettings, SchedulerRun } from './models.js';
import { NotificationService } from './service.js';
import { OnboardingService } from '../onboarding/service.js';

const JOB_NAME = 'daily-notifications';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const RUN_AFTER_HOUR = 7; // server-local hour, matches the "щоденно о 07:00" spec intent

const todayDateString = (): string => new Date().toISOString().slice(0, 10);

const hasRunToday = async (): Promise<boolean> =>
  Boolean(await SchedulerRun.findOne({ jobName: JOB_NAME, ranOnDate: todayDateString() }));

const markRunToday = async (): Promise<void> => {
  await SchedulerRun.create({ jobName: JOB_NAME, ranOnDate: todayDateString() });
};

async function notifyExpiringCertificates() {
  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const certs = await CertificateRecord.find({
    status: 'active',
    expiresAt: { $gte: now, $lte: in30Days },
    expiryNotifiedAt: { $exists: false }
  });

  for (const cert of certs) {
    try {
      const daysLeft = Math.max(0, Math.ceil((cert.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      await NotificationService.send({
        userId: cert.userId,
        type: 'certificate_expiring',
        payload: { courseTitle: cert.courseTitle, daysLeft }
      });
      cert.expiryNotifiedAt = now;
      await cert.save();
    } catch (err) {
      console.error(`Failed to notify expiring certificate ${cert._id}:`, err);
    }
  }
}

async function notifyUpcomingDeadlines() {
  const now = new Date();
  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);

  const assignments = await LearningAssignment.find({
    status: { $in: ['assigned', 'in_progress'] },
    dueDate: { $gte: now, $lte: in3Days },
    deadlineReminderSentAt: { $exists: false }
  });

  for (const a of assignments) {
    try {
      await NotificationService.send({
        userId: a.userId,
        type: 'assignment_reminder',
        payload: { title: a.title, dueDate: a.dueDate.toLocaleDateString('uk-UA') }
      });
      a.deadlineReminderSentAt = now;
      await a.save();
    } catch (err) {
      console.error(`Failed to send deadline reminder for assignment ${a._id}:`, err);
    }
  }
}

async function notifyOverdueAssignments() {
  const now = new Date();

  // NOTE: status may already be 'overdue' here — getUserAssignments/getAssignmentsReport
  // lazily flip it to 'overdue' on read, which can race ahead of this job. Match on
  // overdueNotifiedAt (not status) so an assignment flipped by that lazy path still gets notified.
  const assignments = await LearningAssignment.find({
    status: { $ne: 'completed' },
    dueDate: { $lt: now },
    overdueNotifiedAt: { $exists: false }
  });

  for (const a of assignments) {
    try {
      // "Прострочення обов'язкового регламенту" from the Крок 11 spec maps onto an
      // overdue assignment whose priority is mandatory/critical — treat those as
      // critical (immediate email, can't be muted) rather than digested.
      const isMandatory = a.priority === 'mandatory' || a.priority === 'critical';
      a.status = 'overdue';
      await NotificationService.send({
        userId: a.userId,
        type: 'assignment_overdue',
        payload: { title: a.title },
        forceCritical: isMandatory
      });
      a.overdueNotifiedAt = now;
      await a.save();
    } catch (err) {
      console.error(`Failed to send overdue notification for assignment ${a._id}:`, err);
    }
  }
}

async function flushDigestEmails() {
  const pending = await NotificationOutbox.find({ sentAt: null });
  if (pending.length === 0) return;

  const byUser = new Map<string, typeof pending>();
  for (const item of pending) {
    const key = item.userId.toString();
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(item);
  }

  for (const [userId, items] of byUser) {
    try {
      const user = await User.findById(userId).select('email');
      if (user?.email) {
        const html = `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color:#1e3a8a;">ВІАТЕК: підсумок сповіщень за день</h2>
            <ul style="padding-left: 18px;">
              ${items.map(i => `<li style="margin-bottom:10px;"><strong>${i.title}</strong><br/>${i.message}</li>`).join('')}
            </ul>
          </div>
        `;
        const result = await sendEmail(user.email, `ВІАТЕК: ${items.length} нових сповіщень`, html);
        if (!result.success) {
          // Раніше записи позначалися як відправлені навіть після збою (sendEmail не кидає
          // винятків), і дайджест тихо зникав. Залишаємо їх у outbox до наступного прогону.
          console.warn(`✉️ Digest for user ${userId} not delivered (${result.error}), залишаємо в черзі`);
          if (isEmailCircuitOpen()) {
            // SMTP лежить — немає сенсу проганяти решту користувачів по таймаутах.
            console.warn('✉️ SMTP недоступний — решту дайджестів відкладено до наступного прогону');
            break;
          }
          continue;
        }
      }
      await NotificationOutbox.updateMany(
        { _id: { $in: items.map(i => i._id) } },
        { $set: { sentAt: new Date() } }
      );
      await UserNotificationSettings.findOneAndUpdate(
        { userId },
        { $set: { lastDigestSentAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Failed to send digest email for user ${userId}:`, err);
    }
  }
}

// Збій онбордінгового блоку не має заблокувати розсилку дайджесту,
// тому він ізольований власним try/catch.
async function runOnboardingJobSafely() {
  try {
    await OnboardingService.runDailyJob();
  } catch (err) {
    console.error('Onboarding daily job failed:', err);
  }
}

export async function runDailyNotificationJob() {
  console.log('🔔 Running daily notification job...');
  await notifyExpiringCertificates();
  await notifyUpcomingDeadlines();
  await notifyOverdueAssignments();
  // Онбординг має власні дедлайни (дедлайни кроків, прострочення, опитування
  // на 7/30/90 день) — вони їдуть тим самим щоденним прогоном.
  await runOnboardingJobSafely();
  await flushDigestEmails();
  console.log('🔔 Daily notification job completed.');
}

let isRunning = false;

export function startNotificationScheduler() {
  const tick = async () => {
    if (isRunning) return;
    if (new Date().getHours() < RUN_AFTER_HOUR) return;
    if (await hasRunToday().catch(() => true)) return; // fail-safe: assume ran if DB check fails

    isRunning = true;
    try {
      await runDailyNotificationJob();
      await markRunToday();
    } catch (err) {
      console.error('Daily notification job failed, will retry on next tick:', err);
    } finally {
      isRunning = false;
    }
  };

  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
