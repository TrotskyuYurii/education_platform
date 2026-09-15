import React, { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  BookOpen, 
  FileText, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { LearningAssignment } from '../types';

interface MyAssignmentsWidgetProps {
  onOpenCourse: (courseId: string) => void;
  onOpenInstruction?: (sectionId: string) => void;
}

export const MyAssignmentsWidget: React.FC<MyAssignmentsWidgetProps> = ({
  onOpenCourse,
  onOpenInstruction
}) => {
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchMyAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/progress-v2/assignments');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
      }
    } catch (err) {
      console.error('Failed to load my assignments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAssignments();
  }, []);

  if (loading || assignments.length === 0) {
    return null;
  }

  const pendingAssignments = assignments.filter(a => a.status !== 'completed');
  const completedCount = assignments.filter(a => a.status === 'completed').length;
  const overdueCount = assignments.filter(a => a.status === 'overdue' || (a.status !== 'completed' && (a.daysRemaining || 0) < 0)).length;

  const handleStart = (item: LearningAssignment) => {
    if (item.targetType === 'course') {
      onOpenCourse(item.targetId);
    } else if (onOpenInstruction) {
      onOpenInstruction(item.targetId);
    } else {
      onOpenCourse(item.targetId);
    }
  };

  return (
    <div className="mb-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/60 overflow-hidden relative">
      {/* Decorative background glow */}
      <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white">
                Мої обов'язкові призначення
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {pendingAssignments.length} активних
              </span>
              {overdueCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueCount} прострочено!
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Навчальні матеріали та регламенти, призначені керівником з визначеним терміном виконання
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start sm:self-center flex items-center gap-1 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 transition border border-slate-700"
        >
          <span>{isExpanded ? 'Згорнути' : `Показати всі (${assignments.length})`}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Assignments List */}
      {isExpanded && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
          {assignments.map(item => {
            const isCompleted = item.status === 'completed';
            const isOverdue = !isCompleted && (item.status === 'overdue' || (item.daysRemaining || 0) < 0);

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  isCompleted
                    ? 'bg-slate-800/40 border-slate-700/50 opacity-80'
                    : isOverdue
                    ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-500/70'
                    : 'bg-slate-800/70 border-slate-700 hover:border-blue-500/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {/* Material type & icon */}
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/10 text-slate-300">
                        {item.targetType === 'course' ? (
                          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-teal-400" />
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {item.targetType === 'course' ? 'Курс' : 'Регламент'}
                      </span>
                    </div>

                    {/* Priority Badge */}
                    <div>
                      {item.priority === 'critical' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          🚨 Терміново
                        </span>
                      )}
                      {item.priority === 'mandatory' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          📌 Обов'язково
                        </span>
                      )}
                      {item.priority === 'recommended' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          💡 Рекомендовано
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-sm text-white line-clamp-1 mb-1.5">
                    {item.title}
                  </h4>

                  {/* Manager's note if any */}
                  {item.notes && (
                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800 mb-2.5 line-clamp-2">
                      <span className="text-blue-300 font-semibold">Вказівка: </span>
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Footer with deadline and action button */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Виконано {item.score !== undefined ? `(${item.score}%)` : ''}</span>
                      </div>
                    ) : isOverdue ? (
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Прострочено на {Math.abs(item.daysRemaining || 0)} дн.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Дедлайн: {new Date(item.dueDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })} ({item.daysRemaining} дн.)
                        </span>
                      </div>
                    )}
                  </div>

                  {!isCompleted ? (
                    <button
                      onClick={() => handleStart(item)}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 ${
                        isOverdue
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                      }`}
                    >
                      <span>{item.status === 'in_progress' ? 'Продовжити' : 'Розпочати'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(item)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline font-medium transition"
                    >
                      Повторити
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
