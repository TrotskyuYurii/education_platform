import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Department } from './models.js'; // Ensure .js for ESM
import { KnowledgeService } from './modules/knowledge/service.js';

/**
 * Підключення до MongoDB.
 *
 * Браузер ніколи не звертається до бази напряму: фронтенд ходить лише у бекенд
 * (`/api/...`), а до Mongo підключається тільки процес сервера. Тому помилка
 * «Відсутній зв'язок з базою даних» означає, що не зміг достукатися саме СЕРВЕР —
 * мережа, з якої людина відкрила сторінку, на це не впливає.
 *
 * Раніше стан підключення фіксувався один раз під час старту: якщо в ту мить
 * кластер був недосяжний (DNS не віддав SRV-запис, IP сервера не в Atlas
 * Network Access, короткий збій мережі), бекенд назавжди лишався в режимі 503
 * до ручного перезапуску. Тепер підключення повторюється у фоні, а ворота API
 * дивляться на живий стан драйвера.
 */

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;
/** Скільки чекати вибору сервера кластера, перш ніж вважати спробу невдалою. */
const SERVER_SELECTION_TIMEOUT_MS = 10_000;

let retryTimer: NodeJS.Timeout | null = null;
let initialized = false;
const readyCallbacks: Array<() => void> = [];

/** Чи є зараз робоче підключення до бази (живий стан, а не знімок на старті). */
export function isDbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Чи задано підключення взагалі (без MONGODB_URI застосунок у режимі налаштування). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Реєструє дію, яку треба виконати один раз після першого успішного
 * підключення (планувальник, прибирання завантажень тощо).
 */
export function onDbReady(callback: () => void) {
  if (initialized) {
    callback();
    return;
  }
  readyCallbacks.push(callback);
}

/**
 * Перекладає технічну помилку драйвера на підказку адміністратору. URI з
 * паролем у повідомлення не потрапляє — лише клас проблеми.
 */
export function describeDbError(err: any): string {
  const text = `${err?.name || ''} ${err?.code || ''} ${err?.message || ''}`;
  if (/querySrv|ENOTFOUND|EAI_AGAIN|querytxt/i.test(text)) {
    return 'DNS сервера не зміг розвʼязати адресу кластера (SRV-запис mongodb+srv). ' +
      'Перевірте DNS хоста бекенду або використайте стандартний рядок mongodb:// без +srv.';
  }
  if (/Authentication failed|bad auth|AuthenticationFailed/i.test(text)) {
    return 'Кластер відхилив логін/пароль із MONGODB_URI.';
  }
  if (/ServerSelection|ETIMEDOUT|ECONNREFUSED|ECONNRESET|whitelist|IP.*access/i.test(text)) {
    return 'Кластер недосяжний з хоста бекенду. Для MongoDB Atlas перевірте, що публічний IP ' +
      'сервера додано в Network Access, і що вихідний порт 27017 не блокується.';
  }
  return 'Невідома помилка підключення до MongoDB.';
}

export function nextRetryDelay(attempt: number): number {
  return Math.min(RETRY_MIN_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
}

async function runReadyCallbacks() {
  if (initialized) return;
  initialized = true;
  try {
    await seedDefaults();
  } catch (err) {
    console.error('⚠️ Failed to seed defaults:', err);
  }
  for (const cb of readyCallbacks.splice(0)) {
    try {
      cb();
    } catch (err) {
      console.error('⚠️ DB ready callback failed:', err);
    }
  }
}

/**
 * Перша спроба підключення. Повертає її результат, але при невдачі НЕ здається:
 * наступні спроби йдуть у фоні з наростаючою паузою, доки кластер не відповість.
 */
export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI is not set. The application will start in "Setup Required" mode.');
    return false;
  }

  mongoose.connection.on('disconnected', () => {
    if (initialized) console.warn('⚠️ MongoDB connection lost — the driver will reconnect automatically.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB connection restored');
  });

  const attempt = async (n: number): Promise<boolean> => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
      console.log('✅ Connected to MongoDB');
      await runReadyCallbacks();
      return true;
    } catch (err: any) {
      const delay = nextRetryDelay(n);
      console.error(
        `❌ Failed to connect to MongoDB (attempt ${n}): ${describeDbError(err)} ` +
        `[${err?.name || 'Error'}: ${err?.code || err?.message || ''}]. Retry in ${Math.round(delay / 1000)}s.`
      );
      // Невдалий connect лишає з'єднання в проміжному стані — закриваємо, щоб
      // наступна спроба почалась з чистого аркуша.
      await mongoose.disconnect().catch(() => {});
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { void attempt(n + 1); }, delay);
      retryTimer.unref?.();
      return false;
    }
  };

  return attempt(1);
}

async function seedDefaults() {
  const otherAdmins = await User.countDocuments({ role: 'admin', username: { $ne: 'admin' } } as any);

  if (otherAdmins === 0) {
    const adminExists = await User.findOne({ username: 'admin' } as any);
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        email: 'admin@viatec.ua',
        passwordHash,
        role: 'admin',
        departments: ['Всі підрозділи'],
        requireEmailCode: false
      } as any);
      console.log('🌱 Seeded default admin user (username: admin, password: admin123)');
    }
  } else {
    // SECURITY: Remove default admin if a custom admin has been created
    const defaultAdmin = await User.findOne({ username: 'admin' } as any);
    if (defaultAdmin) {
      await User.deleteOne({ username: 'admin' } as any);
      console.log('🔒 Security: Removed default admin user because a custom admin exists.');
    }
  }

  const defaultDep = await Department.findOne({ name: 'Всі підрозділи' } as any);
  if (!defaultDep) {
    await Department.create({ name: 'Всі підрозділи' } as any);
    console.log('🌱 Seeded default department "Всі підрозділи"');
  }

  // Seed Knowledge Base Spaces and initial document revisions
  try {
    await KnowledgeService.initializeDefaults();
  } catch (kErr) {
    console.error('⚠️ Could not initialize knowledge spaces defaults:', kErr);
  }
}
