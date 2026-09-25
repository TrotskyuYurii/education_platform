import React from 'react';
import { Award, Target, BookOpen, Clock, Building2 } from 'lucide-react';
import { formatDuration } from '../../../shared/attemptDuration';
import type { DrilldownColumn, DrilldownConfig } from '../DrilldownDialog';
import { getHistoryTitle, resolveHistoryDepartment, historyPercentage } from './historyLabels';

/** Що саме розгорнули на дашборді навчання. */
export type LearningDrill =
  | { kind: 'best' }
  | { kind: 'tests' }
  | { kind: 'answers' }
  | { kind: 'read'; filter: 'all' | 'read' | 'unread' }
  | { kind: 'department'; name: string };

export interface LearningDrillContext {
  quizHistory: Array<{
    date: string;
    score: number;
    total: number;
    percentage?: number;
    sectionId?: string;
    courseId?: string;
    department?: string;
    mode?: string;
    durationSec?: number;
  }>;
  sections: Array<{ id: string; title: string; department?: string; courseTitle?: string; courseId?: string }>;
  courses: any[];
  readSectionIds: string[];
  /** Чий це прогрес: «ваш» чи конкретного співробітника — для підзаголовка. */
  subjectLabel: string;
}

interface AttemptRow {
  key: string;
  date: string;
  title: string;
  department: string;
  score: number;
  total: number;
  percentage: number;
  isCases: boolean;
  durationSec?: number;
}

interface SectionRow {
  id: string;
  title: string;
  department: string;
  course: string;
  isRead: boolean;
}

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const scoreTone = (pct: number) =>
  pct >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : pct >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

