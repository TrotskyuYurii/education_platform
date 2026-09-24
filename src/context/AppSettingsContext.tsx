import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../../shared/appSettings';

/**
 * Глобальні налаштування додатка з вкладки «Адміністрування → Налаштування».
 *
 * Завантажуються один раз після входу. Поки відповідь не прийшла (або якщо
 * запит не вдався), діють значення за замовчуванням — додаток не чекає на них.
 * Зміна в адмінці одразу оновлює стан, тож ефект видно без перезавантаження.
 */
interface AppSettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  /** Зберігає зміни на сервері; повертає актуальні налаштування або кидає помилку. */
  update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_APP_SETTINGS,
  loaded: false,
  update: async () => DEFAULT_APP_SETTINGS
});

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v2/settings');
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.settings) {
          setSettings({ ...DEFAULT_APP_SETTINGS, ...data.settings });
        }
      } catch (err) {
        /* лишаємо значення за замовчуванням */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const res = await fetch('/api/v2/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: patch })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.settings) throw new Error(data.error || 'Не вдалося зберегти налаштування');
    const next = { ...DEFAULT_APP_SETTINGS, ...data.settings };
    setSettings(next);
    return next;
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loaded, update }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
