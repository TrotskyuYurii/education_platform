import React, { useCallback, useEffect, useState } from 'react';
import { FileSearch, RefreshCw, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { DuplicateReportDto, duplicatesApi } from '../../../utils/duplicatesApi';
import { DuplicatePairCard, DuplicateResolution, applyResolution } from './DuplicatePairCard';
import type { DuplicatePairDto } from '../../../utils/duplicatesApi';

/** Чутливість пошуку: чим нижчий поріг, тим більше «схожих», а не лише копій. */
const SENSITIVITY = [
  { value: 0.8, label: 'Лише явні дублі' },
  { value: 0.6, label: 'Звичайна' },
  { value: 0.45, label: 'Висока (більше схожих)' }
];

/** Індикатор роботи: точного прогресу немає, тож біжуча смуга. */
export const DuplicateScanProgress: React.FC<{ label?: string }> = ({ label = 'Виконується аналіз і пошук дублів…' }) => (
  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60" role="status" aria-live="polite">
    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900 mb-2">
      <RefreshCw className="w-4 h-4 animate-spin" /> {label}
    </div>
    <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
      <div className="h-full w-1/3 bg-indigo-600 rounded-full animate-[duplicate-scan_1.2s_ease-in-out_infinite]" />
    </div>
    <style>{'@keyframes duplicate-scan{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
  </div>
);

interface Props {
  onRefresh?: () => Promise<void>;
  onPreview?: (id: string) => void;
}

/**
 * «Адміністрування → Інструменти → Пошук дублів»: інтелектуальний пошук
 * повторів у всій базі інструкцій із варіантами рішення для кожної пари.
 */
export const DuplicateFinderPanel: React.FC<Props> = ({ onRefresh, onPreview }) => {
  const [threshold, setThreshold] = useState(0.6);
  const [report, setReport] = useState<DuplicateReportDto | null>(null);
  const [pairs, setPairs] = useState<DuplicatePairDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (value: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await duplicatesApi.scan(value);
      setReport(data);
      setPairs(data.pairs);
    } catch (err: any) {
      setError(err?.message || 'Не вдалося виконати пошук дублів');
    } finally {
      setLoading(false);
    }
  }, []);

  // Пункт меню і є кнопкою запуску: відкрили інструмент — пошук уже йде.
  useEffect(() => { void scan(threshold); }, [scan, threshold]);

  const handleResolved = (pair: DuplicatePairDto, resolution: DuplicateResolution) => {
    setPairs(prev => applyResolution(prev, pair, resolution));
    if (resolution.kind === 'deactivated' && report?.sections[resolution.id]) {
      setReport(r => r && ({ ...r, sections: { ...r.sections, [resolution.id]: { ...r.sections[resolution.id], isActive: false } } }));
    }
    if (resolution.kind !== 'dismissed') void onRefresh?.();
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileSearch className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xl font-bold text-slate-900">Пошук дублів</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Виконує інтелектуальний пошук дублів інструкції: порівнює назви, зміст і фрагменти тексту з урахуванням
            словоформ, а також файли-оригінали. Знаходить і дослівні копії, і повторно завантажені документи з правками.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-semibold text-slate-500" htmlFor="duplicate-sensitivity">Чутливість</label>
          <select
            id="duplicate-sensitivity"
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            disabled={loading}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            {SENSITIVITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            onClick={() => void scan(threshold)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Пошук…' : 'Запустити пошук'}
          </button>
        </div>
      </div>

      {loading && <DuplicateScanProgress />}

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!loading && report && !error && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Перевірено інструкцій: {report.scanned}</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Пар дублів: {pairs.length}</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">за {(report.durationMs / 1000).toFixed(1)} с</span>
          </div>

          {pairs.length === 0 ? (
            <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium">Дублів не знайдено. Пари, позначені раніше як «не дубль», не показуються.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {report.groups
                .map(g => ({ ...g, pairs: pairs.filter(p => g.pairs.some(gp => gp.a === p.a && gp.b === p.b)) }))
                .filter(g => g.pairs.length > 0)
                .map((g, idx) => (
                  <div key={g.ids.join('|')} className="space-y-2">
                    {g.ids.length > 2 && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Layers className="w-3.5 h-3.5" /> Група {idx + 1}: {g.ids.length} схожих інструкцій
                      </div>
                    )}
                    {g.pairs.map(p => (
                      <DuplicatePairCard
                        key={`${p.a}|${p.b}`}
                        pair={p}
                        sections={report.sections}
                        onResolved={handleResolved}
                        onPreview={onPreview}
                      />
                    ))}
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
