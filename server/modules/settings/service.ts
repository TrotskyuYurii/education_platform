import { AppSetting } from './models.js';
import { AppSettings, APP_SETTING_KEYS, mergeAppSettings } from '../../../shared/appSettings.js';
import { auditService } from '../core/audit.js';

export class AppSettingsService {
  static async get(): Promise<AppSettings> {
    const docs = await AppSetting.find({ key: { $in: APP_SETTING_KEYS } } as any).lean<any[]>();
    return mergeAppSettings(Object.fromEntries(docs.map(d => [d.key, d.value])));
  }

  static async update(patch: Partial<AppSettings>, actorId?: string): Promise<AppSettings> {
    const before = await this.get();
    const entries = Object.entries(patch);
    if (entries.length > 0) {
      await AppSetting.bulkWrite(entries.map(([key, value]) => ({
        updateOne: {
          filter: { key },
          update: { $set: { key, value, updatedBy: actorId } },
          upsert: true
        }
      })) as any);
    }
    const after = await this.get();
    await auditService.log({
      actorId,
      action: 'APP_SETTINGS_UPDATED',
      entityType: 'AppSettings',
      entityId: entries.map(([key]) => key).join(',') || 'none',
      before,
      after
    });
    return after;
  }
}
