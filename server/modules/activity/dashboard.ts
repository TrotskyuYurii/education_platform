import mongoose from 'mongoose';
import { logger } from '../core/logger.js';
import { User, Department } from '../../models.js';
import { UserActivity, UserDailyUsage } from './models.js';
import { ACTIVITY_TIMEZONE, parseDay, wallClockMs } from './service.js';
import { activityPageLabel } from '../../../shared/activityLabels.js';
import {
  listDays,
  resolveActivityPeriod,
  USAGE_BEAT_MAX_GAP_SEC,
  USAGE_BEAT_BASE_CREDIT_SEC
} from '../../../shared/activityDashboard.js';

/**
 * Події, що означають «людина справді працювала в застосунку». Невдалий вхід
 * і надісланий код входу сюди не входять: вони ще не доводять, що людина зайшла.
 */
const PRESENCE_TYPES = ['LOGIN', 'LOGOUT', 'SESSION_EXPIRED', 'NAVIGATE', 'MATERIAL_VIEW', 'QUIZ_ATTEMPT', 'ACKNOWLEDGEMENT_SIGNED'];

const TOP_USERS_LIMIT = 20;
const TOP_LIST_LIMIT = 10;

const todayInZone = (): string => new Date(wallClockMs(new Date())).toISOString().slice(0, 10);

/**
 * Старі бази часових поясів MongoDB знають Київ лише під назвою 'Europe/Kiev'.
 * Щоб дашборд не падав на такому сервері, при помилці поясу пробуємо псевдонім.
 */
const TIMEZONE_ALIASES: Record<string, string> = { 'Europe/Kyiv': 'Europe/Kiev' };

async function withTimezone<T>(run: (tz: string) => Promise<T>): Promise<T> {
  try {
    return await run(ACTIVITY_TIMEZONE);
  } catch (err: any) {
    const alias = TIMEZONE_ALIASES[ACTIVITY_TIMEZONE];
    if (!alias || !/time ?zone/i.test(String(err?.message))) throw err;
    logger.warn({ tz: ACTIVITY_TIMEZONE, alias }, 'MongoDB does not know activity timezone, using alias');
    return run(alias);
  }
}

const countTypeCond = (type: string) => ({ $sum: { $cond: [{ $eq: ['$type', type] }, 1, 0] } });

/** Рейтинг «розділ/матеріал → скільки разів» разом із тим, хто саме відкривав. */
const rankedByUser = (match: Record<string, any>, field: string): mongoose.PipelineStage.FacetPipelineStage[] => [
  { $match: match },
  { $group: { _id: { key: field, userId: '$userId' }, n: { $sum: 1 } } },
  { $group: { _id: '$_id.key', views: { $sum: '$n' }, byUser: { $push: { userId: '$_id.userId', n: '$n' } } } },
  { $sort: { views: -1 } },
  { $limit: TOP_LIST_LIMIT }
];

/** Групи «ключ + людина» → підсумок по ключу і перелік людей з кількістю. */
const splitByUser = (rows: any[]) => {
  const totals = new Map<number, number>();
  const users = new Map<number, Array<{ id: string; n: number }>>();
  for (const r of rows) {
    const key = Number(r._id.key);
    totals.set(key, (totals.get(key) || 0) + r.n);
    if (r._id.userId) {
      const list = users.get(key) || [];
      list.push({ id: String(r._id.userId), n: r.n });
      users.set(key, list);
    }
  }
  return { totals, users };
};

const byUserList = (list: any[]) =>
  list.filter(u => u.userId).map(u => ({ id: String(u.userId), n: u.n })).sort((a, b) => b.n - a.n);

