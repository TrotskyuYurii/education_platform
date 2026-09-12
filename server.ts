import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './server/db.js';
import { apiRouter } from './server/routes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Connect DB
  const isDbConnected = await connectDB();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: isDbConnected });
  });

  app.use('/api', (req, res, next) => {
    if (!isDbConnected) {
      return res.status(503).json({ error: 'Database not configured. Please set MONGODB_URI.' });
    }
    next();
  }, apiRouter);

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
