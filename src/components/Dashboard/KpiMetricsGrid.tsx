import React from 'react';
import { Award, Target, BookOpen, Clock } from 'lucide-react';

interface KpiMetricsGridProps {
  bestScore: number;
  completedTestsCount: number;
  readCount: number;
  totalSectionsCount: number;
  totalQuestionsAnswered: number;
}

/**
 * Усі пропси — числа, тож memo відсікає геть усі зайві перемальовування:
 * панель оновиться лише тоді, коли справді зміниться хоч одна цифра.
 */
export const KpiMetricsGrid = React.memo<KpiMetricsGridProps>(({
  bestScore,
  completedTestsCount,
  readCount,
  totalSectionsCount,
  totalQuestionsAnswered,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Найкращий бал</p>
          <p className="text-2xl font-bold text-slate-900">{bestScore}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Завершено тестів</p>
          <p className="text-2xl font-bold text-slate-900">{completedTestsCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Прочитано інструкцій</p>
          <p className="text-2xl font-bold text-slate-900">{readCount} / {totalSectionsCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Всього відповідей</p>
          <p className="text-2xl font-bold text-slate-900">{totalQuestionsAnswered}</p>
        </div>
      </div>
    </div>
  );
});
KpiMetricsGrid.displayName = 'KpiMetricsGrid';
