import mongoose from 'mongoose';

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

// Every notification type the system currently knows how to trigger.
// 'new_mandatory_regulation' from the original Крок 11 spec is intentionally
// NOT included — it depends on the acknowledgement-campaign model from
// Крок 6, which was never built (see Крок 11 plan notes).
export const NOTIFICATION_TYPES = [
  'assignment_new',
  'assignment_reminder',
  'assignment_overdue',
  'course_completed',
  'certificate_issued',
  'certificate_expiring',
  'certificate_revoked',
  'acknowledgement_confirmed'
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

const notificationTemplateSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true, enum: NOTIFICATION_TYPES },
  title: { type: String, required: true }, // admin-facing label, e.g. "Призначено навчання"
  titleTemplate: { type: String, required: true }, // rendered as the notification's short title
  bodyTemplate: { type: String, required: true }, // rendered as the notification's message; supports {{var}}
  defaultChannels: { type: [String], enum: NOTIFICATION_CHANNELS, default: ['in_app'] },
  isCritical: { type: Boolean, default: false }, // critical types can't be muted and skip the digest queue
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

const userNotificationSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  disabledEmailTypes: { type: [String], enum: NOTIFICATION_TYPES, default: [] },
  lastDigestSentAt: { type: Date }
});

// One row per queued, not-yet-emailed notification. The daily digest job
// batches everything still pending for a user into a single email.
const notificationOutboxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  notificationId: { type: String, required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  sentAt: { type: Date, default: null, index: true }
});

// Tracks which daily jobs already ran today so the in-process scheduler
// stays idempotent across restarts (see scheduler.ts).
const schedulerRunSchema = new mongoose.Schema({
  jobName: { type: String, required: true },
  ranOnDate: { type: String, required: true } // YYYY-MM-DD, server-local date
});
schedulerRunSchema.index({ jobName: 1, ranOnDate: 1 }, { unique: true });

export const NotificationTemplate = mongoose.models.NotificationTemplate
  || mongoose.model('NotificationTemplate', notificationTemplateSchema);
export const UserNotificationSettings = mongoose.models.UserNotificationSettings
  || mongoose.model('UserNotificationSettings', userNotificationSettingsSchema);
export const NotificationOutbox = mongoose.models.NotificationOutbox
  || mongoose.model('NotificationOutbox', notificationOutboxSchema);
export const SchedulerRun = mongoose.models.SchedulerRun
  || mongoose.model('SchedulerRun', schedulerRunSchema);
