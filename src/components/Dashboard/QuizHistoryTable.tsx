import React from 'react';
import { History } from 'lucide-react';
import { formatDuration } from '../../../shared/attemptDuration';

interface QuizHistoryItem {
  date: string;
  score: number;
  total: number;
  percentage: number;
  sectionId?: string;
  courseId?: string;
  department?: string;
  mode?: string;
  startedAt?: string;
  durationSec?: number;
}

interface QuizHistoryTableProps {
  quizHistory: QuizHistoryItem[];
  selectedUserId: string | null;
  courses?: any[];
  sections?: any[];
}

/**
 * Таблиця історії тестів буває на сотні рядків, а її дані залежать лише від
 * самого прогресу та довідників курсів і розділів.
 */
export const QuizHistoryTable = React.memo<QuizHistoryTableProps>(({
  quizHistory,
  selectedUserId,
  courses = [],
  sections = [],
}) => {
  // Helper to get title for history items
  const getItemTitle = (history: QuizHistoryItem) => {
    if (history.courseId) {
      const c = courses.find(course => course.id === history.courseId);
      if (c?.title) return c.title;
    }
    if (history.sectionId) {
      const s = sections.find(sec => sec.id === history.sectionId);
      if (s?.title) return s.title;
    }
    return history.department ? `Тест (${history.department})` : 'Підсумковий тест';
  };

  const getItemDepartment = (history: QuizHistoryItem) => {
    if (history.department && history.department !== 'Загальний') {
      return history.department;
    }
    if (history.courseId) {
      const c = courses.find(course => course.id === history.courseId);
      if (c?.department) return c.department;
    }
    if (history.sectionId) {
      const s = sections.find(sec => sec.id === history.sectionId);
      if (s?.department) return s.department;
    }
    return history.department || 'Загальний';
  };

  // Sort history newest first
  const sortedHistory = React.useMemo(() => {
    return [...quizHistory].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [quizHistory]);

  // Середнє лише за спробами, де тривалість записано
  const avgDurationSec = React.useMemo(() => {
    const timed = quizHistory.filter(h => typeof h.durationSec === 'number');
    if (timed.length === 0) return null;
    return Math.round(timed.reduce((sum, h) => sum + (h.durationSec as number), 0) / timed.length);
  }, [quizHistory]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          <h3 className="text-base font-bold text-slate-900">
            {selectedUserId ? `Історія тестувань користувача (${quizHistory.length})` : 'Історія ваших тестувань'}
          </h3>
        </div>
        {quizHistory.length > 0 && (
          <span className="text-xs text-slate-500">
            Всього спроб: <strong>{quizHistory.length}</strong>
            {avgDurationSec !== null && (
              <> · Середній час: <strong>{formatDuration(avgDurationSec)}</strong></>
            )}
          </span>
        )}
      </div>

      {sortedHistory.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
          Співробітник ще не проходив жодного тесту чи тренажера кейсів.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Дата та час</th>
                <th className="py-3 px-4">Матеріал / Курс</th>
                <th className="py-3 px-4">Підрозділ</th>
                <th className="py-3 px-4">Тип</th>
                <th className="py-3 px-4 text-center">Правильних</th>
                <th className="py-3 px-4 text-right">Тривалість</th>
                <th className="py-3 px-4 text-right">Результат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedHistory.map((item, i) => {
                const itemDate = item.date ? new Date(item.date).toLocaleString('uk-UA', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '—';

                const pct = item.percentage !== undefined 
                  ? item.percentage 
                  : (item.total > 0 ? Math.round((item.score / item.total) * 100) : 0);
                const isPassed = pct >= 80;
                const isMedium = pct >= 60 && pct < 80;

                return (
                  <tr key={i} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {itemDate}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {getItemTitle(item)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                        {getItemDepartment(item)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.mode === 'cases' ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200 text-[10px]">
                          Кейси
                        </span>
                      ) : (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-200 text-[10px]">
                          Тест
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {item.score} / {item.total}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap text-slate-600"
                      title={item.durationSec === undefined ? 'Тривалість не фіксувалась для цієї спроби' : undefined}
                    >
                      {formatDuration(item.durationSec)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        isPassed 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : isMedium 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
QuizHistoryTable.displayName = 'QuizHistoryTable';