const colDate: DrilldownColumn<AttemptRow> = { key: 'date', header: 'Дата', render: a => <span className="text-slate-600 whitespace-nowrap">{formatDate(a.date)}</span> };
const colTitle: DrilldownColumn<AttemptRow> = {
  key: 'title',
  header: 'Тест',
  render: a => (
    <>
      <div className="font-medium text-slate-900">{a.title}</div>
      <div className="text-xs text-slate-500">{a.isCases ? 'Кейси' : 'Тест'} · {a.department}</div>
    </>
  )
};
const colAnswers: DrilldownColumn<AttemptRow> = { key: 'answers', header: 'Правильно', align: 'right', render: a => `${a.score} з ${a.total}` };
const colPct: DrilldownColumn<AttemptRow> = {
  key: 'pct',
  header: 'Результат',
  align: 'right',
  render: a => <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreTone(a.percentage)}`}>{a.percentage}%</span>
};
const colDuration: DrilldownColumn<AttemptRow> = { key: 'dur', header: 'Тривалість', align: 'right', render: a => <span className="text-slate-500">{formatDuration(a.durationSec)}</span> };

const attemptSearch = (a: AttemptRow) => `${a.title} ${a.department}`;
const byDateDesc = (a: AttemptRow, b: AttemptRow) => new Date(b.date).getTime() - new Date(a.date).getTime();

const attemptFilters = [
  { key: 'all', label: 'Усі', predicate: () => true },
  { key: 'tests', label: 'Тести', predicate: (a: AttemptRow) => !a.isCases },
  { key: 'cases', label: 'Кейси', predicate: (a: AttemptRow) => a.isCases }
];

/**
 * Опис вікна деталізації для блоку дашборда «Аналітика та прогрес навчання».
 * Переліки будуються з тієї самої історії, з якої пораховано картки й графіки.
 */
export function buildLearningDrilldown(drill: LearningDrill, ctx: LearningDrillContext): DrilldownConfig<any> {
  const attempts: AttemptRow[] = ctx.quizHistory.map((h, i) => ({
    key: `${h.date}-${i}`,
    date: h.date,
    title: getHistoryTitle(h, ctx.courses, ctx.sections),
    department: resolveHistoryDepartment(h, ctx.courses, ctx.sections),
    score: h.score,
    total: h.total,
    percentage: historyPercentage(h),
    isCases: h.mode === 'cases',
    durationSec: h.durationSec
  }));
  const common = { rowKey: (a: AttemptRow) => a.key, searchText: attemptSearch, searchPlaceholder: 'Пошук за назвою тесту або підрозділом' };

  switch (drill.kind) {
    case 'best': {
      const rows = attempts.filter(a => !a.isCases).sort((a, b) => b.percentage - a.percentage || byDateDesc(a, b));
      return {
        ...common,
        icon: Award, tone: 'bg-emerald-50 text-emerald-600',
        title: 'Найкращий бал',
        subtitle: `${ctx.subjectLabel} · ${rows.length} тестів`,
        description: 'Найкращий бал — найвищий результат серед тестів; практичні кейси сюди не входять. Вгорі — спроба, що дала цей бал.',
        rows,
        columns: [colTitle, colDate, colAnswers, colPct],
        emptyText: 'Тестів ще не складено'
      } as DrilldownConfig<AttemptRow>;
    }

    case 'tests': {
      const rows = [...attempts].sort(byDateDesc);
      return {
        ...common,
        icon: Target, tone: 'bg-blue-50 text-blue-600',
        title: 'Завершені тести',
        subtitle: `${ctx.subjectLabel} · ${rows.length} спроб`,
        description: 'Кожна завершена спроба — і тести, і практичні кейси.',
        rows,
        filters: attemptFilters,
        columns: [colDate, colTitle, colAnswers, colPct, colDuration],
        emptyText: 'Завершених спроб ще немає'
      } as DrilldownConfig<AttemptRow>;
    }

    case 'answers': {
      const rows = [...attempts].sort(byDateDesc);
      const total = rows.reduce((s, a) => s + a.total, 0);
      const correct = rows.reduce((s, a) => s + a.score, 0);
      return {
        ...common,
        icon: Clock, tone: 'bg-amber-50 text-amber-600',
        title: 'Всього відповідей',
        subtitle: `${ctx.subjectLabel} · ${total} відповідей, з них правильних ${correct}${total > 0 ? ` (${Math.round((correct / total) * 100)}%)` : ''}`,
        description: 'Сума питань у всіх завершених спробах — і тестах, і кейсах.',
        rows,
        filters: attemptFilters,
        columns: [
          colDate, colTitle,
          { key: 'total', header: 'Питань', align: 'right', render: (a: AttemptRow) => <span className="font-semibold text-slate-900">{a.total}</span> },
          { key: 'correct', header: 'Правильних', align: 'right', render: (a: AttemptRow) => a.score },
          colPct
        ],
        emptyText: 'Відповідей ще немає'
      } as DrilldownConfig<AttemptRow>;
    }

    case 'department': {
      const rows = attempts.filter(a => a.department === drill.name).sort(byDateDesc);
      const avg = rows.length > 0 ? Math.round(rows.reduce((s, a) => s + a.percentage, 0) / rows.length) : 0;
      return {
        ...common,
        icon: Building2, tone: 'bg-purple-50 text-purple-600',
        title: `Підрозділ: ${drill.name}`,
        subtitle: `${ctx.subjectLabel} · ${rows.length} спроб · середній бал ${avg}%`,
        description: 'Спроби, з яких пораховано стовпчик графіка «Середній бал за підрозділами» (включно з кейсами).',
        rows,
        filters: attemptFilters,
        columns: [colDate, colTitle, colAnswers, colPct],
        emptyText: 'Спроб у цьому підрозділі немає'
      } as DrilldownConfig<AttemptRow>;
    }

    case 'read': {
      const read = new Set(ctx.readSectionIds);
      const rows: SectionRow[] = ctx.sections
        .map(s => ({
          id: s.id,
          title: s.title,
          department: s.department || '—',
          course: s.courseTitle || '',
          isRead: read.has(s.id)
        }))
        .sort((a, b) => Number(a.isRead) - Number(b.isRead) || a.title.localeCompare(b.title, 'uk'));
      const readCount = rows.filter(r => r.isRead).length;
      return {
        icon: BookOpen, tone: 'bg-purple-50 text-purple-600',
        title: 'Прочитані інструкції',
        subtitle: `${ctx.subjectLabel} · прочитано ${readCount} з ${rows.length}`,
        description: 'Інструкція вважається прочитаною, коли її позначили як опрацьовану.',
        rows,
        rowKey: (r: SectionRow) => r.id,
        searchText: (r: SectionRow) => `${r.title} ${r.department} ${r.course}`,
        searchPlaceholder: 'Пошук за назвою, підрозділом або курсом',
        filters: [
          { key: 'all', label: 'Усі', predicate: () => true },
          { key: 'read', label: 'Прочитані', predicate: (r: SectionRow) => r.isRead },
          { key: 'unread', label: 'Залишилось', predicate: (r: SectionRow) => !r.isRead }
        ],
        initialFilter: drill.filter,
        columns: [
          {
            key: 'title', header: 'Інструкція',
            render: (r: SectionRow) => (
              <>
                <div className="font-medium text-slate-900">{r.title}</div>
                {r.course && <div className="text-xs text-slate-500">{r.course}</div>}
              </>
            )
          },
          { key: 'dept', header: 'Підрозділ', render: (r: SectionRow) => <span className="text-slate-600">{r.department}</span> },
          {
            key: 'status', header: 'Статус', align: 'right',
            render: (r: SectionRow) => r.isRead
              ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Прочитано</span>
              : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Не прочитано</span>
          }
        ],
        emptyText: 'Інструкцій немає'
      } as DrilldownConfig<SectionRow>;
    }
  }
}