const aggregateEvents = (start: Date, end: Date) => withTimezone(async tz => {
  const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } };
  const presence = { type: { $in: PRESENCE_TYPES }, userId: { $ne: null } };
  const [result] = await UserActivity.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $facet: {
        byType: [{ $group: { _id: '$type', n: { $sum: 1 } } }],
        loginsByDay: [{ $match: { type: 'LOGIN' } }, { $group: { _id: dayExpr, n: { $sum: 1 } } }],
        // Пара «день + людина» — з неї рахуються активні користувачі за кожен день
        // і деталізація дня: хто саме був і скільки разів входив.
        presenceByDay: [{ $match: presence }, { $group: { _id: { day: dayExpr, userId: '$userId' }, logins: countTypeCond('LOGIN') } }],
        perUser: [
          { $match: presence },
          {
            $group: {
              _id: '$userId',
              logins: countTypeCond('LOGIN'),
              materialViews: countTypeCond('MATERIAL_VIEW'),
              quizAttempts: countTypeCond('QUIZ_ATTEMPT'),
              autoLogouts: countTypeCond('SESSION_EXPIRED'),
              acknowledgements: countTypeCond('ACKNOWLEDGEMENT_SIGNED'),
              lastSeenAt: { $max: '$createdAt' },
              lastLoginAt: { $max: { $cond: [{ $eq: ['$type', 'LOGIN'] }, '$createdAt', null] } }
            }
          }
        ],
        // Години й дні тижня — одразу в розрізі людей: з цього і підсумок, і деталізація стовпчика.
        loginsByHour: [
          { $match: { type: 'LOGIN' } },
          { $group: { _id: { key: { $hour: { date: '$createdAt', timezone: tz } }, userId: '$userId' }, n: { $sum: 1 } } }
        ],
        loginsByWeekday: [
          { $match: { type: 'LOGIN' } },
          { $group: { _id: { key: { $isoDayOfWeek: { date: '$createdAt', timezone: tz } }, userId: '$userId' }, n: { $sum: 1 } } }
        ],
        topPages: rankedByUser({ type: 'NAVIGATE', page: { $nin: [null, ''] } }, '$page'),
        topMaterials: rankedByUser({ type: 'MATERIAL_VIEW', title: { $nin: [null, ''] } }, '$title'),
        // Невдалий вхід невідомим логіном не має userId — такі групуємо за тим, що вводили.
        failedLogins: [
          { $match: { type: 'LOGIN_FAILED' } },
          {
            $group: {
              _id: { $ifNull: ['$userId', { $ifNull: ['$userLabel', '—'] }] },
              userId: { $first: '$userId' },
              label: { $last: '$userLabel' },
              n: { $sum: 1 },
              lastAt: { $max: '$createdAt' }
            }
          },
          { $sort: { n: -1 } },
          { $limit: 500 }
        ]
      }
    }
  ]).allowDiskUse(true);
  return result as Record<string, any[]>;
});

/** Коротке зведення попереднього періоду — лише те, з чим порівнюємо головні показники. */
async function previousTotals(from: string, to: string) {
  const start = parseDay(from)!;
  const end = parseDay(to, true)!;
  const [logins, eventUsers, usage] = await Promise.all([
    UserActivity.countDocuments({ type: 'LOGIN', createdAt: { $gte: start, $lt: end } }),
    UserActivity.distinct('userId', { type: { $in: PRESENCE_TYPES }, userId: { $ne: null }, createdAt: { $gte: start, $lt: end } }),
    UserDailyUsage.aggregate([
      { $match: { day: { $gte: from, $lte: to } } },
      { $group: { _id: '$userId', seconds: { $sum: '$seconds' } } }
    ])
  ]);
  const active = new Set<string>(eventUsers.map(String));
  let totalSeconds = 0;
  for (const u of usage) {
    active.add(String(u._id));
    totalSeconds += u.seconds || 0;
  }
  return { logins, activeUsers: active.size, totalSeconds };
}

