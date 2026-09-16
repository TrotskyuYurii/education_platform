import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sun, 
  CalendarClock, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  BookOpen, 
  Award, 
  Briefcase, 
  Sparkles, 
  Search, 
  ShieldCheck, 
  ChevronRight, 
  FileText, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Flame, 
  TrendingUp,
  FileCheck,
  Zap,
  GraduationCap,
  Building2,
  Rocket,
  Lock,
  Users as UsersIcon
} from 'lucide-react';
import { InstructionSection, Course, UserProgress, KnowledgeSpace, LearningAssignment } from '../types';
import { User } from '../context/AuthContext';
import { ALL_UKRAINIAN_QUOTES, UkrainianQuote } from '../data/ukrainianQuotes';
import { AppTab } from './Navbar';

interface MyDayProps {
  user: User | null;
  progress: UserProgress;
  sections: InstructionSection[];
  courses: Course[];
  cases: any[];
  spaces: KnowledgeSpace[];
  onOpenCourse: (courseId: string) => void;
  onOpenInstruction: (sectionId: string, courseId?: string) => void;
  onStartQuiz: (type: 'all' | 'section' | 'course', id?: string) => void;
  onStartCases: (casesToRun?: any[]) => void;
  onNavigateToTab: (tab: AppTab) => void;
  onOpenSearch: () => void;
  onDismissNotification: (id: string) => void;
  primaryRoleLabel?: string;
  canManage?: boolean;
}

