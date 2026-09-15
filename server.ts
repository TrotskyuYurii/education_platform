import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './server/db.js';
import { apiRouter } from './server/routes.js';
import { errorHandler } from './server/modules/core/errors.js';
import { FeatureFlag } from './server/modules/core/models.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // Connect DB
  const isDbConnected = await connectDB();

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
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