export const ActivityDashboardService = {
  /**
   * Зараховує час за черговий «пульс» сесії.
   *
   * Одним атомарним оновленням: читати документ і потім писати означало б, що
   * два пульси з різних вкладок у ту саму мить обидва побачать старий
   * lastBeatAt і зарахують проміжок двічі. Ніколи не кидає — пульс продовжує
   * сесію, і облік часу не має цьому заважати.
   */
  async recordBeat(userId: unknown): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1 || !userId) return;
      const now = new Date();
      const gapMs = { $subtract: [now, '$lastBeatAt'] };
      // Те саме правило, що й usageCreditSeconds у shared/activityDashboard.ts,
      // лише записане мовою MongoDB — змінюючи одне, міняйте й друге.
      const credit = {
        $cond: [
          { $and: [{ $ne: [{ $type: '$lastBeatAt' }, 'missing'] }, { $lte: [gapMs, USAGE_BEAT_MAX_GAP_SEC * 1000] }] },
          { $max: [0, { $round: [{ $divide: [gapMs, 1000] }, 0] }] },
          USAGE_BEAT_BASE_CREDIT_SEC
        ]
      };
      await UserDailyUsage.updateOne(
        { userId, day: todayInZone() },
        [{
          $set: {
            seconds: { $add: [{ $ifNull: ['$seconds', 0] }, credit] },
            beats: { $add: [{ $ifNull: ['$beats', 0] }, 1] },
            lastBeatAt: now
          }
        }],
        { upsert: true }
      );
    } catch (err) {
      logger.error({ err }, 'Failed to record app usage beat');
    }
  },

  captureBeat(userId: unknown): void {
    void this.recordBeat(userId);
  },

  async build(params: { from?: string; to?: string }) {
    const period = resolveActivityPeriod(params.from, params.to, todayInZone());
    const start = parseDay(period.from)!;
    const end = parseDay(period.to, true)!;
    const days = listDays(period.from, period.to);

    const [events, usageRows, previous, users, departments, firstUsage] = await Promise.all([
      aggregateEvents(start, end),
      UserDailyUsage.find({ day: { $gte: period.from, $lte: period.to } }).select('userId day seconds').lean(),
      previousTotals(period.previous.from, period.previous.to),
      User.find({}).select('fullName email username departmentId isActive').lean(),
      Department.find({}).select('name').lean(),
      UserDailyUsage.findOne({}).sort({ day: 1 }).select('day').lean()
    ]);

    const typeCount = (type: string) => events.byType.find((t: any) => t._id === type)?.n || 0;

    // Активні по днях: людина, що лише «пульсувала» без жодної події (сесія
    // перейшла через північ), теж була в застосунку того дня.
    const presence = new Map<string, Set<string>>(days.map(d => [d, new Set()]));
    // Деталізація дня: людина → входи й час саме цього дня.
    const dayUsers = new Map<string, Map<string, { logins: number; seconds: number }>>();
    const dayEntry = (day: string, id: string) => {
      let byId = dayUsers.get(day);
      if (!byId) dayUsers.set(day, (byId = new Map()));
      let entry = byId.get(id);
      if (!entry) byId.set(id, (entry = { logins: 0, seconds: 0 }));
      return entry;
    };
    for (const p of events.presenceByDay) {
      if (!presence.has(p._id.day)) continue;
      const id = String(p._id.userId);
      presence.get(p._id.day)!.add(id);
      dayEntry(p._id.day, id).logins += p.logins || 0;
    }

    const secondsByDay = new Map<string, number>();
    const usageByUser = new Map<string, { seconds: number; days: Set<string> }>();
    let totalSeconds = 0;
    for (const row of usageRows as any[]) {
      const id = String(row.userId);
      const seconds = row.seconds || 0;
      totalSeconds += seconds;
      secondsByDay.set(row.day, (secondsByDay.get(row.day) || 0) + seconds);
      if (presence.has(row.day)) {
        presence.get(row.day)!.add(id);
        dayEntry(row.day, id).seconds += seconds;
      }
      const entry = usageByUser.get(id) || { seconds: 0, days: new Set<string>() };
      entry.seconds += seconds;
      entry.days.add(row.day);
      usageByUser.set(id, entry);
    }

    const loginsByDay = new Map<string, number>(events.loginsByDay.map((d: any) => [d._id, d.n]));
    const daily = days.map(day => ({
      day,
      logins: loginsByDay.get(day) || 0,
      activeUsers: presence.get(day)?.size || 0,
      minutes: Math.round((secondsByDay.get(day) || 0) / 60)
    }));

    // Робочі дні людини — з подій і з обліку часу разом.
    const activeDaysByUser = new Map<string, number>();
    for (const set of presence.values()) {
      for (const id of set) activeDaysByUser.set(id, (activeDaysByUser.get(id) || 0) + 1);
    }

    const eventsByUser = new Map<string, any>(events.perUser.map((u: any) => [String(u._id), u]));
    const activeIds = new Set<string>([...eventsByUser.keys(), ...usageByUser.keys()]);

    const departmentName = new Map<string, string>((departments as any[]).map(d => [String(d._id), d.name]));
    const userById = new Map<string, any>((users as any[]).map(u => [String(u._id), u]));
    const deptOf = (u: any) => (u?.departmentId && departmentName.get(String(u.departmentId))) || 'Без підрозділу';

    // Охоплення рахуємо лише серед чинних облікових записів.
    const registered = (users as any[]).filter(u => u.isActive !== false);
    const registeredIds = new Set<string>(registered.map(u => String(u._id)));

    // Усі, хто стосується періоду: чинні облікові записи і ті, хто був активний
    // (навіть якщо запис уже вимкнено чи видалено). З цього переліку екран
    // будує деталізацію кожного показника — хто саме потрапив у число.
    const people = [...new Set<string>([...registeredIds, ...activeIds])]
      .map(id => {
        const u = userById.get(id);
        const ev = eventsByUser.get(id);
        return {
          id,
          name: u?.fullName || u?.email || u?.username || 'Видалений користувач',
          email: u?.email || '',
          department: deptOf(u),
          seconds: usageByUser.get(id)?.seconds || 0,
          logins: ev?.logins || 0,
          activeDays: activeDaysByUser.get(id) || 0,
          materialViews: ev?.materialViews || 0,
          quizAttempts: ev?.quizAttempts || 0,
          autoLogouts: ev?.autoLogouts || 0,
          acknowledgements: ev?.acknowledgements || 0,
          lastSeenAt: ev?.lastSeenAt || null,
          lastLoginAt: ev?.lastLoginAt || null,
          registered: registeredIds.has(id),
          active: activeIds.has(id)
        };
      })
      .sort((a, b) => b.seconds - a.seconds || b.activeDays - a.activeDays || b.logins - a.logins || a.name.localeCompare(b.name, 'uk'));
    const topUsers = people.filter(p => p.active).slice(0, TOP_USERS_LIMIT);
    const deptStats = new Map<string, { name: string; users: number; activeUsers: number; seconds: number }>();
    let registeredActive = 0;
    for (const u of registered) {
      const id = String(u._id);
      const name = deptOf(u);
      const stat = deptStats.get(name) || { name, users: 0, activeUsers: 0, seconds: 0 };
      stat.users += 1;
      if (activeIds.has(id)) {
        stat.activeUsers += 1;
        registeredActive += 1;
      }
      stat.seconds += usageByUser.get(id)?.seconds || 0;
      deptStats.set(name, stat);
    }

    const hours = splitByUser(events.loginsByHour);
    const weekdays = splitByUser(events.loginsByWeekday);
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      logins: hours.totals.get(hour) || 0,
      users: (hours.users.get(hour) || []).sort((a, b) => b.n - a.n)
    }));
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      logins: weekdays.totals.get(i + 1) || 0,
      users: (weekdays.users.get(i + 1) || []).sort((a, b) => b.n - a.n)
    }));

    const dailyUsers: Record<string, Array<{ id: string; logins: number; seconds: number }>> = {};
    for (const [day, byId] of dayUsers) {
      dailyUsers[day] = [...byId].map(([id, entry]) => ({ id, ...entry }));
    }

    const usersWithTime = usageByUser.size;

    return {
      period,
      totals: {
        logins: typeCount('LOGIN'),
        activeUsers: activeIds.size,
        totalSeconds,
        avgSecondsPerActiveUser: usersWithTime > 0 ? Math.round(totalSeconds / usersWithTime) : 0,
        avgDailyActiveUsers: days.length > 0 ? Math.round((daily.reduce((s, d) => s + d.activeUsers, 0) / days.length) * 10) / 10 : 0,
        failedLogins: typeCount('LOGIN_FAILED'),
        autoLogouts: typeCount('SESSION_EXPIRED'),
        materialViews: typeCount('MATERIAL_VIEW'),
        quizAttempts: typeCount('QUIZ_ATTEMPT'),
        acknowledgements: typeCount('ACKNOWLEDGEMENT_SIGNED'),
        registeredUsers: registered.length,
        inactiveUsers: Math.max(0, registered.length - registeredActive),
        coveragePercent: registered.length > 0 ? Math.round((registeredActive / registered.length) * 100) : 0
      },
      previous,
      daily,
      byHour,
      byWeekday,
      dailyUsers,
      topPages: events.topPages.map((p: any) => {
        const byUser = byUserList(p.byUser);
        return { page: p._id, label: activityPageLabel(p._id), views: p.views, users: byUser.length, byUser };
      }),
      topMaterials: events.topMaterials.map((m: any) => {
        const byUser = byUserList(m.byUser);
        return { title: m._id, views: m.views, users: byUser.length, byUser };
      }),
      failedLogins: events.failedLogins.map((f: any) => ({
        key: String(f._id),
        userId: f.userId ? String(f.userId) : null,
        label: f.label || 'Невідомий логін',
        count: f.n,
        lastAt: f.lastAt
      })),
      topUsers,
      people,
      departments: [...deptStats.values()].sort((a, b) => b.users - a.users || a.name.localeCompare(b.name, 'uk')),
      usageTrackedSince: (firstUsage as any)?.day || null
    };
  }
};