export const MyDay: React.FC<MyDayProps> = ({
  user,
  progress,
  sections,
  courses,
  cases,
  spaces,
  onOpenCourse,
  onOpenInstruction,
  onStartQuiz,
  onStartCases,
  onNavigateToTab,
  onOpenSearch,
  onDismissNotification,
  primaryRoleLabel,
  canManage = false,
}) => {
  // Assignments state
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  // Онбординг новачка та задачі, де користувач — наставник/відповідальний.
  const [onboardings, setOnboardings] = useState<any[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([]);

  // Quote of the day (initial index is based on day of year for consistency)
  const initialQuoteIndex = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return dayOfYear % ALL_UKRAINIAN_QUOTES.length;
  }, []);

  const [quoteIndex, setQuoteIndex] = useState(initialQuoteIndex);

  const currentQuote: UkrainianQuote = useMemo(() => {
    return ALL_UKRAINIAN_QUOTES[quoteIndex] || ALL_UKRAINIAN_QUOTES[0];
  }, [quoteIndex]);

  const handleNextQuote = () => {
    setQuoteIndex(prev => (prev + 1) % ALL_UKRAINIAN_QUOTES.length);
  };

  // Fetch assignments for the current employee
  const fetchMyAssignments = async () => {
    try {
      setLoadingAssignments(true);
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
      console.error('Failed to fetch assignments for My Day', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchOnboarding = async () => {
    try {
      const [myRes, tasksRes] = await Promise.all([
        fetch('/api/v2/onboarding/my'),
        fetch('/api/v2/onboarding/my/tasks')
      ]);
      if (myRes.ok) setOnboardings((await myRes.json()).onboardings || []);
      if (tasksRes.ok) setOnboardingTasks((await tasksRes.json()).tasks || []);
    } catch (err) {
      console.error('Failed to fetch onboarding for My Day', err);
    }
  };

  useEffect(() => {
    fetchMyAssignments();
    fetchOnboarding();
  }, []);

  // Показуємо лише те, що ще в роботі — завершений онбординг не має
  // займати місце на головній.
  const activeOnboarding = useMemo(
    () => onboardings.find((o: any) => o.status !== 'completed' && o.status !== 'cancelled') || null,
    [onboardings]
  );

  const onboardingNextSteps = useMemo(() => {
    if (!activeOnboarding) return [];
    return (activeOnboarding.steps || [])
      .filter((step: any) => step.isMine && (step.status === 'available' || step.status === 'in_progress'))
      .slice(0, 3);
  }, [activeOnboarding]);

  // Time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Доброго ранку';
    if (hour >= 12 && hour < 18) return 'Доброго дня';
    if (hour >= 18 && hour < 23) return 'Доброго вечора';
    return 'Доброї ночі';
  }, []);

  // Ukrainian formatted date
  const formattedTodayDate = useMemo(() => {
    const d = new Date();
    const str = new Intl.DateTimeFormat('uk-UA', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(d);
    // Capitalize first letter
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, []);

  // User display name
  const userName = user?.fullName || user?.email?.split('@')[0] || user?.username || 'Співробітник';

  // Resolve user department display name cleanly without exposing raw MongoDB ObjectIds or database codes
  const [departmentMap, setDepartmentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    fetch('/api/v2/org/departments')
      .then(r => (r.ok ? r.json() : []))
      .then((deps: any[]) => {
        if (isMounted && Array.isArray(deps)) {
          const map: Record<string, string> = {};
          deps.forEach(d => {
            if (d._id && d.name) map[String(d._id)] = d.name;
            if (d.id && d.name) map[String(d.id)] = d.name;
          });
          setDepartmentMap(map);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const departmentDisplay = useMemo(() => {
    // 1. Explicit departmentName on user object (provided by backend /api/auth/me)
    if (user?.departmentName && !/^[0-9a-fA-F]{24}$/.test(user.departmentName.trim())) {
      return user.departmentName.trim();
    }

    // 2. Populated object with name property
    const rawDept: any = user?.departmentId;
    if (rawDept && typeof rawDept === 'object' && rawDept.name) {
      return String(rawDept.name).trim();
    }

    // 3. Match raw departmentId in fetched departmentMap
    if (typeof rawDept === 'string' && departmentMap[rawDept.trim()]) {
      return departmentMap[rawDept.trim()];
    }

    // 4. Human-readable name from user.departments array (excluding 'Всі підрозділи' and 24-char hex IDs)
    if (Array.isArray(user?.departments)) {
      const specific = user?.departments.find(
        d => typeof d === 'string' && d.trim() !== 'Всі підрозділи' && !/^[0-9a-fA-F]{24}$/.test(d.trim())
      );
      if (specific) return specific.trim();
    }

    // 5. If rawDept is a non-hex human-readable department title
    if (typeof rawDept === 'string' && rawDept.trim() && !/^[0-9a-fA-F]{24}$/.test(rawDept.trim())) {
      return rawDept.trim();
    }

    // 6. Any non-hex title from user.departments
    const anyDept = user?.departments?.[0];
    if (typeof anyDept === 'string' && anyDept.trim() !== 'Всі підрозділи' && !/^[0-9a-fA-F]{24}$/.test(anyDept.trim())) {
      return anyDept.trim();
    }

    // If it's a 24-character hexadecimal ObjectId or unmapped code, NEVER display it
    return null;
  }, [user, departmentMap]);

  // Read progress metrics
  const totalSections = sections.length;
  const readCount = Math.min(progress.readSectionIds.length, totalSections);
  const readPercentage = totalSections > 0 ? Math.round((readCount / totalSections) * 100) : 0;

  // Assignments calculations
  const pendingAssignments = useMemo(() => {
    return assignments
      .filter(a => a.status !== 'completed')
      .sort((a, b) => {
        // Critical first
        const pOrder: Record<string, number> = { critical: 3, mandatory: 2, recommended: 1 };
        const pDiff = (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        // Then nearest due date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [assignments]);

  const overdueAssignments = useMemo(() => {
    return assignments.filter(a => a.status === 'overdue' || (a.status !== 'completed' && (a.daysRemaining || 0) < 0));
  }, [assignments]);

  const completedAssignmentsCount = useMemo(() => {
    return assignments.filter(a => a.status === 'completed').length;
  }, [assignments]);

  // "Continue Learning": detect active / in-progress courses
  const continueCourses = useMemo(() => {
    const readSet = new Set(progress.readSectionIds);
    const inProgressList: Array<{
      course: Course;
      readCount: number;
      totalCount: number;
      percent: number;
      nextSection?: InstructionSection;
      isPassed: boolean;
    }> = [];

    courses.forEach(c => {
      const cSecs = sections.filter(s => c.instructionIds?.includes(s.id));
      if (cSecs.length === 0) return;

      const cRead = cSecs.filter(s => readSet.has(s.id)).length;
      const percent = Math.round((cRead / cSecs.length) * 100);
      const nextUnread = cSecs.find(s => !readSet.has(s.id));
      const isPassed = (progress.quizHistory || []).some(h => (h.courseId === c.id || h.sectionId === c.id) && h.percentage >= (c.quizPassScorePercent || 80));

      if ((cRead > 0 && cRead < cSecs.length) || (cRead === cSecs.length && !isPassed)) {
        inProgressList.push({
          course: c,
          readCount: cRead,
          totalCount: cSecs.length,
          percent,
          nextSection: nextUnread,
          isPassed
        });
      }
    });

    return inProgressList;
  }, [courses, sections, progress.readSectionIds, progress.quizHistory]);

  // Next suggested standalone instruction if not started
  const nextSuggestedInstruction = useMemo(() => {
    const readSet = new Set(progress.readSectionIds);
    // Prefer user department or general
    const userDept = departmentDisplay || '';
    const deptSec = sections.find(s => !readSet.has(s.id) && userDept && s.department?.toLowerCase() === userDept.toLowerCase());
    if (deptSec) return deptSec;
    return sections.find(s => !readSet.has(s.id)) || sections[0];
  }, [sections, progress.readSectionIds, departmentDisplay]);

  // Recommended courses / materials
  const recommendedCourses = useMemo(() => {
    const readSet = new Set(progress.readSectionIds);
    return courses
      .filter(c => {
        const cSecs = sections.filter(s => c.instructionIds?.includes(s.id));
        const cRead = cSecs.filter(s => readSet.has(s.id)).length;
        return cRead < cSecs.length;
      })
      .slice(0, 3);
  }, [courses, sections, progress.readSectionIds]);

  // Compliance status items
  const isSigned = Boolean(progress.employeeInfo?.isSigned);
  const bestScore = progress.bestScore || 0;
  const isCertified = (progress.certificates && progress.certificates.length > 0) || bestScore >= 80;
  const activeCertsCount = progress.certificates?.length || 0;

  // Unread notifications
  const unreadNotifications = useMemo(() => {
    return (progress.notifications || []).filter(n => !n.read).slice(0, 3);
  }, [progress.notifications]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* ============================================================ */}
      {/* 1. HERO HEADER: Greeting, Context, Time, Quote & Quick Search */}
      {/* ============================================================ */}
      <section 
        id="myday-hero-section"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-700/60"
      >
        {/* Subtle decorative background glows */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            {/* Top Pills: Date & Role */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-200 backdrop-blur-xs border border-white/10">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                {formattedTodayDate}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                {primaryRoleLabel || (user?.role === 'admin' ? 'Адміністратор' : 'Співробітник')}
              </span>
              {departmentDisplay && (
                <span 
                  id="myday-user-department-pill"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{departmentDisplay}</span>
                </span>
              )}
            </div>

            {/* Main Greeting */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">{userName}</span>!
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
              Ваш персональний центр навчання та регламентів компанії <strong>«ВІАТЕК»</strong> на сьогодні.
            </p>

            {/* Ukrainian Quote of the Day */}
            <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xs flex items-start gap-3 relative group">
              <div className="text-2xl select-none shrink-0 mt-0.5">{currentQuote.emoji}</div>
              <div className="grow pr-8">
                <p className="text-xs sm:text-sm text-slate-200 italic font-medium leading-relaxed">
                  «{currentQuote.text}»
                </p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  — {currentQuote.author}
                </p>
              </div>
              <button
                id="myday-btn-refresh-quote"
                onClick={handleNextQuote}
                title="Інша цитата дня"
                className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Omnisearch & Portal Search Trigger */}
          <div className="lg:max-w-xs w-full flex flex-col gap-3">
            <button
              id="myday-btn-search"
              onClick={onOpenSearch}
              className="w-full text-left p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md transition shadow-md group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/40 text-blue-300 flex items-center justify-center group-hover:scale-105 transition">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                    Пошук знань
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Регламенти, тести, кейси
                  </div>
                </div>
              </div>
              <kbd className="px-2 py-1 text-[10px] font-mono font-bold bg-white/20 rounded border border-white/20 text-white group-hover:bg-blue-600 transition">
                ⌘K
              </kbd>
            </button>

            {/* Quick Action Button to Learning Catalog */}
            <button
              id="myday-btn-open-catalog"
              onClick={() => onNavigateToTab('catalog')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition group"
            >
              <BookOpen className="w-4 h-4" />
              <span>Перейти до навчальних матеріалів</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. DAILY SNAPSHOT: 4 Key Metrics Cards */}
      {/* ============================================================ */}
      <section id="myday-metrics-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Metric 1: Assignments */}
        <div 
          id="metric-card-assignments"
          onClick={() => {
            const el = document.getElementById('myday-assignments-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Призначення</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              overdueAssignments.length > 0 
                ? 'bg-rose-50 text-rose-600' 
                : pendingAssignments.length > 0 
                ? 'bg-amber-50 text-amber-600' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {pendingAssignments.length}
            </div>
            <div className="text-xs mt-1">
              {overdueAssignments.length > 0 ? (
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {overdueAssignments.length} прострочено!
                </span>
              ) : pendingAssignments.length > 0 ? (
                <span className="text-slate-500 font-medium">очікують виконання</span>
              ) : (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Всі завдання виконано
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Progress */}
        <div 
          id="metric-card-progress"
          onClick={() => onNavigateToTab('catalog')}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Прогрес вивчення</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {readPercentage}%
            </div>
            <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${readPercentage}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
              <span>{readCount} з {totalSections} матеріалів</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Best Quiz Score */}
        <div 
          id="metric-card-quiz-score"
          onClick={() => onNavigateToTab('quiz')}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Рівень знань (Квіз)</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              bestScore >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {bestScore > 0 ? `${bestScore}%` : '—'}
            </div>
            <div className="text-xs mt-1">
              {bestScore >= 80 ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Атестацію складено
                </span>
              ) : bestScore > 0 ? (
                <span className="text-amber-600 font-medium">Потрібно від 80%</span>
              ) : (
                <span className="text-slate-500 font-medium">Тест ще не пройдено</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 4: Compliance Status */}
        <div 
          id="metric-card-compliance"
          onClick={() => onNavigateToTab('signoff')}
          className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Комплаєнс-підпис</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-1.5">
              {isSigned ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Підписано
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Очікує підпис
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {isSigned 
                ? `Ознайомлено: ${progress.employeeInfo.signedDate || 'Зафіксовано'}`
                : 'Потрібно підтвердити лист'}
            </div>
          </div>
        </div>

      </section>

      {/* ============================================================ */}
      {/* 3. UNREAD NOTIFICATIONS ALERT (If any) */}
      {/* ============================================================ */}
      {unreadNotifications.length > 0 && (
        <section id="myday-notifications-section" className="space-y-2">
          {unreadNotifications.map(notif => (
            <div 
              key={notif.id}
              className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Важливе сповіщення</h4>
                  <p className="text-xs text-amber-800 mt-0.5">{notif.message}</p>
                  <span className="text-[10px] text-amber-600 mt-1 block">
                    {new Date(notif.date).toLocaleString('uk-UA')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDismissNotification(notif.id)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-md hover:bg-amber-200/60 transition"
              >
                Закрити
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ============================================================ */}
      {/* 4. MAIN ACTION CENTER: Priorities, Assignments, In-Progress */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Priority Assignments & Continue Learning */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section: Onboarding journey for new hires */}
          {activeOnboarding && (
            <section id="myday-onboarding-section" className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-200 p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-blue-600">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Ваш онбординг</h2>
                    <p className="text-xs text-slate-600">
                      {activeOnboarding.templateName} - крок {activeOnboarding.completedSteps} з {activeOnboarding.totalSteps}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{activeOnboarding.progressPercent}%</div>
                  <div className="w-24 h-1.5 bg-white rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${activeOnboarding.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {onboardingNextSteps.length > 0 ? (
                <div className="space-y-2.5">
                  {onboardingNextSteps.map((step: any) => (
                    <div
                      key={step.nodeId}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border ${
                        step.isOverdue ? 'border-rose-200' : 'border-blue-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{step.title}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          {step.dueDate && (
                            <span className={step.isOverdue ? 'text-rose-600 font-semibold' : ''}>
                              до {new Date(step.dueDate).toLocaleDateString('uk-UA')}
                            </span>
                          )}
                          {step.estimatedMinutes > 0 && <span>~{step.estimatedMinutes} хв</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigateToTab('onboarding')}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <span>Перейти</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-white border border-blue-100 text-xs text-slate-500">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Поточні кроки закрито. Наступні відкриються, щойно відповідальні завершать свою частину.
                  </span>
                </div>
              )}

              <button
                onClick={() => onNavigateToTab('onboarding')}
                className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-900 transition flex items-center gap-1"
              >
                <span>Відкрити весь маршрут</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </section>
          )}

          {/* Section: Onboarding steps this user owns for colleagues */}
          {onboardingTasks.length > 0 && (
            <section id="myday-onboarding-tasks-section" className="bg-white rounded-3xl border border-purple-200 p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <UsersIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Онбординг колег</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {onboardingTasks.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Кроки, за які ви відповідаєте як наставник або керівник
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {onboardingTasks.slice(0, 3).map((task: any) => (
                  <div
                    key={`${task.assignmentId}-${task.nodeId}`}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border ${
                      task.isOverdue ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{task.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Для <strong className="text-slate-700">{task.employeeName}</strong>
                        {task.dueDate && (
                          <span className={task.isOverdue ? 'text-rose-600 font-semibold' : ''}>
                            {' - до '}{new Date(task.dueDate).toLocaleDateString('uk-UA')}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigateToTab('onboarding')}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
                    >
                      Відкрити
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Priority Assignments from Manager */}
          <section id="myday-assignments-section" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Пріоритетні завдання від керівника</span>
                    {pendingAssignments.length > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {pendingAssignments.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Обов'язкові до вивчення регламенти та курси з фіксованим строком
                  </p>
                </div>
              </div>

              {canManage && (
                <button
                  id="myday-btn-manage-assignments"
                  onClick={() => onNavigateToTab('management')}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl border border-purple-200 transition"
                >
                  <span>Керувати призначеннями</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loadingAssignments ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Завантаження завдань...
              </div>
            ) : pendingAssignments.length > 0 ? (
              <div className="space-y-3.5">
                {pendingAssignments.map(item => {
                  const isOverdue = item.status === 'overdue' || (item.daysRemaining || 0) < 0;
                  const isCritical = item.priority === 'critical';
                  const isMandatory = item.priority === 'mandatory';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isOverdue
                          ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
                          : isCritical
                          ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                          : 'bg-slate-50/60 border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              item.targetType === 'course' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-teal-100 text-teal-700'
                            }`}>
                              {item.targetType === 'course' ? 'Курс' : 'Регламент'}
                            </span>

                            {isCritical ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> 🚨 Терміново
                              </span>
                            ) : isMandatory ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                📌 Обов'язково
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                💡 Рекомендовано
                              </span>
                            )}

                            {isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                                Прострочено на {Math.abs(item.daysRemaining || 0)} дн.
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-slate-900 leading-snug">
                            {item.title}
                          </h3>

                          {item.notes && (
                            <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 mt-2">
                              <strong className="text-indigo-600">Вказівка керівника: </strong>
                              {item.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-slate-700 flex items-center sm:justify-end gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Дедлайн: {new Date(item.dueDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          {!isOverdue && item.daysRemaining !== undefined && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              (залишилося {item.daysRemaining} дн.)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                          Призначив: <strong className="text-slate-700">{item.assignedByName || 'Керівник'}</strong>
                        </span>

                        <button
                          id={`myday-start-assignment-${item.id}`}
                          onClick={() => {
                            if (item.targetType === 'course') {
                              onOpenCourse(item.targetId);
                            } else {
                              onOpenInstruction(item.targetId);
                            }
                          }}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs ${
                            isCritical || isOverdue
                              ? 'bg-rose-600 hover:bg-rose-500'
                              : 'bg-blue-600 hover:bg-blue-500'
                          }`}
                        >
                          <span>Розпочати навчання</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-emerald-900">
                  Усі завдання виконано!
                </h3>
                <p className="text-xs text-emerald-700 max-w-md mt-1">
                  На сьогодні у вас немає термінових обов'язкових призначень від керівника. Ви можете продовжувати вільне проходження курсів або закріпити знання у квізах.
                </p>
                {completedAssignmentsCount > 0 && (
                  <span className="text-[11px] font-bold text-emerald-800 mt-2 bg-emerald-100 px-2.5 py-1 rounded-full">
                    🎉 Успішно завершено завдань: {completedAssignmentsCount}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Section: Continue Learning (In-Progress) */}
          <section id="myday-continue-learning-section" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Продовжити навчання
                  </h2>
                  <p className="text-xs text-slate-500">
                    Матеріали, які ви розпочали вивчати
                  </p>
                </div>
              </div>

              <button
                id="myday-btn-all-courses"
                onClick={() => onNavigateToTab('catalog')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                <span>Усі курси ({courses.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {continueCourses.length > 0 ? (
              <div className="space-y-3.5">
                {continueCourses.map(item => (
                  <div 
                    key={item.course.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {item.course.department || 'Загальний курс'}
                        </span>
                        {item.course.isProgressive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            🔒 Послідовні кроки
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-500">
                          {item.readCount} з {item.totalCount} уроків ({item.percent}%)
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">
                        {item.course.title}
                      </h3>

                      <div className="mt-2 w-full max-w-md bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>

                      {item.nextSection && (
                        <p className="text-xs text-slate-500 mt-2">
                          Наступний урок: <strong className="text-slate-800">{item.nextSection.title}</strong>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        id={`myday-continue-course-${item.course.id}`}
                        onClick={() => {
                          if (item.nextSection) {
                            onOpenInstruction(item.nextSection.id, item.course.id);
                          } else {
                            onOpenCourse(item.course.id);
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
                      >
                        <span>Продовжити</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`myday-quiz-course-${item.course.id}`}
                        onClick={() => onStartQuiz('course', item.course.id)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                        title="Скласти квіз за цим курсом"
                      >
                        <Award className="w-4 h-4 text-amber-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : nextSuggestedInstruction ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase tracking-wider">
                    Рекомендований регламент
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">
                    {nextSuggestedInstruction.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {nextSuggestedInstruction.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                    <span>Підрозділ: <strong className="text-slate-600">{nextSuggestedInstruction.department}</strong></span>
                    <span>•</span>
                    <span>Час на вивчення: ~{nextSuggestedInstruction.readTimeMin || 5} хв</span>
                  </div>
                </div>

                <button
                  id="myday-btn-start-next-instruction"
                  onClick={() => onOpenInstruction(nextSuggestedInstruction.id)}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
                >
                  <span>Почати вивчення</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                Усі доступні курси та регламенти повністю вивчено!
              </div>
            )}
          </section>

          {/* Section: Recommended Learning for Your Role / Department */}
          {recommendedCourses.length > 0 && (
            <section id="myday-recommended-section" className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Рекомендовані курси компанії
                    </h2>
                    <p className="text-xs text-slate-500">
                      Програми підвищення кваліфікації та корпоративних стандартів
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {recommendedCourses.map(course => (
                  <div 
                    key={course.id}
                    onClick={() => onOpenCourse(course.id)}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 hover:bg-teal-50/20 transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                        {course.department || 'Компанія'}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2 group-hover:text-teal-700 transition">
                        {course.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {course.instructionIds?.length || 0} регламентів
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-teal-600 font-semibold">
                      <span>Відкрити курс</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Right 1 Column: Daily Compliance Checklist, Quick Launch & Stats */}
        <div className="space-y-8">
          
          {/* Section: Daily Compliance Checklist */}
          <section id="myday-compliance-checklist" className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Чеклист комплаєнсу
                </h3>
                <p className="text-xs text-slate-500">
                  Корпоративні вимоги та готовність
                </p>
              </div>
            </div>

            <div className="space-y-3">
              
              {/* Item 1: E-Signature */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isSigned ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isSigned ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Підпис ознайомлення
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isSigned ? 'Зафіксовано в системі' : 'Очікує вашого підпису'}
                    </div>
                  </div>
                </div>

                <button
                  id="myday-checklist-btn-signoff"
                  onClick={() => onNavigateToTab('signoff')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    isSigned 
                      ? 'text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-100' 
                      : 'text-white bg-amber-600 hover:bg-amber-500 shadow-xs'
                  }`}
                >
                  {isSigned ? 'Перевірити' : 'Підписати'}
                </button>
              </div>

              {/* Item 2: Knowledge Assessment */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                bestScore >= 80 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    bestScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Атестаційний квіз
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {bestScore >= 80 ? `Складено на ${bestScore}%` : 'Поріг успішності: 80%'}
                    </div>
                  </div>
                </div>

                <button
                  id="myday-checklist-btn-quiz"
                  onClick={() => onNavigateToTab('quiz')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  {bestScore >= 80 ? 'Повторити' : 'Скласти'}
                </button>
              </div>

              {/* Item 3: Practical Cases */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Практичні кейси
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cases.length} ситуацій для тренування
                    </div>
                  </div>
                </div>

                <button
                  id="myday-checklist-btn-cases"
                  onClick={() => onStartCases(cases)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  Тренувати
                </button>
              </div>

              {/* Item 4: Knowledge Base Review */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Вивчення регламентів
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {readCount} з {totalSections} прочитано
                    </div>
                  </div>
                </div>

                <button
                  id="myday-checklist-btn-catalog"
                  onClick={() => onNavigateToTab('catalog')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                >
                  Каталог
                </button>
              </div>

            </div>
          </section>

          {/* Section: Quick Action Launchpad */}
          <section id="myday-quick-actions" className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Швидкі дії</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="myday-quick-btn-manuals"
                onClick={() => onNavigateToTab('catalog')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition text-left group"
              >
                <BookOpen className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition" />
                <div className="text-xs font-bold text-slate-900">Регламенти</div>
                <div className="text-[10px] text-slate-500">База інструкцій</div>
              </button>

              <button
                id="myday-quick-btn-quiz"
                onClick={() => onNavigateToTab('quiz')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition text-left group"
              >
                <Award className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition" />
                <div className="text-xs font-bold text-slate-900">Тестування</div>
                <div className="text-[10px] text-slate-500">Перевірка знань</div>
              </button>

              <button
                id="myday-quick-btn-cases"
                onClick={() => onStartCases(cases)}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 transition text-left group"
              >
                <Briefcase className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition" />
                <div className="text-xs font-bold text-slate-900">Симуляції</div>
                <div className="text-[10px] text-slate-500">Робочі кейси</div>
              </button>

              <button
                id="myday-quick-btn-search"
                onClick={onOpenSearch}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 transition text-left group"
              >
                <Search className="w-5 h-5 text-teal-600 mb-2 group-hover:scale-110 transition" />
                <div className="text-xs font-bold text-slate-900">Пошук ⌘K</div>
                <div className="text-[10px] text-slate-500">Повнотекстовий</div>
              </button>

              <button
                id="myday-quick-btn-profile"
                onClick={() => onNavigateToTab('dashboard')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition text-left group"
              >
                <GraduationCap className="w-5 h-5 text-rose-600 mb-2 group-hover:scale-110 transition" />
                <div className="text-xs font-bold text-slate-900">Сертифікати</div>
                <div className="text-[10px] text-slate-500">Мій профіль</div>
              </button>

              {canManage && (
                <button
                  id="myday-quick-btn-admin"
                  onClick={() => onNavigateToTab('management')}
                  className="p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition text-left group"
                >
                  <ShieldCheck className="w-5 h-5 text-purple-700 mb-2 group-hover:scale-110 transition" />
                  <div className="text-xs font-bold text-purple-950">Управління</div>
                  <div className="text-[10px] text-purple-700">Панель адміна</div>
                </button>
              )}
            </div>
          </section>

          {/* Section: Recent Quiz Scores or Mini Stats */}
          {progress.quizHistory && progress.quizHistory.length > 0 && (
            <section id="myday-recent-scores" className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Останні спроби тестування
                </h4>
                <button
                  onClick={() => onNavigateToTab('dashboard')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Уся історія
                </button>
              </div>

              <div className="space-y-2.5">
                {progress.quizHistory.slice(-3).reverse().map((h, i) => (
                  <div 
                    key={`hist-${i}`}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {h.department || 'Тестування'} {h.mode === 'cases' ? '(Кейси)' : ''}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(h.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`font-bold px-2 py-0.5 rounded-lg ${
                      h.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {h.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

      </div>

    </div>
  );
};
