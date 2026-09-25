import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Sparkles, Activity, ArrowRight, ExternalLink, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { trackNavigation } from '../../../utils/activityTracker';
import { ActivityDashboard } from './ActivityDashboard';

type DashboardView = 'hub' | 'activity';

interface DashboardsHubProps {
  /** Відкрити «Аналітику та прогрес навчання» — той самий екран, що й з «Мого профілю». */
  onOpenLearningDashboard: () => void;
  /** Дашборд «Активність» показує персональні дані журналу дій — лише роль «Адміністратор». */
  canViewActivity: boolean;
}

interface DashboardCard {
  key: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
  metrics: string[];
  /** Позначка, що екран відкриється поза адмініструванням. */
  external?: boolean;
  locked?: boolean;
  onOpen: () => void;
}

export const DashboardsHub: React.FC<DashboardsHubProps> = ({ onOpenLearningDashboard, canViewActivity }) => {
  const [view, setView] = useState<DashboardView>('hub');

  // Журнал дій розрізняє вітрину й конкретний дашборд.
  useEffect(() => {
    trackNavigation(view === 'hub' ? 'management:dashboards' : `management:dashboards:${view}`);
  }, [view]);

  if (view === 'activity' && canViewActivity) {
    return <ActivityDashboard onBack={() => setView('hub')} />;
  }

  const cards: DashboardCard[] = [
    {
      key: 'learning',
      icon: Sparkles,
      tone: 'bg-blue-50 text-blue-600 border-blue-200',
      title: 'Аналітика та прогрес навчання',
      description: 'Успішність, пройдені тести, опрацьовані матеріали та сертифікати — ваші власні або будь-якого співробітника.',
      metrics: ['Найкращий результат', 'Історія тестів', 'Сертифікати', 'Бали за підрозділами'],
      external: true,
      onOpen: onOpenLearningDashboard
    },
    {
      key: 'activity',
      icon: Activity,
      tone: 'bg-purple-50 text-purple-600 border-purple-200',
      title: 'Активність',
      description: 'Як часто співробітники заходять у портал, скільки з них активні і скільки часу проводять у додатку за обраний період.',
      metrics: ['Кількість входів', 'Активні користувачі', 'Час у додатку', 'Охоплення підрозділів'],
      locked: !canViewActivity,
      onOpen: () => setView('activity')
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
          <LayoutDashboard className="w-5 h-5 text-purple-600" />
          Дашборди
        </h2>
        <p className="text-sm text-slate-500 mt-1">Зведені показники навчання та використання порталу в одному місці</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map(({ icon: Icon, ...card }) => (
          <button
            key={card.key}
            onClick={card.onOpen}
            disabled={card.locked}
            className="group text-left bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs transition hover:border-purple-300 hover:shadow-md disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:shadow-xs disabled:cursor-not-allowed focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              {card.locked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Лише для адміністратора
                </span>
              ) : card.external ? (
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
              ) : (
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
              )}
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">{card.title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{card.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {card.metrics.map(m => (
                <span key={m} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{m}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
