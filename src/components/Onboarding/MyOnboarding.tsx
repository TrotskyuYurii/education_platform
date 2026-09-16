import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Rocket,
  Lock,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Users,
  Calendar,
  Play,
  ExternalLink,
  MessageSquareHeart,
  PartyPopper,
  ChevronDown,
  SkipForward,
  RotateCcw
} from 'lucide-react';
import {
  OnboardingAssignmentView,
  OnboardingStepView,
  OnboardingPendingSurvey,
  OnboardingOwnerTask
} from './types';
import { STEP_TYPE_META, STEP_STATUS_META, OWNER_ROLE_LABELS, formatDateUa } from './constants';
import { OnboardingSurveyModal } from './OnboardingSurveyModal';

interface MyOnboardingProps {
  /** Відкрити інструкцію в режимі читання. */
  onOpenInstruction: (sectionId: string, courseId?: string) => void;
  onOpenCourse: (courseId: string) => void;
  onStartQuiz: (type: 'all' | 'section' | 'course', id?: string) => void;
  onStartCases: (casesToRun?: any[]) => void;
  onNavigateToSignoff: () => void;
  /** Якщо передано — відкриваємо конкретне проходження (перегляд керівником). */
  focusAssignmentId?: string | null;
  /** Керівник/HR може пропускати та перевідкривати кроки. */
  canManageSteps?: boolean;
  cases?: any[];
}

