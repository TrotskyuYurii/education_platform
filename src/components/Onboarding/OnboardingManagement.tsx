import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Rocket,
  Plus,
  Pencil,
  Copy,
  Trash2,
  UserPlus,
  Loader2,
  Search,
  LayoutGrid,
  BarChart3,
  Zap,
  MessageSquareHeart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Archive,
  ExternalLink,
  X,
  Star
} from 'lucide-react';
import { FlowEditor } from './FlowEditor';
import { AssignOnboardingModal } from './AssignOnboardingModal';
import {
  OnboardingTemplateSummary,
  OnboardingReportRow,
  OnboardingReportStats,
  OnboardingAutoRule,
  OnboardingSurveySummaryRow,
  OnboardingSurveyResponseRow,
  OnboardingBottleneck
} from './types';
import { TEMPLATE_STATUS_META, ASSIGNMENT_STATUS_META, formatDateUa } from './constants';

interface OnboardingManagementProps {
  sections: any[];
  courses: any[];
  cases: any[];
  /** Відкрити картку проходження конкретного співробітника. */
  onOpenAssignment?: (assignmentId: string) => void;
}

type MgmtView = 'catalog' | 'progress' | 'rules' | 'surveys';

const VIEW_TABS: { key: MgmtView; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'catalog', label: 'Каталог онбордінгів', icon: LayoutGrid },
  { key: 'progress', label: 'Проходження', icon: BarChart3 },
  { key: 'rules', label: 'Автозапуск', icon: Zap },
  { key: 'surveys', label: 'Фідбек', icon: MessageSquareHeart }
];

