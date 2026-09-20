import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type AiImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AiImportItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'skipped';

export interface AiImportJobItem {
  fileName: string;
  status: AiImportItemStatus;
  error?: string;
  sectionTitles?: string[];
  questionCount?: number;
  assetsFound?: number;
  assetsUsed?: number;
}

export interface AiImportJob {
  id: string;
  status: AiImportJobStatus;
  totalFiles: number;
  processedFiles: number;
  successFiles: number;
  failedFiles: number;
  createdSections: number;
  createdQuestions: number;
  currentFileName?: string;
  percent: number;
  cancelRequested?: boolean;
  createdAt?: string;
  finishedAt?: string;
  items: AiImportJobItem[];
}

interface AiImportJobsValue {
  jobs: AiImportJob[];
  /** Завдання, які саме зараз у роботі або чекають черги. */
  activeJobs: AiImportJob[];
  isEnqueuing: boolean;
  enqueueFiles: (files: File[]) => Promise<{ ok: boolean; message: string }>;
  cancelJob: (jobId: string) => Promise<void>;
  dismissJob: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AiImportJobsContext = createContext<AiImportJobsValue>({
  jobs: [],
  activeJobs: [],
  isEnqueuing: false,
  enqueueFiles: async () => ({ ok: false, message: 'Фонова ШІ-обробка недоступна в цьому режимі.' }),
  cancelJob: async () => {},
  dismissJob: async () => {},
  refresh: async () => {}
});

export const useAiImportJobs = () => useContext(AiImportJobsContext);

const isRunning = (job: AiImportJob) => job.status === 'queued' || job.status === 'processing';

/** Як часто питати сервер про прогрес, поки пачка обробляється. */
const ACTIVE_POLL_MS = 3000;

interface ProviderProps {
  children: React.ReactNode;
  /** Опитуємо сервер лише для тих, хто має доступ до адміністрування. */
  enabled: boolean;
  /** Викликається, коли чергова пачка дообробилась і в базі з'явились нові інструкції. */
  onJobFinished?: () => void;
}

/**
 * Тримає стан фонової ШІ-обробки документів поза вкладкою адміністрування:
 * користувач може піти читати інструкції чи проходити тест, а панель прогресу
 * залишається на екрані й далі оновлюється.
 */
export const AiImportJobsProvider: React.FC<ProviderProps> = ({ children, enabled, onJobFinished }) => {
  const [jobs, setJobs] = useState<AiImportJob[]>([]);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  // Які завдання вже були в роботі: за переходом «в роботі → завершено»
  // визначаємо момент, коли варто перечитати матеріали з бази.
  const runningIdsRef = useRef<Set<string>>(new Set());
  const onJobFinishedRef = useRef(onJobFinished);
  onJobFinishedRef.current = onJobFinished;

  const applyJobs = useCallback((incoming: AiImportJob[]) => {
    const stillRunning = new Set(incoming.filter(isRunning).map(j => j.id));
    let someFinished = false;
    runningIdsRef.current.forEach(id => {
      if (!stillRunning.has(id)) someFinished = true;
    });
    runningIdsRef.current = stillRunning;
    setJobs(incoming);
    if (someFinished) onJobFinishedRef.current?.();
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/admin/ai-import-jobs');
      if (!res.ok) return;
      const data = await res.json();
      applyJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch {
      // мережевий збій — спробуємо на наступному опитуванні
    }
  }, [enabled, applyJobs]);

  // Перше читання стану: пачка могла лишитись в роботі з попереднього візиту.
  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      runningIdsRef.current = new Set();
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  // Поки щось обробляється — короткий інтервал; у спокої не опитуємо взагалі.
  const hasRunning = jobs.some(isRunning);
  useEffect(() => {
    if (!enabled || !hasRunning) return;
    const timer = setInterval(() => { void refresh(); }, ACTIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, hasRunning, refresh]);

  const enqueueFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return { ok: false, message: 'Не вибрано жодного файлу' };

    setIsEnqueuing(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const res = await fetch('/api/admin/ai-import-jobs', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, message: data?.error || 'Не вдалося поставити файли в чергу обробки' };
      }

      if (data?.job) {
        applyJobs([data.job as AiImportJob, ...jobs.filter(j => j.id !== data.job.id)]);
      } else {
        await refresh();
      }

      return {
        ok: true,
        message: files.length === 1
          ? `Файл «${files[0].name}» поставлено в чергу. Обробка триває у фоні — можна працювати далі.`
          : `Файлів поставлено в чергу: ${files.length}. Обробка триває у фоні — можна працювати далі.`
      };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Не вдалося поставити файли в чергу обробки' };
    } finally {
      setIsEnqueuing(false);
    }
  }, [applyJobs, jobs, refresh]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await fetch(`/api/admin/ai-import-jobs/${jobId}/cancel`, { method: 'POST' });
    } catch {
      // стан підтягнеться наступним опитуванням
    }
    await refresh();
  }, [refresh]);

  const dismissJob = useCallback(async (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
    try {
      await fetch(`/api/admin/ai-import-jobs/${jobId}/dismiss`, { method: 'POST' });
    } catch {
      // картка вже прибрана з екрана; сервер підчистить при наступному запиті
    }
  }, []);

  return (
    <AiImportJobsContext.Provider
      value={{
        jobs,
        activeJobs: jobs.filter(isRunning),
        isEnqueuing,
        enqueueFiles,
        cancelJob,
        dismissJob,
        refresh
      }}
    >
      {children}
    </AiImportJobsContext.Provider>
  );
};
