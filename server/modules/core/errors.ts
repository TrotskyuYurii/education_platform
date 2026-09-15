import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ 
    err, 
    url: req.url, 
    method: req.method,
    body: req.body
  }, 'Unhandled error occurred');

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Внутрішня помилка сервера';

  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
