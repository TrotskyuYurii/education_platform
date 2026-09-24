import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import type { Writable } from 'stream';
import { logger } from '../core/logger.js';
import { User } from '../../models.js';
import { UserActivity, ActivityType, ACTIVITY_TYPES } from './models.js';
import { ACTIVITY_TYPE_LABELS, activityPageLabel, describeActivity, shortUserAgent } from '../../../shared/activityLabels.js';

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

export interface ActivityFilterParams {
  userId?: string;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
}

/** Максимум рядків у файлі: більше Excel відкриває повільно, а людина однаково не прочитає. */
export const ACTIVITY_EXPORT_MAX_ROWS = 200_000;

/**
 * Часовий пояс, у якому адміністратор думає про «день». Сервер може працювати
 * в UTC, тож межі періоду й час у файлі рахуємо явно в цьому поясі — інакше
 * «сьогодні» зсувалося б на 2–3 години.
 */
const ACTIVITY_TIMEZONE = process.env.ACTIVITY_LOG_TIMEZONE || 'Europe/Kyiv';

const tzFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ACTIVITY_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

/** Годинник у поясі журналу, записаний як UTC-мітка («настінний» час). */
const wallClockMs = (instant: Date): number => {
  const parts: Record<string, number> = {};
  for (const p of tzFormatter.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

/** Північ дати 'YYYY-MM-DD' у поясі журналу як реальна мить. */
const parseDay = (value?: string, nextDay = false): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d + (nextDay ? 1 : 0));
  if (Number.isNaN(target)) return null;
  // Два кроки наближення: зсув поясу залежить від самої миті (перехід на літній час).
  let instant = target - (wallClockMs(new Date(target)) - target);
  instant = target - (wallClockMs(new Date(instant)) - instant);
  return new Date(instant);
};

const startOfTodayInZone = (): Date => {
  const wall = new Date(wallClockMs(new Date()));
  return parseDay(wall.toISOString().slice(0, 10))!;
};

const labelOf = (user: RecordActivityInput['user']): string | undefined =>
  user ? (user.fullName || user.email || user.username || undefined) : undefined;

const buildFilter = (params: ActivityFilterParams): Record<string, any> => {
  const filter: Record<string, any> = {};
  if (params.userId && mongoose.isValidObjectId(params.userId)) filter.userId = params.userId;
  if (params.type && params.type !== 'all') {
    // Зведена група для фільтра «Входи та виходи» — окремі коди в UI дрібні.
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
  return filter;
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

  async list(params: ActivityFilterParams & { page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));
    const filter = buildFilter(params);
    const startOfToday = startOfTodayInZone();

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
  },

  countForExport(params: ActivityFilterParams): Promise<number> {
    return UserActivity.countDocuments(buildFilter(params));
  },

  /**
   * Пише вибірку журналу в Excel прямо у потік відповіді.
   *
   * Потоковий запис із курсором, а не «зібрати масив і віддати буфер»: вибірка
   * за місяць для всієї компанії — десятки тисяч рядків, і тримати їх разом із
   * готовою книгою в пам'яті сервера немає потреби.
   */
  async writeXlsx(params: ActivityFilterParams, output: Writable): Promise<void> {
    const filter = buildFilter(params);

    // Email — окремою колонкою: у журналі зберігається лише ім'я на момент події.
    const userIds = await UserActivity.distinct('userId', { ...filter, userId: { $ne: null } });
    const people = await User.find({ _id: { $in: userIds } } as any).select('email username').lean();
    const emailById = new Map((people as any[]).map(u => [String(u._id), u.email || u.username || '']));

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true });
    const sheet = workbook.addWorksheet('Журнал дій', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Дата і час', key: 'at', width: 20, style: { numFmt: 'dd.mm.yyyy hh:mm:ss' } },
      { header: 'Користувач', key: 'user', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Подія', key: 'type', width: 24 },
      { header: 'Розділ', key: 'page', width: 34 },
      { header: 'Опис', key: 'description', width: 60 },
      { header: 'IP-адреса', key: 'ip', width: 18 },
      { header: 'Браузер', key: 'browser', width: 18 },
      { header: 'Деталі', key: 'details', width: 40 }
    ];
    sheet.autoFilter = { from: 'A1', to: 'I1' };
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.commit();

    const cursor = UserActivity.find(filter)
      .sort({ createdAt: 1 })
      .limit(ACTIVITY_EXPORT_MAX_ROWS)
      .lean()
      .cursor();

    for await (const item of cursor as AsyncIterable<any>) {
      sheet.addRow({
        // Excel не знає поясів: пишемо «настінний» київський час, щоб у файлі
        // стояло те саме, що адміністратор бачив на екрані.
        at: new Date(wallClockMs(new Date(item.createdAt))),
        user: item.userLabel || (item.userId ? 'Без імені' : 'Невідомий'),
        email: item.userId ? emailById.get(String(item.userId)) || '' : '',
        type: ACTIVITY_TYPE_LABELS[item.type] || item.type,
        page: item.page ? activityPageLabel(item.page) : '',
        description: describeActivity(item),
        ip: item.ip || '',
        browser: shortUserAgent(item.userAgent),
        details: item.details && Object.keys(item.details).length > 0 ? JSON.stringify(item.details) : ''
      }).commit();
    }

    sheet.commit();
    await workbook.commit();
  }
};