export const OnboardingManagement: React.FC<OnboardingManagementProps> = ({
  sections, courses, cases, onOpenAssignment
}) => {
  const [view, setView] = useState<MgmtView>('catalog');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<OnboardingTemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<OnboardingTemplateSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/v2/onboarding/templates?includeArchived=${showArchived}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити каталог');
      setTemplates(data.templates || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження');
    } finally {
      setLoadingTemplates(false);
    }
  }, [showArchived]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const createTemplate = async () => {
    const name = window.prompt('Назва нового онбордінгу:', 'Онбординг нового співробітника');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v2/onboarding/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося створити онбординг');
      await loadTemplates();
      setEditingTemplateId(data.template.id);
    } catch (err: any) {
      setError(err.message || 'Помилка створення');
    } finally {
      setCreating(false);
    }
  };

  const duplicateTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/v2/onboarding/templates/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося скопіювати');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const archiveTemplate = async (id: string) => {
    if (!window.confirm('Перевести онбординг в архів? Його більше не можна буде призначати, вже розпочаті проходження не постраждають.')) return;
    try {
      const res = await fetch(`/api/v2/onboarding/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не вдалося архівувати');
      }
      await loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Видалити онбординг «${name}» назавжди? Дію не можна скасувати.`)) return;
    try {
      const res = await fetch(`/api/v2/onboarding/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося видалити');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter(t =>
      t.name.toLowerCase().includes(term) ||
      (t.description || '').toLowerCase().includes(term) ||
      (t.departmentName || '').toLowerCase().includes(term)
    );
  }, [templates, search]);

  if (editingTemplateId) {
    return (
      <FlowEditor
        templateId={editingTemplateId}
        sections={sections}
        courses={courses}
        cases={cases}
        onBack={() => { setEditingTemplateId(null); loadTemplates(); }}
        onSaved={loadTemplates}
      />
    );
  }

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Онбординг співробітників</h3>
            <p className="text-xs text-slate-500">
              Схеми адаптації, призначення новачкам і контроль проходження
            </p>
          </div>
        </div>

        {view === 'catalog' && (
          <button
            onClick={createTemplate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Створити онбординг
          </button>
        )}
      </div>

      {/* Вкладки розділу */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-px no-scrollbar">
        {VIEW_TABS.map(tab => {
          const Icon = tab.icon;
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition border-b-2 ${
                active
                  ? 'text-purple-700 border-purple-600 bg-purple-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700" aria-label="Закрити">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {view === 'catalog' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук за назвою, описом або підрозділом"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none transition"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={e => setShowArchived(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
              />
              Показати архівні
            </label>
          </div>

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Завантаження каталогу...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyCatalog hasSearch={Boolean(search)} onCreate={createTemplate} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => setEditingTemplateId(t.id)}
                  onAssign={() => setAssigningTemplate(t)}
                  onDuplicate={() => duplicateTemplate(t.id)}
                  onArchive={() => archiveTemplate(t.id)}
                  onDelete={() => deleteTemplate(t.id, t.name)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'progress' && <ProgressReport onOpenAssignment={onOpenAssignment} />}
      {view === 'rules' && <AutoRulesPanel templates={templates} />}
      {view === 'surveys' && <SurveyReport />}

      {assigningTemplate && (
        <AssignOnboardingModal
          template={assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          onAssigned={loadTemplates}
        />
      )}
    </div>
  );
};

// ==========================================================
// Картка шаблону в каталозі
// ==========================================================

const TemplateCard: React.FC<{
  template: OnboardingTemplateSummary;
  onEdit: () => void;
  onAssign: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}> = ({ template, onEdit, onAssign, onDuplicate, onArchive, onDelete }) => {
  const statusMeta = TEMPLATE_STATUS_META[template.status];
  const isPublished = template.status === 'published';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-purple-200 hover:shadow-sm transition flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
          <Rocket className="w-4.5 h-4.5" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.chip}`}>
          {statusMeta.label}
        </span>
      </div>

      <h4 className="font-bold text-slate-900 leading-tight mb-1">{template.name}</h4>
      <p className="text-xs text-slate-500 line-clamp-2 mb-3 min-h-[32px]">
        {template.description || 'Опис не заповнено'}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          {template.stepsCount} кроків
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          {template.durationDays} дн.
        </span>
        {template.requiresBuddy && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700">
            з наставником
          </span>
        )}
        {template.departmentName && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
            {template.departmentName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 mb-3">
        <Metric value={template.assignedActive} label="активних" tone="text-blue-600" />
        <Metric value={template.assignedCompleted} label="завершили" tone="text-emerald-600" />
        <Metric value={template.assignedTotal} label="всього" tone="text-slate-700" />
      </div>

      <div className="mt-auto flex items-center gap-1.5">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Схема
        </button>
        <button
          onClick={onAssign}
          disabled={!isPublished}
          title={isPublished ? 'Призначити співробітнику' : 'Спершу опублікуйте онбординг'}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Призначити
        </button>
        <button
          onClick={onDuplicate}
          className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition shrink-0"
          title="Створити копію"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        {template.status !== 'archived' ? (
          <button
            onClick={onArchive}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition shrink-0"
            title="В архів"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition shrink-0"
            title="Видалити назавжди"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ value: number | string; label: string; tone: string }> = ({ value, label, tone }) => (
  <div className="text-center">
    <div className={`text-base font-bold ${tone}`}>{value}</div>
    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
  </div>
);

const EmptyCatalog: React.FC<{ hasSearch: boolean; onCreate: () => void }> = ({ hasSearch, onCreate }) => (
  <div className="text-center py-16 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-purple-500 mx-auto mb-4">
      <Rocket className="w-6 h-6" />
    </div>
    <h4 className="font-bold text-slate-800 mb-1.5">
      {hasSearch ? 'Нічого не знайдено' : 'Онбордінгів ще немає'}
    </h4>
    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-5">
      {hasSearch
        ? 'Спробуйте змінити пошуковий запит або зніміть фільтри.'
        : 'Створіть перший онбординг: додайте кроки на схему, з\'єднайте їх стрілками у потрібному порядку і опублікуйте. Після цього онбординг можна призначати новачкам.'}
    </p>
    {!hasSearch && (
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
      >
        <Plus className="w-4 h-4" />
        Створити перший онбординг
      </button>
    )}
  </div>
);

// ==========================================================
// Звіт про проходження
// ==========================================================

const ProgressReport: React.FC<{ onOpenAssignment?: (id: string) => void }> = ({ onOpenAssignment }) => {
  const [stats, setStats] = useState<OnboardingReportStats | null>(null);
  const [rows, setRows] = useState<OnboardingReportRow[]>([]);
  const [bottlenecks, setBottlenecks] = useState<OnboardingBottleneck[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [reportRes, bottleneckRes] = await Promise.all([
          fetch('/api/v2/onboarding/assignments/report'),
          fetch('/api/v2/onboarding/assignments/bottlenecks')
        ]);
        if (reportRes.ok) {
          const data = await reportRes.json();
          setStats(data.stats);
          setRows(data.assignments || []);
        }
        if (bottleneckRes.ok) {
          const data = await bottleneckRes.json();
          setBottlenecks(data.bottlenecks || []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!term) return true;
      return r.userName.toLowerCase().includes(term)
        || r.templateName.toLowerCase().includes(term)
        || r.departmentName.toLowerCase().includes(term);
    });
  }, [rows, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Завантаження звіту...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Усього онбордінгів" value={stats.total} tone="slate" />
          <StatCard icon={Clock} label="У процесі" value={stats.inProgress + stats.notStarted} tone="blue" />
          <StatCard icon={CheckCircle2} label="Завершено" value={stats.completed} tone="emerald" />
          <StatCard icon={AlertTriangle} label="Прострочено" value={stats.overdue} tone="rose" />
          <StatCard
            icon={TrendingUp}
            label="Сер. час адаптації"
            value={stats.avgDaysToComplete > 0 ? `${stats.avgDaysToComplete} дн.` : '—'}
            tone="purple"
          />
        </div>
      )}

      {bottlenecks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-bold text-amber-900">Де найчастіше застрягають</h4>
          </div>
          <p className="text-[11px] text-amber-800 mb-3 leading-relaxed">
            Кроки, строк яких минув, а вони досі не закриті. Це найдешевший спосіб зрозуміти,
            що в схемі варто спростити або кому бракує підтримки.
          </p>
          <div className="space-y-1.5">
            {bottlenecks.slice(0, 5).map(b => (
              <div key={b.key} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2 border border-amber-200">
                <span className="text-xs font-semibold text-slate-800 truncate">{b.title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-500">{b.stuckCount} чол.</span>
                  <span className="text-[11px] font-bold text-amber-700">+{b.avgDaysLate} дн.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук за співробітником, онбордінгом або підрозділом"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-400 outline-none"
        >
          <option value="all">Усі статуси</option>
          <option value="not_started">Не розпочато</option>
          <option value="in_progress">У процесі</option>
          <option value="completed">Завершено</option>
          <option value="overdue">Прострочено</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <p className="text-sm font-semibold text-slate-600">Онбордінгів за цими умовами немає</p>
          <p className="text-xs text-slate-400 mt-1">
            Призначте онбординг у каталозі, щоб побачити тут прогрес
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left font-bold px-4 py-3">Співробітник</th>
                <th className="text-left font-bold px-4 py-3">Онбординг</th>
                <th className="text-left font-bold px-4 py-3">Прогрес</th>
                <th className="text-left font-bold px-4 py-3">Строк</th>
                <th className="text-left font-bold px-4 py-3">Наставник</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(row => {
                const statusMeta = ASSIGNMENT_STATUS_META[row.status] || ASSIGNMENT_STATUS_META.not_started;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 text-[13px]">{row.userName}</div>
                      <div className="text-[11px] text-slate-400">
                        {[row.positionTitle, row.departmentName].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-slate-700">{row.templateName}</div>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.chip}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.status === 'completed' ? 'bg-emerald-500'
                                : row.status === 'overdue' ? 'bg-rose-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${row.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 w-9 text-right">
                          {row.progressPercent}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {row.completedSteps} з {row.totalSteps} кроків
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-slate-700">{formatDateUa(row.dueDate)}</div>
                      {row.status !== 'completed' && (
                        <div className={`text-[10px] ${row.daysRemaining < 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                          {row.daysRemaining < 0
                            ? `прострочено на ${Math.abs(row.daysRemaining)} дн.`
                            : `лишилось ${row.daysRemaining} дн.`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">{row.buddyName || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {onOpenAssignment && (
                        <button
                          onClick={() => onOpenAssignment(row.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 hover:underline"
                        >
                          Маршрут
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
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
};

const StatCard: React.FC<{
  icon: typeof Users;
  label: string;
  value: number | string;
  tone: 'slate' | 'blue' | 'emerald' | 'rose' | 'purple';
}> = ({ icon: Icon, label, value, tone }) => {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-600',
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    rose: 'bg-rose-50 border-rose-200 text-rose-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600'
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-2 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1 leading-tight">{label}</div>
    </div>
  );
};

// ==========================================================
// Правила автозапуску
// ==========================================================

const AutoRulesPanel: React.FC<{ templates: OnboardingTemplateSummary[] }> = ({ templates }) => {
  const [rules, setRules] = useState<OnboardingAutoRule[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTemplateId, setNewTemplateId] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newPositionId, setNewPositionId] = useState('');
  const [newPriority, setNewPriority] = useState(0);

  const load = useCallback(async () => {
    try {
      const [rulesRes, deptRes, posRes] = await Promise.all([
        fetch('/api/v2/onboarding/auto-rules'),
        fetch('/api/v2/org/departments'),
        fetch('/api/v2/org/positions')
      ]);
      if (rulesRes.ok) setRules((await rulesRes.json()).rules || []);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (posRes.ok) setPositions(await posRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const publishedTemplates = templates.filter(t => t.status === 'published');

  const createRule = async () => {
    if (!newTemplateId) return;
    setError(null);
    try {
      const res = await fetch('/api/v2/onboarding/auto-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: newTemplateId,
          departmentId: newDepartmentId,
          positionId: newPositionId,
          priority: newPriority
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося створити правило');
      setNewTemplateId('');
      setNewDepartmentId('');
      setNewPositionId('');
      setNewPriority(0);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleRule = async (rule: OnboardingAutoRule) => {
    await fetch(`/api/v2/onboarding/auto-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive })
    });
    await load();
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm('Видалити правило автозапуску?')) return;
    await fetch(`/api/v2/onboarding/auto-rules/${id}`, { method: 'DELETE' });
    await load();
  };

  const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none transition';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Завантаження правил...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-bold text-blue-900">Як це працює</h4>
        </div>
        <p className="text-[12px] text-blue-800 leading-relaxed">
          Коли ви створюєте нового співробітника, система підбирає правило за його підрозділом і посадою
          та автоматично ставить йому відповідний онбординг — від дати виходу, вказаної в профілі.
          Якщо підходить кілька правил, спрацює те, у якого вищий пріоритет. Правило без підрозділу
          і посади діє як загальне для всіх новачків.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-slate-900 mb-3">Нове правило</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <select value={newTemplateId} onChange={e => setNewTemplateId(e.target.value)} className={`${inputClass} lg:col-span-2`}>
            <option value="">— онбординг —</option>
            {publishedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={newDepartmentId} onChange={e => setNewDepartmentId(e.target.value)} className={inputClass}>
            <option value="">Будь-який підрозділ</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select value={newPositionId} onChange={e => setNewPositionId(e.target.value)} className={inputClass}>
            <option value="">Будь-яка посада</option>
            {positions.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={newPriority}
              onChange={e => setNewPriority(parseInt(e.target.value, 10) || 0)}
              className={inputClass}
              placeholder="Пріоритет"
              title="Вищий пріоритет виграє, якщо підходить кілька правил"
            />
            <button
              onClick={createRule}
              disabled={!newTemplateId}
              className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition disabled:opacity-40 shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        {publishedTemplates.length === 0 && (
          <p className="text-[11px] text-amber-600 mt-2">
            Немає опублікованих онбордінгів — автозапуск можна налаштувати лише для опублікованої схеми.
          </p>
        )}
        {error && <p className="text-[11px] text-rose-600 mt-2">{error}</p>}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-14 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <p className="text-sm font-semibold text-slate-600">Правил автозапуску ще немає</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Поки правил немає, онбординг призначається вручну з каталогу
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border transition ${
                rule.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900">{rule.templateName}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {[
                    rule.departmentName || 'будь-який підрозділ',
                    rule.positionTitle || 'будь-яка посада'
                  ].join(' · ')}
                  {rule.priority > 0 && ` · пріоритет ${rule.priority}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRule(rule)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    rule.isActive
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {rule.isActive ? 'Активне' : 'Вимкнено'}
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="w-8 h-8 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
                  title="Видалити правило"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================================
// Звіт по опитуваннях
// ==========================================================

const SurveyReport: React.FC = () => {
  const [summary, setSummary] = useState<OnboardingSurveySummaryRow[]>([]);
  const [responses, setResponses] = useState<OnboardingSurveyResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/v2/onboarding/surveys/report');
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary || []);
          setResponses(data.responses || []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Завантаження фідбеку...</span>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-pink-500 mx-auto mb-4">
          <MessageSquareHeart className="w-6 h-6" />
        </div>
        <h4 className="font-bold text-slate-800 mb-1.5">Відповідей ще немає</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Опитування надсилаються автоматично на 7, 30 і 90 день від дати виходу (набір днів
          налаштовується в параметрах кожного онбордінгу). Тут з'явиться зведення, щойно новачки
          почнуть відповідати.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summary.map(row => (
          <div key={row.dayOffset} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                День {row.dayOffset}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {row.responses} відпов.
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-2xl font-bold text-slate-900">{row.avgSatisfaction}</span>
              <span className="text-xs text-slate-400">/ 5</span>
              <div className="flex ml-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i <= Math.round(row.avgSatisfaction) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>Зрозумілість задач</span>
                <span className="font-bold text-slate-700">{row.avgClarity ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Підтримка команди</span>
                <span className="font-bold text-slate-700">{row.avgSupport ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>eNPS (0–10)</span>
                <span className="font-bold text-slate-700">{row.avgNps ?? '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-900 mb-3">Коментарі новачків</h4>
        <div className="space-y-2">
          {responses.filter(r => r.comment).slice(0, 25).map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-bold text-slate-800">{r.userName}</span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>День {r.dayOffset}</span>
                  <span>·</span>
                  <span>{formatDateUa(r.submittedAt)}</span>
                  <span className="font-bold text-amber-600">{r.satisfaction}/5</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>
            </div>
          ))}
          {responses.filter(r => r.comment).length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">
              Розгорнутих коментарів поки немає — люди залишили лише оцінки
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
