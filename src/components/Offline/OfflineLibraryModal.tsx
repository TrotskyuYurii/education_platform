import React, { useEffect, useRef, useState } from 'react';
import { X, CloudCheck, Layers, FileText, Trash2, HardDrive, Download, RefreshCw, WifiOff, BookText } from 'lucide-react';
import { useOfflineLibrary } from '../../context/OfflineLibraryContext';
import { useModalA11y } from '../../hooks/useModalA11y';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { courseSections, estimateStorageUsage } from '../../utils/offlineLibrary';

interface OfflineLibraryModalProps {
  onClose: () => void;
  onOpenCourse: (courseId: string) => void;
  onOpenInstruction: (sectionId: string) => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** «Офлайн-матеріали»: що збережено на пристрої, скільки це займає, встановлення додатку. */
export const OfflineLibraryModal: React.FC<OfflineLibraryModalProps> = ({ onClose, onOpenCourse, onOpenInstruction }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  const offline = useOfflineLibrary();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [usage, setUsage] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void estimateStorageUsage().then(setUsage);
  }, [offline?.library]);

  if (!offline) return null;
  const { library } = offline;
  const pending = library.pendingReadOps.length;

  const items = [
    ...library.courses.map(c => ({
      id: c.id,
      isCourse: true,
      title: c.title || 'Курс',
      meta: `${courseSections(c, library.sections).length} інструкцій`
    })),
    ...library.savedSectionIds
      .map(id => library.sections.find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ id: s!.id, isCourse: false, title: s!.title, meta: `${s!.readTimeMin || 0} хв читання` }))
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-library-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CloudCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="offline-library-title" className="text-lg font-bold text-slate-900">Офлайн-матеріали</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Збережені на цьому пристрої курси й інструкції — вивчайте їх без інтернету.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0" aria-label="Закрити">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {offline.lastError && (
            <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3.5 py-2.5 text-xs">
              <span>{offline.lastError}</span>
              <button onClick={offline.dismissError} className="text-amber-500 hover:text-amber-700" aria-label="Приховати">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
              <div className="text-slate-500 font-medium">Збережено</div>
              <div className="text-lg font-extrabold text-slate-900">{offline.savedCount}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
              <div className="text-slate-500 font-medium flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> Зайнято на пристрої</div>
              <div className="text-lg font-extrabold text-slate-900">{usage !== null ? formatBytes(usage) : '—'}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
              <div className="text-slate-500 font-medium flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Оновлено</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{formatDate(library.syncedAt)}</div>
            </div>
          </div>

          {pending > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3.5 py-2.5 text-xs">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Позначок «вивчено», зроблених офлайн: <strong>{pending}</strong>. Вони надішлються автоматично, щойно з'явиться інтернет.</span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl">
              <CloudCheck className="w-8 h-8 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Поки що нічого не збережено</p>
              <p className="text-xs text-slate-500">
                У каталозі або в самій інструкції натисніть значок хмаринки зі стрілкою, щоб зберегти матеріал на пристрій.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.isCourse ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {item.isCourse ? <Layers className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.isCourse ? 'Курс' : 'Інструкція'} • {item.meta} • збережено {formatDate(library.savedAt[item.id])}
                    </div>
                  </div>
                  <button
                    onClick={() => { item.isCourse ? onOpenCourse(item.id) : onOpenInstruction(item.id); onClose(); }}
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                    title="Відкрити"
                    aria-label={`Відкрити «${item.title}»`}
                  >
                    <BookText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { void offline.remove(item.id); }}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Прибрати з пристрою"
                    aria-label={`Прибрати «${item.title}» з пристрою`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(canInstall || isInstalled) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-700">
                <div className="font-bold text-slate-900 text-sm mb-0.5">Додаток на пристрої</div>
                {isInstalled
                  ? 'Портал уже встановлено — він відкривається окремим вікном, як звичайна програма.'
                  : 'Встановіть портал як додаток: окреме вікно, значок на робочому столі й швидкий запуск без браузера.'}
              </div>
              {canInstall && (
                <button
                  onClick={() => { void install(); }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shrink-0"
                >
                  <Download className="w-4 h-4" /> Встановити
                </button>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">Збережене оновлюється автоматично, коли ви онлайн.</span>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Видалити все?</span>
                <button
                  onClick={() => { void offline.clearAll(); setConfirmClear(false); }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Так, видалити
                </button>
                <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold transition">
                  Скасувати
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Видалити все з пристрою
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
