import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  MinusCircle,
  FileText
} from 'lucide-react';
import { AiImportJob, AiImportJobItem, useAiImportJobs } from '../context/AiImportJobsContext';

const STATUS_LABEL: Record<AiImportJob['status'], string> = {
  queued: 'У черзі',
  processing: 'Обробка триває',
  completed: 'Обробку завершено',
  failed: 'Обробка не вдалася',
  cancelled: 'Обробку зупинено'
};

const ItemIcon: React.FC<{ status: AiImportJobItem['status'] }> = ({ status }) => {
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  if (status === 'error') return <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
  if (status === 'processing') return <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />;
  if (status === 'skipped') return <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
};

const JobCard: React.FC<{ job: AiImportJob }> = ({ job }) => {
  const { cancelJob, dismissJob } = useAiImportJobs();
  const [expanded, setExpanded] = useState(false);
  const running = job.status === 'queued' || job.status === 'processing';

  const barTone = job.status === 'failed'
    ? 'bg-rose-500'
    : job.status === 'cancelled'
      ? 'bg-slate-400'
      : job.status === 'completed'
        ? 'bg-emerald-500'
        : 'bg-indigo-600';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
          running ? 'bg-indigo-100 text-indigo-600' : job.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900 truncate">
              ШІ-обробка документів · {job.percent}%
            </p>
            {running ? (
              <button
                onClick={() => { void cancelJob(job.id); }}
                disabled={job.cancelRequested}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-600 disabled:opacity-50 shrink-0"
                title="Зупинити обробку решти файлів"
              >
                {job.cancelRequested ? 'Зупиняємо…' : 'Зупинити'}
              </button>
            ) : (
              <button
                onClick={() => { void dismissJob(job.id); }}
                className="text-slate-400 hover:text-slate-700 shrink-0"
                title="Прибрати"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {STATUS_LABEL[job.status]} · {job.processedFiles} з {job.totalFiles}
            {running && job.currentFileName ? ` · ${job.currentFileName}` : ''}
          </p>

          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barTone}`}
              style={{ width: `${Math.min(100, Math.max(0, job.percent))}%` }}
            />
          </div>

          {!running && (
            <p className="text-[11px] text-slate-600 mt-2">
              Створено інструкцій: <strong>{job.createdSections}</strong> · питань: <strong>{job.createdQuestions}</strong>
              {job.failedFiles > 0 && <span className="text-rose-600"> · з помилкою: {job.failedFiles}</span>}
            </p>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Згорнути список файлів' : `Показати файли (${job.items.length})`}
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="max-h-56 overflow-y-auto border-t border-slate-100 bg-slate-50/70 divide-y divide-slate-100">
          {job.items.map((item, idx) => (
            <li key={`${item.fileName}-${idx}`} className="px-4 py-2 flex items-start gap-2">
              <ItemIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-700 truncate" title={item.fileName}>
                  {item.fileName}
                </p>
                {item.status === 'done' && (
                  <p className="text-[10px] text-slate-500 truncate">
                    {(item.sectionTitles && item.sectionTitles[0]) || 'Інструкцію створено'}
                    {/* Підрозділ обирає ШІ з довідника — адміну варто бачити, куди потрапив матеріал. */}
                    {item.sectionDepartments && item.sectionDepartments[0]
                      ? ` · ${item.sectionDepartments[0]}`
                      : ''}
                    {item.questionCount ? ` · питань: ${item.questionCount}` : ''}
                    {item.assetsFound ? ` · скріншотів: ${item.assetsUsed}/${item.assetsFound}` : ''}
                  </p>
                )}
                {item.status === 'error' && (
                  <p className="text-[10px] text-rose-600">{item.error}</p>
                )}
                {item.status === 'skipped' && (
                  <p className="text-[10px] text-slate-400">Пропущено (обробку зупинено)</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Плаваюча панель прогресу: видима на будь-якій вкладці, щоб адміністратор міг
 * далі працювати з додатком, поки пачка документів обробляється у фоні.
 */
export const AiImportProgressWidget: React.FC = () => {
  const { jobs } = useAiImportJobs();
  const [collapsed, setCollapsed] = useState(false);

  if (jobs.length === 0) return null;

  const running = jobs.filter(j => j.status === 'queued' || j.status === 'processing');
  const totalFiles = jobs.reduce((sum, j) => sum + j.totalFiles, 0);
  const processedFiles = jobs.reduce((sum, j) => sum + j.processedFiles, 0);
  const overallPercent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-40 print:hidden flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white border border-slate-200 shadow-lg hover:border-indigo-300 transition"
        title="Показати прогрес ШІ-обробки"
      >
        {running.length > 0
          ? <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
          : <FileText className="w-4 h-4 text-emerald-600" />}
        <span className="text-xs font-bold text-slate-800">ШІ-обробка · {overallPercent}%</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden w-[min(22rem,calc(100vw-2rem))] space-y-2">
      <div className="flex justify-start">
        <button
          onClick={() => setCollapsed(true)}
          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200 shadow-xs"
        >
          Згорнути
        </button>
      </div>
      {jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  );
};
