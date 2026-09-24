import mongoose from 'mongoose';

/**
 * Одне глобальне налаштування додатка. Зберігаються лише значення, які
 * адміністратор змінював; решта береться з shared/appSettings.ts.
 */
const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const AppSetting = mongoose.models.AppSetting || mongoose.model('AppSetting', appSettingSchema);
