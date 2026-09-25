import mongoose from 'mongoose';

/**
 * Журнал дій користувачів — хто, коли і куди заходив.
 *
 * Окремо від AuditLog (там — «хто що змінив» у даних) і від SystemLog (там —
 * збої підсистем). Тут фіксується поведінка людей: входи, виходи, переходи між
 * розділами, відкриття матеріалів. Записів багато й вони дрібні, тож колекція
 * без дедуплікації, але з автоматичним видаленням старих записів (TTL).
 */

export const ACTIVITY_TYPES = [
  'LOGIN',            // успішний вхід
  'LOGIN_FAILED',     // невдала спроба входу
  'OTP_SENT',         // надіслано одноразовий код входу
  'LOGOUT',           // вихід за кнопкою
  'SESSION_EXPIRED',  // автоматичний вихід через бездіяльність
  'NAVIGATE',         // перехід у розділ застосунку
  'MATERIAL_VIEW',    // відкриття навчального матеріалу
  'QUIZ_ATTEMPT',     // завершено тест або кейси
  'ACKNOWLEDGEMENT_SIGNED' // підписано ознайомлення
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * Події, які дозволено надсилати з браузера. Решту пише лише сервер у точці,
 * де подія справді сталася, — щоб клієнт не міг «намалювати» собі вхід чи
 * складений тест у журналі.
 */
export const CLIENT_ACTIVITY_TYPES = ['NAVIGATE'] as const satisfies readonly ActivityType[];

/** Скільки днів зберігати записи. Змінна читається при старті; див. коментар до TTL-індексу. */
export const ACTIVITY_RETENTION_DAYS = (() => {
  const parsed = Number(process.env.ACTIVITY_LOG_RETENTION_DAYS);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 180;
})();

const UserActivitySchema = new mongoose.Schema({
  // Порожнє для невдалого входу невідомим логіном.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  // Знімок імені/пошти на момент події: журнал лишається читабельним і після
  // перейменування чи видалення облікового запису.
  userLabel: { type: String },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  // Машинний ключ розділу ('catalog', 'management:users') — для фільтрів.
  page: { type: String },
  // Людський опис конкретного об'єкта: назва інструкції, логін невдалої спроби тощо.
  title: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Головні запити журналу — «останні події», «останні події людини», «останні події типу».
UserActivitySchema.index({ userId: 1, createdAt: -1 });
UserActivitySchema.index({ type: 1, createdAt: -1 });
// TTL: MongoDB сам прибирає старі записи. Mongoose не змінює expireAfterSeconds
// наявного індексу — після зміни ACTIVITY_LOG_RETENTION_DAYS індекс треба
// перебудувати (collMod або видалити й дати Mongoose створити заново).
UserActivitySchema.index({ createdAt: -1 }, { expireAfterSeconds: ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 });

export const UserActivity = mongoose.models.UserActivity || mongoose.model('UserActivity', UserActivitySchema);

/**
 * Скільки часу людина провела в застосунку — один документ на людину на день.
 *
 * Окремо від журналу дій навмисно: час рахується з «пульсу» сесії, що
 * приходить щохвилини, і писати кожен пульс окремим записом означало б
 * засмітити журнал тисячами однакових рядків. Тут пульс лише збільшує лічильник.
 */
const UserDailyUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Календарний день у поясі журналу ('YYYY-MM-DD'), а не UTC-мітка:
  // так «сьогодні» на дашборді збігається з київським днем.
  day: { type: String, required: true },
  seconds: { type: Number, default: 0 },
  beats: { type: Number, default: 0 },
  // Від нього рахується наступний пульс; потрібен і для TTL.
  lastBeatAt: { type: Date }
});

UserDailyUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
UserDailyUsageSchema.index({ day: 1 });
// Та сама глибина зберігання, що й у журналу дій.
UserDailyUsageSchema.index({ lastBeatAt: 1 }, { expireAfterSeconds: ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 });

export const UserDailyUsage = mongoose.models.UserDailyUsage || mongoose.model('UserDailyUsage', UserDailyUsageSchema);
