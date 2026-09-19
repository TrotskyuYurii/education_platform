import mongoose from 'mongoose';
import { User, Progress } from '../../models.js';
import { LearningNotification } from '../learning/models.js';
import { queueEmail } from '../../email.js';
import {
  NotificationTemplate,
  UserNotificationSettings,
  NotificationOutbox,
  NotificationType
} from './models.js';

const renderTemplate = (template: string, payload: Record<string, any>): string =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (payload[key] !== undefined ? String(payload[key]) : ''));

interface SendNotificationInput {
  userId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  payload?: Record<string, any>;
  // Escalates a normally non-critical type to critical for this one send —
  // e.g. an overdue assignment on mandatory/critical content (see learning/service.ts).
  forceCritical?: boolean;
}

export const NotificationService = {
  async send({ userId, type, payload = {}, forceCritical }: SendNotificationInput) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const template = await NotificationTemplate.findOne({ type });
    if (!template) {
      // Missing template = misconfiguration, not a reason to break the caller's flow.
      console.error(`⚠️ No NotificationTemplate found for type '${type}', skipping notification`);
      return { notificationId: null };
    }

    const title = renderTemplate(template.titleTemplate, payload);
    const message = renderTemplate(template.bodyTemplate, payload);
    const isCritical = Boolean(template.isCritical || forceCritical);
    const notificationId = `notif-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await LearningNotification.create({
      userId: userObjectId,
      notificationId,
      title,
      message,
      type,
      isCritical,
      read: false,
      date: new Date()
    });

    // Keep the legacy embedded array in sync so old code paths (the pre-Крок-3
    // Progress.notifications reads) keep seeing every notification, old and new.
    await Progress.updateOne(
      { userId: userObjectId },
      { $push: { notifications: { id: notificationId, message, date: new Date(), read: false } } },
      { upsert: true }
    );

    const channels = template.defaultChannels || ['in_app'];
    if (channels.includes('email')) {
      await this.dispatchEmail(userObjectId, { notificationId, type, title, message, isCritical });
    }

    return { notificationId };
  },

  // Critical notifications email immediately; everything else queues into the
  // outbox and goes out as part of the next daily digest (see scheduler.ts).
  async dispatchEmail(
    userId: mongoose.Types.ObjectId,
    entry: { notificationId: string; type: string; title: string; message: string; isCritical: boolean }
  ) {
    const settings = await UserNotificationSettings.findOne({ userId });
    if (!entry.isCritical && settings?.disabledEmailTypes?.includes(entry.type)) {
      return; // user opted out of email for this (non-critical) type
    }

    if (entry.isCritical) {
      const user = await User.findById(userId).select('email fullName');
      if (!user?.email) return;
      // Start the send now, but do NOT await it: an SMTP handshake takes seconds
      // (and much longer when the mail server misbehaves), while send() is called
      // from inside request handlers — e.g. assigning an onboarding, which fires
      // one critical notification per target user. Awaiting here made the API look
      // frozen even though every record had already been written. queueEmail
      // returns synchronously and swallows every failure (see server/email.ts:
      // circuit breaker + concurrency limit), so neither a dead mail server nor a
      // burst of recipients can slow the request down or leak sockets.
      queueEmail(
        user.email,
        entry.title,
        `<p>${entry.message}</p>`,
        entry.message
      );
      return;
    }

    await NotificationOutbox.create({
      userId,
      notificationId: entry.notificationId,
      type: entry.type,
      title: entry.title,
      message: entry.message
    });
  },

  async getSettings(userId: string | mongoose.Types.ObjectId) {
    const [settings, templates] = await Promise.all([
      UserNotificationSettings.findOne({ userId }),
      NotificationTemplate.find({}).select('type title isCritical defaultChannels').sort({ title: 1 })
    ]);
    return {
      disabledEmailTypes: settings?.disabledEmailTypes || [],
      // Read-only labels so the self-service settings UI doesn't need admin
      // rights just to know what each notification type is called.
      availableTypes: templates
        .filter(t => (t.defaultChannels || []).includes('email'))
        .map(t => ({ type: t.type, title: t.title, isCritical: t.isCritical }))
    };
  },

  async updateSettings(userId: string | mongoose.Types.ObjectId, disabledEmailTypes: string[]) {
    // Critical types can never be muted, regardless of what the client sends.
    const criticalTypes = await NotificationTemplate.find({ isCritical: true }).select('type');
    const criticalSet = new Set(criticalTypes.map(t => t.type));
    const sanitized = disabledEmailTypes.filter(t => !criticalSet.has(t));

    await UserNotificationSettings.findOneAndUpdate(
      { userId },
      { $set: { disabledEmailTypes: sanitized } },
      { upsert: true }
    );
    return { disabledEmailTypes: sanitized };
  }
};
