import mongoose from 'mongoose';

/**
 * Журнал адміністратора — системні проблеми, а не дії користувачів.
 *
 * Це навмисно окрема колекція від AuditLog (core/models.ts): той відповідає на
 * питання «хто що змінив» і вимагає entityType/entityId, а тут ми фіксуємо збої
 * підсистем (пошта, планувальник, інтеграції) зі станом опрацювання та
 * дедуплікацією повторів. Модель загальна — нові джерела логів додаються
 * значенням `source`, без змін схеми.
 */

export const SYSTEM_LOG_LEVELS = ['error', 'warning', 'info'] as const;
export const SYSTEM_LOG_STATUSES = ['new', 'acknowledged', 'resolved'] as const;

export type SystemLogLevel = (typeof SYSTEM_LOG_LEVELS)[number];
export type SystemLogStatus = (typeof SYSTEM_LOG_STATUSES)[number];

const SystemLogSchema = new mongoose.Schema({
  level: { type: String, enum: SYSTEM_LOG_LEVELS, required: true, default: 'error' },
  // Підсистема-джерело: 'email', 'scheduler', 'auth', 'import', ...
  source: { type: String, required: true, index: true },
  // Машинний код події ('EMAIL_SEND_FAILED'), зручний для фільтрів і статистики.
  event: { type: String, required: true },
  message: { type: String, required: true },
  // Технічні подробиці для адміністратора (адресат, код помилки SMTP тощо).
  details: { type: mongoose.Schema.Types.Mixed },

  // Ключ дедуплікації: однакові збої, що йдуть чергою, не мають засмічувати журнал.
  fingerprint: { type: String, index: true },
  // Часове вікно злиття (година від епохи). Разом із fingerprint утворює
  // унікальний ключ, завдяки якому злиття робиться одним атомарним upsert —
  // інакше сплеск паралельних збоїв встигав прочитати «запису ще немає» і
  // створював по рядку на кожен лист. У закритих записів поле знімається,
  // щоб нове повторення завело новий рядок, а не воскрешало вирішену проблему.
  dedupeBucket: { type: Number },
  occurrences: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },

  status: { type: String, enum: SYSTEM_LOG_STATUSES, default: 'new', index: true },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  handledAt: { type: Date },
  resolutionNote: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Головний запит журналу — «останні незакриті», тож індекс під сортування за часом.
SystemLogSchema.index({ status: 1, lastSeenAt: -1 });
SystemLogSchema.index({ level: 1, lastSeenAt: -1 });
// Вікно дедуплікації шукає незакритий запис із тим самим fingerprint.
SystemLogSchema.index({ fingerprint: 1, status: 1, lastSeenAt: -1 });
// Унікальність робить upsert дедуплікації атомарним: паралельні записи або
// зіллються в один рядок, або отримають E11000 і зіллються з другої спроби.
// Частковий індекс — щоб закриті записи (без dedupeBucket) його не займали.
SystemLogSchema.index(
  { fingerprint: 1, dedupeBucket: 1 },
  { unique: true, partialFilterExpression: { dedupeBucket: { $type: 'number' } } }
);

export const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);
