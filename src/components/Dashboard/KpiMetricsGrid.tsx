import React from 'react';
import { Award, Target, BookOpen, Clock, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LearningDrill } from './learningDrilldowns';

interface KpiMetricsGridProps {
  bestScore: number;
  completedTestsCount: number;
  readCount: number;
  totalSectionsCount: number;
  totalQuestionsAnswered: number;
  /** Відкрити деталізацію картки: з яких спроб чи інструкцій складається число. */
  onOpenDetail?: (drill: LearningDrill) => void;
}

const KpiTile: React.FC<{
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  onOpen?: () => void;
}> = ({ icon: Icon, tone, label, value, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    disabled={!onOpen}
    title={onOpen ? 'Показати деталі' : undefined}
    className="group w-full text-left bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4 transition enabled:hover:border-purple-300 enabled:hover:shadow-md enabled:cursor-pointer disabled:cursor-default focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
  >
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="grow min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
    {onOpen && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition shrink-0" />}
  </button>
);

/**
 * Усі пропси — числа й стабільний колбек, тож memo відсікає зайві
 * перемальовування: панель оновиться лише тоді, коли зміниться хоч одна цифра.
 */
export const KpiMetricsGrid = React.memo<KpiMetricsGridProps>(({
  bestScore,
  completedTestsCount,
  readCount,
  totalSectionsCount,
  totalQuestionsAnswered,
  onOpenDetail,
}) => {
  const open = (drill: LearningDrill) => (onOpenDetail ? () => onOpenDetail(drill) : undefined);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiTile icon={Award} tone="bg-emerald-50 text-emerald-600" label="Найкращий бал" value={`${bestScore}%`} onOpen={open({ kind: 'best' })} />
      <KpiTile icon={Target} tone="bg-blue-50 text-blue-600" label="Завершено тестів" value={String(completedTestsCount)} onOpen={open({ kind: 'tests' })} />
      <KpiTile
        icon={BookOpen}
        tone="bg-purple-50 text-purple-600"
        label="Прочитано інструкцій"
        value={`${readCount} / ${totalSectionsCount}`}
        onOpen={open({ kind: 'read', filter: 'all' })}
      />
      <KpiTile icon={Clock} tone="bg-amber-50 text-amber-600" label="Всього відповідей" value={String(totalQuestionsAnswered)} onOpen={open({ kind: 'answers' })} />
    </div>
  );
});
KpiMetricsGrid.displayName = 'KpiMetricsGrid';
