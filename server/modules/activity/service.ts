import mongoose from 'mongoose';
import { logger } from '../core/logger.js';
import { UserActivity, ActivityType, ACTIVITY_TYPES } from './models.js';

export interface RecordActivityInput {
  type: ActivityType;
  user?: { _id?: any; fullName?: string; email?: string; username?: string } | null;
  /** Для подій без користувача (невдалий вхід) — що саме вводили. */
  userLabel?: string;
  page?: string;
  title?: string;
  details?: Record<string, any>;
  /** Звідки взяти IP і браузер. */
  req?: { ip?: string; headers?: Record<string, any> };
}

const labelOf = (user: RecordActivityInput['user']): string | undefined =>
  user ? (user.fullName || user.email || user.username || undefined) : undefined;

/** Початок доби для дати 'YYYY-MM-DD' у локальному часі сервера. */
const parseDay = (value?: string, endOfDay = false): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setDate(date.getDate() + 1);
  return date;
};

export const ActivityService = {
  /**
   * Пише подію в журнал дій.
   *
   * Контракт той самий, що й у SystemLogService.record: ніколи не кидає і не
   * ламає потік, у якому сталася подія, — вхід не має падати через журнал.
   */
  async record(input: RecordActivityInput): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) return;
      const userAgent = input.req?.headers?.['user-agent'];
      await UserActivity.create({
        userId: input.user?._id || undefined,
        userLabel: input.userLabel || labelOf(input.user),
        type: input.type,
        page: input.page,
        title: input.title,
        details: input.details,
        ip: input.req?.ip,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : undefined
      });
    } catch (err) {
      logger.error({ err, type: input.type }, 'Failed to write user activity entry');
    }
  },

  /** Fire-and-forget: не чекаємо на запис, щоб не затримувати відповідь. */
  capture(input: RecordActivityInput): void {
    void this.record(input);
  },

  async list(params: {
    userId?: string;
    type?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));

    const filter: Record<string, any> = {};
    if (params.userId && mongoose.isValidObjectId(params.userId)) filter.userId = params.userId;
    if (params.type && params.type !== 'all') {
      // Зведені групи для фільтра «Входи/виходи» — окремі коди в UI дрібні.
      filter.type = params.type === 'auth'
        ? { $in: ['LOGIN', 'LOGIN_FAILED', 'OTP_SENT', 'LOGOUT', 'SESSION_EXPIRED'] }
        : (ACTIVITY_TYPES as readonly string[]).includes(params.type) ? params.type : '__none__';
    }
    const from = parseDay(params.from);
    const to = parseDay(params.to, true);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lt = to;
    }
    if (params.search) {
      // Рядок від клієнта не має ставати керуючою конструкцією регулярного виразу.
      const safe = params.search.trim().replace(/[^\p{L}\p{N}\s@._-]/gu, '');
      if (safe) {
        const rx = new RegExp(safe, 'i');
        filter.$or = [{ userLabel: rx }, { title: rx }, { page: rx }, { ip: rx }];
      }
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [items, total, users, eventsToday, loginsToday, activeUsersToday] = await Promise.all([
      UserActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserActivity.countDocuments(filter),
      // Список людей для фільтра — лише ті, хто має записи в журналі.
      UserActivity.aggregate([
        { $match: { userId: { $ne: null } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$userId', label: { $first: '$userLabel' }, lastSeenAt: { $first: '$createdAt' } } },
        { $sort: { label: 1 } },
        { $limit: 2000 }
      ]),
      UserActivity.countDocuments({ createdAt: { $gte: startOfToday } }),
      UserActivity.countDocuments({ type: 'LOGIN', createdAt: { $gte: startOfToday } }),
      UserActivity.distinct('userId', { createdAt: { $gte: startOfToday }, userId: { $ne: null } })
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      users: users.map((u: any) => ({ id: String(u._id), label: u.label || 'Без імені', lastSeenAt: u.lastSeenAt })),
      stats: { eventsToday, loginsToday, activeUsersToday: activeUsersToday.length }
    };
  }
};
