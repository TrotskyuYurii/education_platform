import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useModalA11y } from '../../../hooks/useModalA11y';
import { DuplicatePairDto, DuplicateReportDto, duplicatesApi } from '../../../utils/duplicatesApi';
import { DuplicatePairCard, DuplicateResolution, applyResolution } from './DuplicatePairCard';
import { DuplicateScanProgress } from './DuplicateFinderPanel';

interface Props {
  /** Щойно імпортовані інструкції, які треба звірити з базою. */
  sectionIds: string[];
  onClose: () => void;
  /** Після видалення чи вимкнення — перечитати матеріали. */
  onChanged?: () => void | Promise<void>;
}

/**
 * Автоматична перевірка на дублі після імпорту: показує, що йде аналіз,
 * а потім — знайдені дублі та варіанти рішення для кожного.
 */
export const ImportDuplicateCheckDialog: React.FC<Props> = ({ sectionIds, onClose, onChanged }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const [report, setReport] = useState<DuplicateReportDto | null>(null);
  const [pairs, setPairs] = useState<DuplicatePairDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const idsKey = sectionIds.join('|');

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    duplicatesApi.check(sectionIds)
      .then(data => {
        if (cancelled) return;
        const created = new Set(sectionIds);
        // Частини одного документа між собою — не дублі.
        const external = data.pairs.filter(p => !(created.has(p.a) && created.has(p.b)));
        setReport(data);
        setPairs(external);
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Не вдалося перевірити на дублі'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const handleResolved = (pair: DuplicatePairDto, resolution: DuplicateResolution) => {
    setPairs(prev => applyResolution(prev, pair, resolution));
    if (resolution.kind === 'deactivated') {
      setReport(r => r && r.sections[resolution.id]
        ? { ...r, sections: { ...r.sections, [resolution.id]: { ...r.sections[resolution.id], isActive: false } } }
        : r);
    }
    if (resolution.kind !== 'dismissed') void onChanged?.();
  };

  const loading = !report && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-duplicate-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 id="import-duplicate-title" className="text-base font-bold text-slate-900">Перевірка на дублі</h3>
            <p className="text-xs text-slate-500">Щойно імпортовані інструкції звіряються з наявною базою знань</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Закрити">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {loading && <DuplicateScanProgress />}

          {error && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {report && pairs.length === 0 && (
            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium">
                {report.pairs.length === 0 ? 'Дублів не знайдено — інструкцію додано до бази.' : 'Усі знайдені дублі опрацьовано.'}
              </p>
            </div>
          )}

          {report && pairs.length > 0 && (
            <>
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Знайдено можливих дублів: <strong>{pairs.length}</strong>. Вирішіть, що зробити з кожним: залишити обидві
                  інструкції, вимкнути одну з них (вона лишиться в базі, але співробітники її не бачитимуть) або видалити.
                </span>
              </div>
              {pairs.map(p => (
                <DuplicatePairCard
                  key={`${p.a}|${p.b}`}
                  pair={p}
                  sections={report.sections}
                  labels={sectionIds.includes(p.a) ? ['Нова', 'Наявна'] : ['Інструкція 1', 'Інструкція 2']}
                  onResolved={handleResolved}
                />
              ))}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">
            {pairs.length > 0 ? 'Вирішити пізніше' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  );
};
