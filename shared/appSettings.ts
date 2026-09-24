/**
 * Глобальні налаштування додатка — спільний перелік для сервера й фронтенду.
 *
 * Кожне налаштування має тут тип і значення за замовчуванням. Сервер зберігає
 * лише змінені адміністратором значення, а решту бере звідси, тож нове
 * налаштування працює одразу, без міграції бази. Щоб додати налаштування:
 * поле в AppSettings, значення в DEFAULT_APP_SETTINGS і перемикач у вкладці
 * «Налаштування» адміністрування.
 */
export interface AppSettings {
  /** Висловлювання українських діячів під час проходження тестів і на екрані результату. */
  quizQuotesEnabled: boolean;
}

export type AppSettingKey = keyof AppSettings;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  quizQuotesEnabled: true
};

export const APP_SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[];

/** Чи відоме налаштування і чи значення має той самий тип, що й за замовчуванням. */
export function isValidAppSettingValue(key: string, value: unknown): key is AppSettingKey {
  if (!(APP_SETTING_KEYS as string[]).includes(key)) return false;
  return typeof value === typeof DEFAULT_APP_SETTINGS[key as AppSettingKey];
}

/**
 * Лишає із запиту на зміну тільки відомі налаштування правильного типу.
 * Невідомі ключі та значення хибного типу повертаються окремо — для помилки 400.
 */
export function sanitizeAppSettingsPatch(input: unknown): { patch: Partial<AppSettings>; rejected: string[] } {
  const patch: Partial<AppSettings> = {};
  const rejected: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { patch, rejected };
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isValidAppSettingValue(key, value)) {
      (patch as Record<string, unknown>)[key] = value;
    } else {
      rejected.push(key);
    }
  }
  return { patch, rejected };
}

/** Збережені значення поверх значень за замовчуванням; сміття з бази ігнорується. */
export function mergeAppSettings(stored: Record<string, unknown>): AppSettings {
  const merged: AppSettings = { ...DEFAULT_APP_SETTINGS };
  for (const key of APP_SETTING_KEYS) {
    if (key in stored && isValidAppSettingValue(key, stored[key])) {
      (merged as unknown as Record<string, unknown>)[key] = stored[key];
    }
  }
  return merged;
}
