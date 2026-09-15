import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

const isDbConnectivityError = (err: any): boolean => {
  const name = err?.name || '';
  return name.startsWith('Mongo') || name.startsWith('Mongoose');
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    err,
    url: req.url,
    method: req.method,
    body: req.body
  }, 'Unhandled error occurred');

  if (isDbConnectivityError(err)) {
    return res.status(503).json({ error: 'Відсутній зв\'язок з базою даних. Спробуйте пізніше.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Внутрішня помилка сервера';

  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
