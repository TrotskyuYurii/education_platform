import mongoose from 'mongoose';
import crypto from 'crypto';
import { logger } from '../core/logger.js';
import { SystemLog, SystemLogLevel, SystemLogStatus } from './models.js';

// Скільки часу повтор тієї самої проблеми доклеюється до наявного запису
// замість створення нового рядка.
const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 година

export interface RecordLogInput {
  level?: SystemLogLevel;
  source: string;
  event: string;
  message: string;
  details?: Record<string, any>;
  /** Що саме вважати «тією самою» проблемою для дедуплікації. За замовчуванням — source+event+message. */
  dedupeKey?: string;
}

const buildFingerprint = (input: RecordLogInput): string =>
  crypto
    .createHash('sha1')
    .update(`${input.source}|${input.event}|${input.dedupeKey ?? input.message}`)
    .digest('hex');

export const SystemLogService = {
  /**
   * Записує проблему в журнал адміністратора.
   *
   * Контракт: НІКОЛИ не кидає винятків і не гальмує викликача. Журналювання —
   * побічний ефект, тож збій запису не має ламати потік, у якому сталася подія
   * (інакше помилка пошти перетворилася б на помилку HTTP-запиту).
   */
  async record(input: RecordLogInput): Promise<void> {
    try {
      // Немає БД — нема куди писати. Пишемо лише у stdout і виходимо, щоб не
      // висіти на буферизації запитів Mongoose.
      if (mongoose.connection.readyState !== 1) {
        logger.warn({ input }, 'SystemLog skipped: no DB connection');
        return;
      }

      const fingerprint = buildFingerprint(input);
      const now = new Date();
      // Вікно злиття як номер години — так ключ дедуплікації стає порівнянним
      // значенням, а не діапазонним запитом, і злиття робиться одним upsert.
      const dedupeBucket = Math.floor(now.getTime() / DEDUPE_WINDOW_MS);

      // Сплеск однакових збоїв (розсилка на 50 адрес по мертвому SMTP) має
      // лишитись одним рядком із лічильником. Саме тому це upsert, а не
      // «прочитати й за потреби створити»: паралельні виклики інакше всі
      // бачать «запису ще немає» і плодять дублікати.
      const write = () => SystemLog.updateOne(
        { fingerprint, dedupeBucket },
        {
          $inc: { occurrences: 1 },
          $set: { lastSeenAt: now, message: input.message, details: input.details },
          $setOnInsert: {
            level: input.level || 'error',
            source: input.source,
            event: input.event,
            firstSeenAt: now,
            status: 'new'
          }
        },
        { upsert: true }
      );

      try {
        await write();
      } catch (err: any) {
        // E11000: інший паралельний виклик устиг створити рядок першим —
        // повторюємо, тепер upsert піде гілкою оновлення.
        if (err?.code !== 11000) throw err;
        await write();
      }
    } catch (err) {
      logger.error({ err, input }, 'Failed to write system log entry');
    }
  },

  /** Fire-and-forget варіант для місць, де не можна навіть чекати на запис у БД. */
  capture(input: RecordLogInput): void {
    void this.record(input);
  },

  async list(params: {
    level?: string;
    source?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));

    const filter: Record<string, any> = {};
    if (params.level && params.level !== 'all') filter.level = params.level;
    if (params.source && params.source !== 'all') filter.source = params.source;
    if (params.status && params.status !== 'all') {
      // «Незакриті» — зручний зведений фільтр для щоденної роботи адміністратора.
      filter.status = params.status === 'open' ? { $in: ['new', 'acknowledged'] } : params.status;
    }
    if (params.search) {
      // Прибираємо все, крім літер, цифр і безпечних роздільників: рядок пошуку
      // приходить від клієнта і не має ставати керуючою конструкцією регулярного виразу.
      const safe = params.search.trim().replace(/[^\p{L}\p{N}\s@._-]/gu, '');
      if (safe) {
        const rx = new RegExp(safe, 'i');
        filter.$or = [{ message: rx }, { event: rx }, { source: rx }];
      }
    }

    const [items, total, sources] = await Promise.all([
      SystemLog.find(filter)
        .sort({ lastSeenAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('handledBy', 'fullName username email')
        .lean(),
      SystemLog.countDocuments(filter),
      SystemLog.distinct('source')
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), sources };
  },

  /** Зведення для червоного індикатора на головній сторінці. */
  async summary() {
    const open = { $in: ['new', 'acknowledged'] };
    const [unresolvedErrors, unresolvedWarnings, newCount, latest] = await Promise.all([
      SystemLog.countDocuments({ status: open, level: 'error' }),
      SystemLog.countDocuments({ status: open, level: 'warning' }),
      SystemLog.countDocuments({ status: 'new' }),
      SystemLog.findOne({ status: open, level: 'error' }).sort({ lastSeenAt: -1 }).lean()
    ]);

    return {
      unresolvedErrors,
      unresolvedWarnings,
      newCount,
      lastErrorAt: (latest as any)?.lastSeenAt || null,
      lastErrorMessage: (latest as any)?.message || null,
      lastErrorSource: (latest as any)?.source || null
    };
  },

  async setStatus(
    ids: string[],
    status: SystemLogStatus,
    actorId: mongoose.Types.ObjectId | string,
    resolutionNote?: string
  ) {
    const update: Record<string, any> =
      status === 'new'
        // Повернення в роботу знімає відмітку про опрацювання, інакше в журналі
        // лишився б «закритий» слід біля активної проблеми.
        ? { $set: { status }, $unset: { handledBy: '', handledAt: '', resolutionNote: '', dedupeBucket: '' } }
        : {
            $set: { status, handledBy: actorId, handledAt: new Date(), resolutionNote: resolutionNote || undefined },
            // Звільняємо ключ злиття: якщо проблема повториться після закриття,
            // вона має завести новий запис, а не тихо доклеїтись до вирішеного.
            ...(status === 'resolved' ? { $unset: { dedupeBucket: '' } } : {})
          };

    const result = await SystemLog.updateMany({ _id: { $in: ids } }, update);
    return { updated: result.modifiedCount ?? 0 };
  },

  async remove(ids: string[]) {
    const result = await SystemLog.deleteMany({ _id: { $in: ids } });
    return { deleted: result.deletedCount ?? 0 };
  },

  /** Прибирання: видаляє закриті записи, старші за N днів (0 — усі закриті). */
  async purgeResolved(olderThanDays = 0) {
    const filter: Record<string, any> = { status: 'resolved' };
    if (olderThanDays > 0) {
      filter.lastSeenAt = { $lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) };
    }
    const result = await SystemLog.deleteMany(filter);
    return { deleted: result.deletedCount ?? 0 };
  }
};
