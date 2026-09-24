import { describe, it, expect } from 'vitest';

import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  sanitizeAppSettingsPatch
} from '../shared/appSettings.js';

/**
 * Глобальні налаштування: сервер зберігає лише змінені значення, решту бере
 * зі значень за замовчуванням, а запит на зміну пропускає тільки відомі ключі
 * правильного типу.
 */
describe('appSettings', () => {
  it('висловлювання в тестах за замовчуванням увімкнені', () => {
    expect(DEFAULT_APP_SETTINGS.quizQuotesEnabled).toBe(true);
  });

  it('без збережених значень повертає значення за замовчуванням', () => {
    expect(mergeAppSettings({})).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('збережене значення перекриває значення за замовчуванням', () => {
    expect(mergeAppSettings({ quizQuotesEnabled: false }).quizQuotesEnabled).toBe(false);
  });

  it('ігнорує в базі невідомі ключі та значення хибного типу', () => {
    const merged = mergeAppSettings({ quizQuotesEnabled: 'no', somethingElse: 1 });
    expect(merged).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('приймає відоме налаштування правильного типу', () => {
    expect(sanitizeAppSettingsPatch({ quizQuotesEnabled: false })).toEqual({
      patch: { quizQuotesEnabled: false },
      rejected: []
    });
  });

  it('відхиляє невідомі ключі та хибний тип', () => {
    const { patch, rejected } = sanitizeAppSettingsPatch({ quizQuotesEnabled: 'false', unknownKey: true });
    expect(patch).toEqual({});
    expect(rejected.sort()).toEqual(['quizQuotesEnabled', 'unknownKey']);
  });

  it('не падає на відсутньому чи некоректному тілі запиту', () => {
    expect(sanitizeAppSettingsPatch(undefined)).toEqual({ patch: {}, rejected: [] });
    expect(sanitizeAppSettingsPatch([true])).toEqual({ patch: {}, rejected: [] });
  });
});
