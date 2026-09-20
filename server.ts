import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './server/db.js';
import { apiRouter } from './server/routes.js';
import { errorHandler } from './server/modules/core/errors.js';
import { FeatureFlag } from './server/modules/core/models.js';
import { startNotificationScheduler } from './server/modules/notifications/scheduler.js';
import { cleanupStalePendingUploads } from './server/services/fileStorage.js';

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

  // Connect DB
  const isDbConnected = await connectDB();
  if (isDbConnected) {
    startNotificationScheduler();
  }

  // Periodically remove abandoned pending uploads (files uploaded but never imported).
  // Файли живуть у базі, тож прибирання має сенс лише за наявності підключення.
  if (isDbConnected) {
    const sweep = () => {
      cleanupStalePendingUploads().catch(err =>
        console.error('Failed to clean up stale pending uploads', err)
      );
    };
    sweep();
    setInterval(sweep, 60 * 60 * 1000);
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: isDbConnected });
  });

  // Feature flags endpoint
  app.get('/api/core/features', async (req, res) => {
    try {
      if (!isDbConnected) {
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

  app.use('/api', (req, res, next) => {
    if (!isDbConnected) {
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
