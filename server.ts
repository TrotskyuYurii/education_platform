import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectDB, isDbReady, isDbConfigured, onDbReady } from './server/db.js';
import { apiRouter } from './server/routes.js';
import { errorHandler } from './server/modules/core/errors.js';
import { FeatureFlag } from './server/modules/core/models.js';
import { startNotificationScheduler } from './server/modules/notifications/scheduler.js';
import { cleanupStalePendingUploads } from './server/services/fileStorage.js';
import { resetInterruptedAiImportJobs } from './server/modules/knowledge/aiImportJobs.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Middleware
  // Стиснення йде першим, щоб охопити і JSON відповідей API, і статику збірки.
  // /api/content віддає весь markdown інструкцій — саме там виграш найбільший.
  app.use(compression({
    // Дрібні відповіді (статуси, лічильники) дешевше віддати як є, ніж стискати.
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // За реверс-проксі (nginx, IIS, балансувальник) Express інакше бачить лише IP
  // проксі і протокол http: ліміти входу ділились би на весь офіс, а cookie
  // сесії не розуміла б, що зовні це https. TRUST_PROXY=1 — один проксі попереду.
  if (process.env.TRUST_PROXY) {
    const raw = process.env.TRUST_PROXY;
    const hops = Number(raw);
    app.set('trust proxy', Number.isInteger(hops) ? hops : raw === 'true' ? true : raw);
  }

  // Connect DB. Фонові задачі стартують при ПЕРШОМУ успішному підключенні —
  // навіть якщо воно сталось не на старті, а після кількох повторних спроб.
  onDbReady(() => {
    startNotificationScheduler();
    // Тимчасові файли пачок, що оброблялися на момент зупинки, вже втрачені —
    // закриваємо такі завдання, щоб черга не залишилась «вічно в роботі».
    resetInterruptedAiImportJobs().catch(err =>
      console.error('Failed to reset interrupted AI import jobs', err)
    );

    // Periodically remove abandoned pending uploads (files uploaded but never imported).
    // Файли живуть у базі, тож прибирання має сенс лише за наявності підключення.
    const sweep = () => {
      if (!isDbReady()) return;
      cleanupStalePendingUploads().catch(err =>
        console.error('Failed to clean up stale pending uploads', err)
      );
    };
    sweep();
    setInterval(sweep, 60 * 60 * 1000);
  });
  await connectDB();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: isDbReady(), dbConfigured: isDbConfigured() });
  });

  // Feature flags endpoint
  app.get('/api/core/features', async (req, res) => {
    try {
      if (!isDbReady()) {
        return res.json({ flags: {} });
      }
      const flags = await FeatureFlag.find({});
      const flagsMap = flags.reduce((acc: any, flag) => {
        acc[flag.key] = flag.enabled;
        return acc;
      }, {});
      res.json({ flags: flagsMap });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch features' });
    }
  });

  // Живий стан драйвера, а не знімок на старті: після відновлення зв'язку API
  // запрацює саме, без перезапуску сервера.
  app.use('/api', (req, res, next) => {
    if (!isDbReady()) {
      return res.status(503).json({ error: 'Відсутній зв\'язок з базою даних. Спробуйте пізніше.' });
    }
    next();
  }, apiRouter);

  // Global Error Handler for API
  app.use('/api', errorHandler);

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Файли в /assets містять хеш вмісту в імені, тож їх можна кешувати назавжди:
    // новий білд дає нові імена, а браузер повторних запитів уже не робить.
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
      index: false,
    }));

    // Решта статики (іконки, маніфест, sw.js) імені з хешем не має — кешуємо
    // коротко, щоб оновлення доїжджали до користувачів без ручного скидання.
    app.use(express.static(distPath, { maxAge: '1h', index: false }));

    app.get('*all', (req, res) => {
      // index.html — точка входу зі списком актуальних чанків; його кешувати не
      // можна, інакше після релізу браузер шукатиме вже неіснуючі файли.
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