export const MyOnboarding: React.FC<MyOnboardingProps> = ({
  onOpenInstruction,
  onOpenCourse,
  onStartQuiz,
  onStartCases,
  onNavigateToSignoff,
  focusAssignmentId,
  canManageSteps = false,
  cases = []
}) => {
  const [assignments, setAssignments] = useState<OnboardingAssignmentView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ownerTasks, setOwnerTasks] = useState<OnboardingOwnerTask[]>([]);
  const [pendingSurveys, setPendingSurveys] = useState<OnboardingPendingSurvey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<OnboardingPendingSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Коли керівник відкриває чужий маршрут, «мої онбординги» не підходять —
      // тягнемо конкретне призначення за id.
      if (focusAssignmentId) {
        const res = await fetch(`/api/v2/onboarding/assignments/${focusAssignmentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити онбординг');
        setAssignments([data.assignment]);
        setActiveId(data.assignment.id);
        return;
      }

      const [myRes, tasksRes, surveysRes] = await Promise.all([
        fetch('/api/v2/onboarding/my'),
        fetch('/api/v2/onboarding/my/tasks'),
        fetch('/api/v2/onboarding/surveys/pending')
      ]);
      if (myRes.ok) {
        const data = await myRes.json();
        const list: OnboardingAssignmentView[] = data.onboardings || [];
        setAssignments(list);
        setActiveId(prev => prev && list.some(a => a.id === prev) ? prev : (list[0]?.id || null));
      }
      if (tasksRes.ok) setOwnerTasks((await tasksRes.json()).tasks || []);
      if (surveysRes.ok) setPendingSurveys((await surveysRes.json()).pending || []);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження онбордінгу');
    } finally {
      setLoading(false);
    }
  }, [focusAssignmentId]);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(
    () => assignments.find(a => a.id === activeId) || null,
    [assignments, activeId]
  );

  const applyUpdated = (updated: OnboardingAssignmentView) => {
    setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const completeStep = async (assignmentId: string, nodeId: string) => {
    setBusyStep(nodeId);
    setError(null);
    try {
      const res = await fetch(`/api/v2/onboarding/assignments/${assignmentId}/steps/${nodeId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося відмітити крок');
      if (data.assignment) applyUpdated(data.assignment);
      if (!focusAssignmentId) {
        const tasksRes = await fetch('/api/v2/onboarding/my/tasks');
        if (tasksRes.ok) setOwnerTasks((await tasksRes.json()).tasks || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  const stepAction = async (assignmentId: string, nodeId: string, action: 'skip' | 'reopen') => {
    setBusyStep(nodeId);
    try {
      const res = await fetch(`/api/v2/onboarding/assignments/${assignmentId}/steps/${nodeId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося оновити крок');
      if (data.assignment) applyUpdated(data.assignment);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  /** Відкриває матеріал кроку в тому ж застосунку (або зовнішнє посилання). */
  const openStepTarget = (step: OnboardingStepView) => {
    switch (step.type) {
      case 'instruction':
        onOpenInstruction(step.targetId);
        break;
      case 'course':
        onOpenCourse(step.targetId);
        break;
      case 'quiz':
        onStartQuiz('course', step.targetId);
        break;
      case 'case': {
        const found = cases.find(c => c.id === step.targetId);
        onStartCases(found ? [found] : undefined);
        break;
      }
      case 'acknowledgement':
        onNavigateToSignoff();
        break;
      case 'link':
        if (step.url) window.open(step.url, '_blank', 'noopener,noreferrer');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Завантаження вашого онбордінгу...</span>
        </div>
      </div>
    );
  }

  const hasNothing = assignments.length === 0 && ownerTasks.length === 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pendingSurveys.length > 0 && (
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white border border-pink-200 flex items-center justify-center text-pink-600 shrink-0">
                <MessageSquareHeart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Як проходить ваша адаптація?</h3>
                <p className="text-xs text-slate-600 mt-0.5 max-w-xl leading-relaxed">
                  Коротке опитування на {pendingSurveys[0].dayOffset}-й день. Відповіді бачить HR у
                  зведеному вигляді — вони потрібні, щоб зробити адаптацію наступних новачків кращою.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveSurvey(pendingSurveys[0])}
              className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 transition shrink-0"
            >
              Пройти за хвилину
            </button>
          </div>
        </div>
      )}

      {ownerTasks.length > 0 && (
        <OwnerTasksSection
          tasks={ownerTasks}
          busyStep={busyStep}
          onComplete={(assignmentId, nodeId) => completeStep(assignmentId, nodeId)}
        />
      )}

      {hasNothing ? (
        <EmptyState />
      ) : assignments.length > 0 && (
        <>
          {assignments.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {assignments.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActiveId(a.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                    a.id === activeId
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {a.templateName} · {a.progressPercent}%
                </button>
              ))}
            </div>
          )}

          {active && (
            <AssignmentJourney
              assignment={active}
              busyStep={busyStep}
              canManageSteps={canManageSteps}
              onComplete={nodeId => completeStep(active.id, nodeId)}
              onSkip={nodeId => stepAction(active.id, nodeId, 'skip')}
              onReopen={nodeId => stepAction(active.id, nodeId, 'reopen')}
              onOpenTarget={openStepTarget}
            />
          )}
        </>
      )}

      {activeSurvey && (
        <OnboardingSurveyModal
          survey={activeSurvey}
          onClose={() => setActiveSurvey(null)}
          onSubmitted={() => {
            setPendingSurveys(prev => prev.filter(
              s => !(s.assignmentId === activeSurvey.assignmentId && s.dayOffset === activeSurvey.dayOffset)
            ));
            setActiveSurvey(null);
          }}
        />
      )}
    </div>
  );
};

// ==========================================================
// Маршрут одного онбордінгу
// ==========================================================

const AssignmentJourney: React.FC<{
  assignment: OnboardingAssignmentView;
  busyStep: string | null;
  canManageSteps: boolean;
  onComplete: (nodeId: string) => void;
  onSkip: (nodeId: string) => void;
  onReopen: (nodeId: string) => void;
  onOpenTarget: (step: OnboardingStepView) => void;
}> = ({ assignment, busyStep, canManageSteps, onComplete, onSkip, onReopen, onOpenTarget }) => {

  // Службові вузли — деталь реалізації графа, новачку їх показувати не треба.
  const visibleSteps = useMemo(
    () => assignment.steps.filter(s => !STEP_TYPE_META[s.type].isSystem),
    [assignment.steps]
  );

  // Групуємо за етапами (Preboarding / День 1 / 30-60-90), а кроки без етапу
  // збираємо в окрему групу в кінці, щоб жоден не загубився.
  const grouped = useMemo(() => {
    const stages = [...(assignment.stages || [])].sort((a, b) => a.order - b.order);
    const groups = stages.map(stage => ({
      stage,
      steps: visibleSteps.filter(s => s.stageKey === stage.key)
    })).filter(g => g.steps.length > 0);

    const ungrouped = visibleSteps.filter(s => !stages.some(st => st.key === s.stageKey));
    if (ungrouped.length > 0) {
      groups.push({
        stage: { key: '__none', title: 'Інші кроки', dayOffset: 0, color: 'slate', order: 999 },
        steps: ungrouped
      });
    }
    return groups;
  }, [visibleSteps, assignment.stages]);

  const isDone = assignment.status === 'completed';
  const nextStep = visibleSteps.find(s => s.status === 'available' && s.isMine);

  return (
    <div className="space-y-5">

      {/* Шапка з прогресом */}
      <div className={`rounded-3xl border p-6 ${
        isDone
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl bg-white border flex items-center justify-center shrink-0 ${
              isDone ? 'border-emerald-200 text-emerald-600' : 'border-blue-200 text-blue-600'
            }`}>
              {isDone ? <PartyPopper className="w-6 h-6" /> : <Rocket className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {assignment.templateName}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {isDone
                  ? `Завершено ${formatDateUa(assignment.completedAt)} — вітаємо!`
                  : `Крок ${assignment.completedSteps} з ${assignment.totalSteps} · завершити до ${formatDateUa(assignment.dueDate)}`}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Старт: {formatDateUa(assignment.startDate)}
                </span>
                {assignment.buddyName && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Наставник: <strong className="text-slate-800">{assignment.buddyName}</strong>
                  </span>
                )}
                {!isDone && (
                  <span className={`inline-flex items-center gap-1 ${
                    assignment.daysRemaining < 0 ? 'text-rose-600 font-semibold' : ''
                  }`}>
                    <Clock className="w-3 h-3" />
                    {assignment.daysRemaining < 0
                      ? `Прострочено на ${Math.abs(assignment.daysRemaining)} дн.`
                      : `Лишилось ${assignment.daysRemaining} дн.`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className={`text-3xl font-bold ${isDone ? 'text-emerald-600' : 'text-blue-600'}`}>
              {assignment.progressPercent}%
            </div>
            <div className="w-28 h-2 bg-white/80 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${assignment.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {assignment.notes && (
          <div className="mt-4 p-3 rounded-xl bg-white/70 border border-white text-xs text-slate-700">
            <strong className="text-slate-900">Від {assignment.assignedByName}:</strong> {assignment.notes}
          </div>
        )}

        {nextStep && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-blue-200">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                Наступний крок
              </div>
              <div className="text-sm font-bold text-slate-900 truncate">{nextStep.title}</div>
            </div>
            <button
              onClick={() => STEP_TYPE_META[nextStep.type].needsTarget || nextStep.type === 'acknowledgement' || nextStep.type === 'link'
                ? onOpenTarget(nextStep)
                : onComplete(nextStep.nodeId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Почати
            </button>
          </div>
        )}
      </div>

      {/* Кроки за етапами */}
      {grouped.map(group => (
        <StageSection
          key={group.stage.key}
          title={group.stage.title}
          steps={group.steps}
          busyStep={busyStep}
          canManageSteps={canManageSteps}
          onComplete={onComplete}
          onSkip={onSkip}
          onReopen={onReopen}
          onOpenTarget={onOpenTarget}
        />
      ))}
    </div>
  );
};

const StageSection: React.FC<{
  title: string;
  steps: OnboardingStepView[];
  busyStep: string | null;
  canManageSteps: boolean;
  onComplete: (nodeId: string) => void;
  onSkip: (nodeId: string) => void;
  onReopen: (nodeId: string) => void;
  onOpenTarget: (step: OnboardingStepView) => void;
}> = ({ title, steps, busyStep, canManageSteps, onComplete, onSkip, onReopen, onOpenTarget }) => {
  const done = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const [collapsed, setCollapsed] = useState(done === steps.length && steps.length > 0);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/60 transition"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            done === steps.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {done} / {steps.length}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="px-6 pb-5 space-y-2.5">
          {steps.map(step => (
            <StepCard
              key={step.nodeId}
              step={step}
              busy={busyStep === step.nodeId}
              canManageSteps={canManageSteps}
              onComplete={() => onComplete(step.nodeId)}
              onSkip={() => onSkip(step.nodeId)}
              onReopen={() => onReopen(step.nodeId)}
              onOpenTarget={() => onOpenTarget(step)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const StepCard: React.FC<{
  step: OnboardingStepView;
  busy: boolean;
  canManageSteps: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onReopen: () => void;
  onOpenTarget: () => void;
}> = ({ step, busy, canManageSteps, onComplete, onSkip, onReopen, onOpenTarget }) => {
  const meta = STEP_TYPE_META[step.type];
  const Icon = meta.icon;
  const statusMeta = STEP_STATUS_META[step.status];
  const isClosed = step.status === 'completed' || step.status === 'skipped';
  const isLocked = step.status === 'locked';
  const canOpenTarget = meta.needsTarget || step.type === 'acknowledgement' || step.type === 'link';

  return (
    <div className={`p-4 rounded-2xl border transition ${
      isClosed ? 'bg-emerald-50/40 border-emerald-100'
        : isLocked ? 'bg-slate-50 border-slate-200 opacity-70'
        : step.isOverdue ? 'bg-rose-50/50 border-rose-200'
        : 'bg-white border-slate-200 hover:border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isClosed ? 'bg-emerald-100 text-emerald-600' : isLocked ? 'bg-slate-200 text-slate-400' : meta.chip
        }`}>
          {isClosed ? <CheckCircle2 className="w-4.5 h-4.5" />
            : isLocked ? <Lock className="w-4 h-4" />
            : <Icon className="w-4.5 h-4.5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {meta.label}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${statusMeta.chip}`}>
              {statusMeta.label}
            </span>
            {step.ownerRole !== 'employee' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                {OWNER_ROLE_LABELS[step.ownerRole].label}
              </span>
            )}
            {!step.isRequired && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                необов'язково
              </span>
            )}
          </div>

          <h4 className={`text-sm font-bold leading-tight ${isClosed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
            {step.title}
          </h4>
          {step.description && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.description}</p>
          )}
          {step.targetTitle && (
            <p className="text-[11px] text-blue-600 mt-1 truncate">{step.targetTitle}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
            {step.dueDate && (
              <span className={`inline-flex items-center gap-1 ${step.isOverdue ? 'text-rose-600 font-semibold' : ''}`}>
                <Clock className="w-3 h-3" />
                до {formatDateUa(step.dueDate)}
              </span>
            )}
            {step.estimatedMinutes > 0 && <span>~{step.estimatedMinutes} хв</span>}
            {isClosed && step.completedByName && (
              <span>Закрив: {step.completedByName}</span>
            )}
            {isClosed && step.completedAt && (
              <span>{formatDateUa(step.completedAt)}</span>
            )}
          </div>

          {step.comment && (
            <p className="text-[11px] text-slate-500 mt-1.5 italic">{step.comment}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isClosed && !isLocked && (
            <>
              {canOpenTarget && (
                <button
                  onClick={onOpenTarget}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                >
                  {step.type === 'link' ? <ExternalLink className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  Відкрити
                </button>
              )}
              {step.isMine && (
                <button
                  onClick={onComplete}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${
                    canOpenTarget
                      ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Circle className="w-3 h-3" />}
                  Виконано
                </button>
              )}
            </>
          )}

          {isLocked && (
            <span className="text-[10px] text-slate-400 text-right max-w-[120px] leading-tight">
              Відкриється після попередніх кроків
            </span>
          )}

          {canManageSteps && (
            <div className="flex items-center gap-1 mt-0.5">
              {!isClosed && (
                <button
                  onClick={onSkip}
                  disabled={busy}
                  title="Пропустити крок для цього співробітника"
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              )}
              {isClosed && (
                <button
                  onClick={onReopen}
                  disabled={busy}
                  title="Повернути крок у роботу"
                  className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================================
// Задачі, де користувач — відповідальний за чужий онбординг
// ==========================================================

const OwnerTasksSection: React.FC<{
  tasks: OnboardingOwnerTask[];
  busyStep: string | null;
  onComplete: (assignmentId: string, nodeId: string) => void;
}> = ({ tasks, busyStep, onComplete }) => (
  <section className="bg-white rounded-3xl border border-purple-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
        <Users className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          Ваші задачі з онбордінгу колег
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            {tasks.length}
          </span>
        </h3>
        <p className="text-xs text-slate-500">
          Кроки, які за схемою закриваєте ви як наставник, керівник або відповідальний
        </p>
      </div>
    </div>

    <div className="space-y-2.5">
      {tasks.map(task => {
        const meta = STEP_TYPE_META[task.type];
        const Icon = meta.icon;
        const busy = busyStep === task.nodeId;
        return (
          <div
            key={`${task.assignmentId}-${task.nodeId}`}
            className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border ${
              task.isOverdue ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.chip}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-tight">{task.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Для <strong className="text-slate-700">{task.employeeName}</strong> · {task.templateName}
                </p>
                {task.dueDate && (
                  <span className={`inline-flex items-center gap-1 text-[11px] mt-1 ${
                    task.isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'
                  }`}>
                    <Clock className="w-3 h-3" />
                    до {formatDateUa(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onComplete(task.assignmentId, task.nodeId)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition disabled:opacity-50 shrink-0"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Виконано
            </button>
          </div>
        );
      })}
    </div>
  </section>
);

const EmptyState: React.FC = () => (
  <div className="text-center py-20 px-6 bg-white rounded-3xl border border-slate-200">
    <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 mx-auto mb-4">
      <Rocket className="w-7 h-7" />
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2">Онбордінгів поки немає</h3>
    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
      Тут з'явиться ваш покроковий маршрут адаптації, щойно керівник або HR призначить його.
      Ви побачите, що читати, з ким познайомитись і в які строки — крок за кроком, без зайвого.
    </p>
  </div>
);
