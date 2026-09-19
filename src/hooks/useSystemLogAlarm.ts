import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export interface SystemLogSummary {
  unresolvedErrors: number;
  unresolvedWarnings: number;
  newCount: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastErrorSource: string | null;
}

const EMPTY: SystemLogSummary = {
  unresolvedErrors: 0,
  unresolvedWarnings: 0,
  newCount: 0,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastErrorSource: null
};

const POLL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Зведення журналу адміністратора для червоного індикатора тривоги.
 *
 * Запит іде лише для користувачів із правом перегляду журналу — решті нема що
 * показувати, тож і смикати сервер не варто. Помилка запиту свідомо не
 * піднімається в UI: індикатор — допоміжний елемент, він не має ламати головну
 * сторінку, якщо журнал тимчасово недоступний.
 */
export const useSystemLogAlarm = (pollIntervalMs: number = POLL_INTERVAL_MS) => {
  const { hasPermission } = useAuth();
  const canView = hasPermission('system.logs.view');

  const [summary, setSummary] = useState<SystemLogSummary>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!canView) {
      setSummary(EMPTY);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch('/api/v2/system/logs/summary');
      if (!res.ok) return;
      const data = await res.json();
      setSummary({ ...EMPTY, ...data });
    } catch {
      /* мовчки: індикатор не критичний для роботи сторінки */
    } finally {
      setLoaded(true);
    }
  }, [canView]);

  useEffect(() => {
    refresh();
    if (!canView) return;
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, canView, pollIntervalMs]);

  return {
    summary,
    loaded,
    canView,
    refresh,
    hasAlarm: canView && summary.unresolvedErrors > 0,
    totalOpen: summary.unresolvedErrors + summary.unresolvedWarnings
  };
};
