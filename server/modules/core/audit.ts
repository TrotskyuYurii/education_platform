import { AuditLog } from './models.js';
import { logger } from './logger.js';

interface AuditLogEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
}

export const auditService = {
  log: async (entry: AuditLogEntry) => {
    try {
      await AuditLog.create(entry);
      logger.info({ auditAction: entry.action, entityId: entry.entityId }, 'Audit log recorded');
    } catch (err) {
      logger.error({ err, entry }, 'Failed to write audit log');
    }
  }
};
