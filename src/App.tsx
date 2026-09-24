import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Navbar, AppTab } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { useAuth } from './context/AuthContext';
import { AiImportJobsProvider } from './context/AiImportJobsContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { AiImportProgressWidget } from './components/AiImportProgressWidget';
import { InstructionSection, QuizQuestion, UserProgress, KnowledgeSpace, SearchResultItem } from './types';
import { Info, Search } from 'lucide-react';
import { trackNavigation } from './utils/activityTracker';
import type { CaseRunResult } from './components/CaseSimulator';

// Вкладки вантажаться на вимогу: разом вони тягнуть recharts, @xyflow, html2pdf
// та react-markdown — кілька мегабайт, які на старті потрібні лише одній вкладці.
// Кожен lazy-імпорт указує на конкретний файл, а не на barrel-індекс, інакше
// Rollup затягнув би сусідні важкі модулі в той самий чанк.
const InstructionViewer = lazy(() => import('./components/InstructionViewer').then(m => ({ default: m.InstructionViewer })));
const QuizRunner = lazy(() => import('./components/QuizRunner').then(m => ({ default: m.QuizRunner })));
const CaseSimulator = lazy(() => import('./components/CaseSimulator').then(m => ({ default: m.CaseSimulator })));
const AcknowledgmentForm = lazy(() => import('./components/AcknowledgmentForm').then(m => ({ default: m.AcknowledgmentForm })));
const TestManagement = lazy(() => import('./components/TestManagement').then(m => ({ default: m.TestManagement })));
const CourseCatalog = lazy(() => import('./components/CourseCatalog').then(m => ({ default: m.CourseCatalog })));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const AboutApp = lazy(() => import('./components/AboutApp').then(m => ({ default: m.AboutApp })));
const GlobalSearchModal = lazy(() => import('./components/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })));
const MyDay = lazy(() => import('./components/MyDay').then(m => ({ default: m.MyDay })));
const MyOnboarding = lazy(() => import('./components/Onboarding/MyOnboarding').then(m => ({ default: m.MyOnboarding })));
const NotificationSettingsModal = lazy(() => import('./components/NotificationSettingsModal').then(m => ({ default: m.NotificationSettingsModal })));

// Нейтральна заглушка на час підвантаження чанка вкладки: тримає висоту
// сторінки, щоб футер не стрибав угору й назад.
function TabFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      <span className="sr-only">Завантаження розділу…</span>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Перевірка сесії..." />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <MainApp />;
}

function MainApp() {
  const { user, logout, canManage, primaryRoleLabel, hasPermission } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('viatec_current_tab') as AppTab;
      if (saved && ['myday', 'catalog', 'manual', 'quiz', 'cases', 'onboarding', 'signoff', 'management', 'about', 'dashboard'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'myday';
  });

  useEffect(() => {
    try {
      localStorage.setItem('viatec_current_tab', currentTab);
    } catch {}
  }, [currentTab]);

  // Журнал дій: куди переходив користувач. Адміністрування записує свої
  // підрозділи саме (management:users тощо), тож тут його пропускаємо.
  useEffect(() => {
    if (currentTab !== 'management') trackNavigation(currentTab);
  }, [currentTab]);
  
  const [sections, setSections] = useState<InstructionSection[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    readSectionIds: [],
    quizCompleted: false,
    bestScore: 0,
    totalQuestionsAnswered: 0,
    employeeInfo: {
      fullName: '',
      position: '',
      department: '',
      signedDate: '',
      isSigned: false,
      signatureHash: '',
    },
    quizHistory: [],
    certificates: [],
    notifications: [],
  });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeQuizSectionId, setActiveQuizSectionId] = useState<string | undefined>(undefined);
  const [activeQuizCourseId, setActiveQuizCourseId] = useState<string | undefined>(undefined);
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(undefined);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(undefined);
  const [activeCasesToRun, setActiveCasesToRunState] = useState<any[]>([]);
  // Курс, з якого запущено кейси: результат потрапляє в історію під його назвою.
  const [activeCasesCourseId, setActiveCasesCourseId] = useState<string | undefined>(undefined);
  const setActiveCasesToRun = (list: any[], courseId?: string) => {
    setActiveCasesToRunState(list);
    setActiveCasesCourseId(courseId);
  };
  const [caseSimulatorMode, setCaseSimulatorMode] = useState<'list' | 'run'>('run');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  // Коли керівник/HR відкриває маршрут конкретного співробітника зі звіту,
  // вкладка «Онбординг» показує його проходження замість власного.
  const [onboardingFocusId, setOnboardingFocusId] = useState<string | null>(null);
  // Клік по індикатору тривоги має відкрити саме вкладку журналу, а не ту, що збереглась з минулого разу.
  const [mgmtInitialTab, setMgmtInitialTab] = useState<'systemlog' | undefined>(undefined);
  const [onboardingPendingCount, setOnboardingPendingCount] = useState(0);

  // Global hotkey Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigateToSearchResult = (item: SearchResultItem) => {
    setIsSearchOpen(false);
    if (item.type === 'instruction' || item.type === 'glossary') {
      if (item.courseId) setActiveCourseId(item.courseId);
      if (item.sectionId) setSelectedSectionId(item.sectionId);
      setCurrentTab('manual');
    } else if (item.type === 'question') {
      if (item.courseId) setActiveQuizCourseId(item.courseId);
      if (item.sectionId) setActiveQuizSectionId(item.sectionId);
      setCurrentTab('quiz');
    } else if (item.type === 'case') {
      if (item.id) {
        const foundCase = cases.find(c => c.id === item.id);
        if (foundCase) {
          setActiveCasesToRun([foundCase]);
          setCaseSimulatorMode('run');
        } else {
          setActiveCasesToRun(cases.filter(c => c.isActive !== false));
          setCaseSimulatorMode('list');
        }
      } else {
        setActiveCasesToRun(cases.filter(c => c.isActive !== false));
        setCaseSimulatorMode('list');
      }
      setCurrentTab('cases');
    } else if (item.type === 'course') {
      setActiveCourseId(item.id);
      setCurrentTab('manual');
    }
  };

  // Compute clean and valid read section IDs (filters out obsolete deleted sections and duplicates)
  const validSectionIdsSet = useMemo(() => new Set(sections.map(s => s.id)), [sections]);

  const validReadSectionIds = useMemo(() => {
    const seen = new Set<string>();
    const valid: string[] = [];
    for (const id of progress.readSectionIds) {
      if (validSectionIdsSet.has(id) && !seen.has(id)) {
        seen.add(id);
        valid.push(id);
      }
    }
    return valid;
  }, [progress.readSectionIds, validSectionIdsSet]);

  const fetchContent = async () => {
    try {
      const res = await fetch('/api/content');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
        setQuestions(data.questions || []);
        setCourses(data.courses || []);
        setCases(data.cases || []);
        setSpaces(data.spaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch content', err);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/progress');
      const data = await res.json();
      if (res.ok && data.progress) {
        const historyList = data.progress.quizHistory || data.progress.testScores || [];
        setProgress(prev => ({
          ...prev,
          readSectionIds: data.progress.readSectionIds || [],
          quizHistory: historyList,
          certificates: data.progress.certificates || [],
          notifications: data.progress.notifications || [],
          employeeInfo: data.progress.employeeInfo || prev.employeeInfo,
          bestScore: data.progress.bestScore !== undefined 
            ? data.progress.bestScore 
            : (historyList.length > 0 ? Math.max(0, ...historyList.map((s: any) => s.percentage || 0)) : 0),
          totalQuestionsAnswered: data.progress.totalQuestionsAnswered !== undefined
            ? data.progress.totalQuestionsAnswered
            : historyList.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
        }));
      }
    } catch (err) {
      console.error('Failed to fetch progress', err);
    }
  };

  // Лічильник для бейджа вкладки «Онбординг»: власні відкриті кроки плюс кроки,
  // де користувач — відповідальний за чужий онбординг.
  const fetchOnboardingPending = async () => {
    try {
      const [myRes, tasksRes] = await Promise.all([
        fetch('/api/v2/onboarding/my'),
        fetch('/api/v2/onboarding/my/tasks')
      ]);
      let count = 0;
      if (myRes.ok) {
        const data = await myRes.json();
        for (const onboarding of data.onboardings || []) {
          count += (onboarding.steps || []).filter(
            (step: any) => step.isMine && (step.status === 'available' || step.status === 'in_progress')
          ).length;
        }
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        count += (data.tasks || []).length;
      }
      setOnboardingPendingCount(count);
    } catch (err) {
      console.error('Failed to fetch onboarding pending count', err);
    }
  };

  // Фонове опитування має сенс лише поки вкладку видно. У згорнутому вікні воно
  // дарма навантажує сервер і тримає з'єднання: кожен користувач інакше робив би
  // 240 зайвих запитів на годину. Повернення на вкладку одразу оновлює дані,
  // тож користувач не бачить застарілого стану.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([fetchContent(), fetchProgress()]).then(() => setDataLoaded(true));
    fetchOnboardingPending();

    const poll = () => {
      fetchProgress();
      fetchOnboardingPending();
    };

    const startPolling = () => {
      if (pollRef.current !== null) return;
      pollRef.current = setInterval(poll, 15000);
    };

    const stopPolling = () => {
      if (pollRef.current === null) return;
      clearInterval(pollRef.current);
      pollRef.current = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Sync progress on switching to catalog or dashboard
  useEffect(() => {
    if (currentTab === 'catalog' || currentTab === 'dashboard') {
      fetchProgress();
    }
  }, [currentTab]);

  // When sections or progress load, clean up any obsolete/deleted section IDs from progress
  useEffect(() => {
    if (dataLoaded && sections.length > 0 && progress.readSectionIds.length > 0) {
      if (progress.readSectionIds.length !== validReadSectionIds.length) {
        setProgress(prev => ({ ...prev, readSectionIds: validReadSectionIds }));
        saveProgressToDb(validReadSectionIds);
      }
    }
  }, [dataLoaded, sections, validReadSectionIds, progress.readSectionIds.length]);

  const saveProgressToDb = async (readIds?: string[], testScore?: any, employeeInfo?: any) => {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readSectionIds: readIds, testScore, employeeInfo })
      });
    } catch (err) {
      console.error('Failed to save progress', err);
    }
  };

  const handleToggleReadSection = (sectionId: string) => {
    // Only allow toggling if section exists
    if (!validSectionIdsSet.has(sectionId)) return;
    
    setProgress((prev) => {
      const exists = prev.readSectionIds.includes(sectionId);
      const updated = exists
        ? prev.readSectionIds.filter((id) => id !== sectionId && validSectionIdsSet.has(id))
        : Array.from(new Set([...prev.readSectionIds.filter(id => validSectionIdsSet.has(id)), sectionId]));
      
      saveProgressToDb(updated);
      return { ...prev, readSectionIds: updated };
    });
  };


  const dismissNotification = async (notifId: string) => {
    // Optimistically update UI
    setProgress(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.id !== notifId)
    }));
    
    // Call API
    try {
      await fetch(`/api/progress/notifications/${notifId}/read`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleStartQuiz = (type: 'all' | 'section' | 'course', id?: string) => {
    setActiveQuizSectionId(type === 'section' ? id : undefined);
    setActiveQuizCourseId(type === 'course' ? id : undefined);
    setCurrentTab('quiz');
  };

  const handleOpenCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setCurrentTab('manual');
  };

  const handleRecordScore = (
    score: number,
    total: number,
    modeName: string,
    department?: string,
    courseId?: string,
    sectionId?: string,
    timing?: { startedAt: string; durationSec: number }
  ) => {
    const percentage = Math.round((score / total) * 100);
    const scoreRec = {
      score,
      total,
      percentage,
      mode: modeName,
      department,
      courseId,
      sectionId,
      startedAt: timing?.startedAt,
      durationSec: timing?.durationSec,
      date: new Date().toISOString()
    };
    
    saveProgressToDb(undefined, scoreRec);

    setProgress((prev) => {
      let updatedCertificates = [...(prev.certificates || [])];
      
      // If passed course that has a certificate, add to local state immediately
      if (percentage >= 80 && courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course && course.hasCertificate) {
          const validityYears = course.certificateValidityYears || 1;
          const issuedAt = new Date();
          const expiresAt = new Date();
          expiresAt.setFullYear(issuedAt.getFullYear() + validityYears);
          
          const existingIndex = updatedCertificates.findIndex(c => c.courseId === course.id);
          if (existingIndex >= 0) {
            updatedCertificates[existingIndex] = { ...updatedCertificates[existingIndex], issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
          } else {
            updatedCertificates.push({
              courseId: course.id,
              courseTitle: course.title,
              issuedAt: issuedAt.toISOString(),
              expiresAt: expiresAt.toISOString()
            });
          }
        }
      }

      return {
        ...prev,
        quizCompleted: true,
        bestScore: Math.max(prev.bestScore || 0, percentage),
        totalQuestionsAnswered: (prev.totalQuestionsAnswered || 0) + total,
        certificates: updatedCertificates,
        quizHistory: [
          {
            date: new Date().toLocaleDateString('uk-UA'),
            score,
            total,
            mode: modeName,
            percentage,
            department,
            courseId,
            sectionId,
          },
          ...prev.quizHistory,
        ],
      };
    });
  };

  /**
   * Результат кейсів іде в історію окремим видом спроби (mode: 'cases'). Він не
   * впливає на найкращий бал тесту, підпис ознайомлення чи сертифікати — це
   * тренажер, а не атестація.
   */
  const handleRecordCases = (result: CaseRunResult) => {
    const percentage = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const course = activeCasesCourseId ? courses.find(c => c.id === activeCasesCourseId) : undefined;
    const caseDepartments = new Set(
      result.caseIds
        .map(id => cases.find(c => c.id === id)?.sectionId)
        .map(secId => sections.find(s => s.id === secId)?.department)
        .filter(Boolean)
    );
    const department = course?.department
      || (caseDepartments.size === 1 ? (Array.from(caseDepartments)[0] as string) : undefined);
    const scoreRec = {
      score: result.score,
      total: result.total,
      percentage,
      mode: 'cases',
      department,
      courseId: course?.id,
      startedAt: result.startedAt,
      durationSec: result.durationSec,
      date: new Date().toISOString()
    };
    saveProgressToDb(undefined, scoreRec);
    setProgress(prev => ({
      ...prev,
      quizHistory: [
        { ...scoreRec, date: new Date().toLocaleDateString('uk-UA') },
        ...prev.quizHistory
      ]
    }));
  };

  const handleSaveProfile = async (profile: UserProgress['employeeInfo']): Promise<void> => {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeInfo: profile })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Не вдалося зберегти підпис. Спробуйте ще раз.');
    }
    // Trust the server's view of employeeInfo (it computes the real signatureHash
    // and enforces the qualification-test requirement) rather than echoing back
    // what the client optimistically sent.
    setProgress((prev) => ({
      ...prev,
      employeeInfo: data.progress?.employeeInfo || profile,
    }));
  };

  if (!dataLoaded) {
    return <LoadingScreen message="Завантаження ваших даних..." />;
  }

  // SECURITY REQ: Force setup mode for default admin
  if (user?.username === 'admin' || user?.email === 'admin@viatec.ua') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="font-bold text-lg text-slate-900 tracking-tight">ВІАТЕК</div>
             <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Налаштування</span>
          </div>
          <button onClick={() => { void logout(); }} className="text-rose-600 hover:underline text-sm font-medium">Вийти</button>
        </header>
        <main className="grow p-6">
          <Suspense fallback={<LoadingScreen message="Завантаження..." />}>
          <div className="max-w-4xl mx-auto mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-sm">
            <strong className="block mb-1">Увага! Потрібне початкове налаштування</strong>
            Ви увійшли під системним обліковим записом. З міркувань безпеки, будь ласка, створіть нового користувача з правами <b>Адміністратор</b>. Після створення нового адміністратора, цей системний обліковий запис буде автоматично видалено і ви не зможете входити під ним.
          </div>
          <TestManagement
            sections={sections}
            questions={questions}
            courses={courses}
            cases={cases}
            spaces={spaces}
            isSetupMode={true}
            onImport={async () => {}}
            onReset={() => {}}
            onRefresh={fetchContent}
          />
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <AppSettingsProvider>
    <AiImportJobsProvider enabled={hasPermission('admin.access')} onJobFinished={fetchContent}>
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Global Notifications */}
      {progress.notifications && progress.notifications.length > 0 && (
        <div
          className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 flex flex-col gap-3 max-w-sm ml-auto"
          role="region"
          aria-live="polite"
          aria-label="Сповіщення"
        >
          {progress.notifications.filter(n => !n.read).map(notif => {
            // isCritical is undefined for notifications created before Крок 11 — treat those as critical too, matching the old behavior.
            const isCritical = notif.isCritical !== false;
            const palette = isCritical
              ? { bg: 'bg-rose-50', border: 'border-rose-500', title: 'text-rose-800', text: 'text-rose-700', date: 'text-rose-500', close: 'text-rose-400 hover:text-rose-600' }
              : { bg: 'bg-blue-50', border: 'border-blue-500', title: 'text-blue-800', text: 'text-blue-700', date: 'text-blue-500', close: 'text-blue-400 hover:text-blue-600' };
            return (
              <div key={notif.id} className={`${palette.bg} border-l-4 ${palette.border} rounded-r-lg p-4 shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-right`}>
                <div>
                  <h4 className={`font-bold ${palette.title} text-sm mb-1`}>{notif.title || 'Важливе повідомлення'}</h4>
                  <p className={`text-xs ${palette.text}`}>{notif.message}</p>
                  <div className={`text-[10px] ${palette.date} mt-2`}>{new Date(notif.date).toLocaleString('uk-UA')}</div>
                </div>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className={`${palette.close} transition p-1`}
                  title="Закрити"
                  aria-label="Закрити сповіщення"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Navbar
        currentTab={currentTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
        onSelectTab={(tab) => {
          if (tab === 'quiz') {
            setActiveQuizSectionId(undefined);
            setActiveQuizCourseId(undefined);
          }
          if (tab === 'cases') {
            setActiveCasesToRun(cases.filter(c => c.isActive !== false));
            setCaseSimulatorMode('list');
          }
          // Перехід по вкладці завжди означає «мій онбординг», а не чужий,
          // який могли відкрити зі звіту адміністрування.
          if (tab === 'onboarding') setOnboardingFocusId(null);
          // Ручний захід в адмінку повертає звичну збережену вкладку.
          if (tab === 'management') setMgmtInitialTab(undefined);
          setCurrentTab(tab);
        }}
        readCount={validReadSectionIds.length}
        totalSections={sections.length}
        bestScore={progress.bestScore > 0 ? progress.bestScore : null}
        isSigned={progress.employeeInfo.isSigned}
        onboardingPendingCount={onboardingPendingCount}
      />

      <main className="grow">
        <Suspense fallback={<TabFallback />}>
        {currentTab === 'myday' && (
          <MyDay
            user={user}
            progress={{
              ...progress,
              readSectionIds: validReadSectionIds
            }}
            sections={sections}
            courses={courses}
            cases={cases}
            spaces={spaces}
            onOpenCourse={handleOpenCourse}
            onOpenSystemLog={() => {
              setMgmtInitialTab('systemlog');
              setCurrentTab('management');
            }}
            onOpenInstruction={(secId, courseId) => {
              if (courseId) setActiveCourseId(courseId);
              setSelectedSectionId(secId);
              setCurrentTab('manual');
            }}
            onStartQuiz={(type, id) => handleStartQuiz(type, id)}
            onStartCases={(casesToRun) => {
              const toRun = casesToRun || cases.filter(c => c.isActive !== false);
              setActiveCasesToRun(toRun);
              setCaseSimulatorMode('list');
              setCurrentTab('cases');
            }}
            onNavigateToTab={(tab) => {
              if (tab === 'quiz') {
                setActiveQuizSectionId(undefined);
                setActiveQuizCourseId(undefined);
              }
              if (tab === 'cases') {
                setActiveCasesToRun(cases.filter(c => c.isActive !== false));
                setCaseSimulatorMode('list');
              }
              setCurrentTab(tab);
            }}
            onOpenSearch={() => setIsSearchOpen(true)}
            onDismissNotification={dismissNotification}
            primaryRoleLabel={primaryRoleLabel}
            canManage={canManage}
          />
        )}

        {currentTab === 'catalog' && (
          <CourseCatalog
            certificates={progress.certificates || []}
            notifications={progress.notifications || []}
            onDismissNotification={dismissNotification}
            sections={sections}
            courses={courses}
            spaces={spaces}
            readSectionIds={validReadSectionIds}
            onOpenCourse={handleOpenCourse}
            onOpenInstruction={(secId) => {
              setSelectedSectionId(secId);
              setCurrentTab('manual');
            }}
            onStartCourseQuiz={(courseId, isCourse) => handleStartQuiz(isCourse ? 'course' : 'section', courseId)}
          />
        )}

        {currentTab === 'manual' && (
          <InstructionViewer
            sections={sections}
            courses={courses}
            cases={cases}
            questions={questions}
            spaces={spaces}
            courseId={activeCourseId}
            initialSectionId={selectedSectionId}
            readSectionIds={validReadSectionIds}
            onToggleReadSection={handleToggleReadSection}
            onStartQuiz={handleStartQuiz}
            onStartCases={(courseCases) => {
              setActiveCasesToRun(courseCases, activeCourseId);
              setCaseSimulatorMode('run');
              setCurrentTab('cases');
            }}
            onBackToCatalog={() => setCurrentTab('catalog')}
          />
        )}

        {currentTab === 'cases' && (
          <CaseSimulator
            // Новий набір кейсів — нова серія, а не продовження попередньої
            key={`${caseSimulatorMode}:${activeCasesCourseId || ''}:${activeCasesToRun.map(c => c.id).join(',')}`}
            cases={activeCasesToRun}
            sections={sections}
            startAsList={caseSimulatorMode === 'list'}
            onRecordResult={handleRecordCases}
            onFinishCases={() => setCurrentTab('manual')}
          />
        )}

        {currentTab === 'quiz' && (
          <QuizRunner
            allQuestions={questions}
            initialSectionId={activeQuizSectionId}
            initialCourseId={activeQuizCourseId}
            allSections={sections}
            courses={courses}
            quizHistory={progress.quizHistory || []}
            onRecordScore={handleRecordScore}
            onNavigateToSignoff={() => setCurrentTab('signoff')}
            onBackToManual={() => setCurrentTab('manual')}
            onStartCases={(courseId) => {
              const activeCourse = courses.find(c => c.id === courseId);
              if (activeCourse) {
                // Get cases linked to the instructions of this course
                const instructionIds = activeCourse.instructionIds || [];
                const courseCases = cases.filter(c => c.isActive !== false && c.sectionId && instructionIds.includes(c.sectionId));
                if (courseCases.length > 0) {
                  setActiveCasesToRun(courseCases, courseId);
                  setCaseSimulatorMode('run');
                  setCurrentTab('cases');
                } else {
                  alert('Немає активних кейсів для цього курсу.');
                  setCurrentTab('manual');
                }
              }
            }}
          />
        )}

        {currentTab === 'signoff' && (
          <AcknowledgmentForm
            progress={{
              ...progress,
              readSectionIds: validReadSectionIds
            }}
            onSaveProfile={handleSaveProfile}
            onNavigateToQuiz={() => setCurrentTab('quiz')}
          />
        )}

        {currentTab === 'onboarding' && (
          <MyOnboarding
            focusAssignmentId={onboardingFocusId}
            canManageSteps={canManage}
            cases={cases}
            onOpenInstruction={(secId, courseId) => {
              if (courseId) setActiveCourseId(courseId);
              setSelectedSectionId(secId);
              setCurrentTab('manual');
            }}
            onOpenCourse={handleOpenCourse}
            onStartQuiz={handleStartQuiz}
            onStartCases={(casesToRun) => {
              const toRun = casesToRun || cases.filter(c => c.isActive !== false);
              setActiveCasesToRun(toRun);
              setCaseSimulatorMode(casesToRun ? 'run' : 'list');
              setCurrentTab('cases');
            }}
            onNavigateToSignoff={() => setCurrentTab('signoff')}
          />
        )}

        {currentTab === 'dashboard' && (
          <Dashboard
            progress={{
              ...progress,
              readSectionIds: validReadSectionIds
            }}
            sections={sections}
            courses={courses}
            currentUser={user}
          />
        )}

        {currentTab === 'management' && (
          <TestManagement
            sections={sections}
            questions={questions}
            courses={courses}
            cases={cases}
            spaces={spaces}
            onRefresh={fetchContent}
            initialTab={mgmtInitialTab}
            onOpenOnboardingAssignment={(assignmentId) => {
              setOnboardingFocusId(assignmentId);
              setCurrentTab('onboarding');
            }}
            onImport={async (newSections, newQuestions, replace) => {
              try {
                const res = await fetch('/api/admin/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sections: newSections, questions: newQuestions, replace })
                });
                const data = await res.json().catch(() => null);
                await fetchContent();
                // Звіт по скріншотах адмінка показує в статусі імпорту
                return data?.assets;
              } catch (err) {
                console.error(err);
                alert('Помилка при збереженні в БД');
              }
            }}
            onReset={() => {
              // No-op for DB, use delete instead.
            }}
          />
        )}
        
        {currentTab === 'about' && (
          <AboutApp onBack={() => setCurrentTab('catalog')} />
        )}
        </Suspense>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 print:hidden mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-700">ТОВ «ВІАТЕК»</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline">Корпоративний навчальний портал</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <button 
              id="footer-btn-about"
              onClick={() => setCurrentTab('about')} 
              className={`inline-flex items-center gap-1.5 transition ${
                currentTab === 'about' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600 hover:underline'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Про додаток</span>
            </button>
            <span className="hidden sm:inline text-slate-300">•</span>
            <button 
              id="footer-btn-search"
              onClick={() => setIsSearchOpen(true)} 
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 hover:underline transition"
              title="Швидкий пошук (⌘K або Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Швидкий пошук</span>
              <kbd className="px-1 py-0.2 text-[9px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-600">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span>Ви увійшли як <strong className="text-slate-700">{user?.email || user?.username}</strong> ({user?.role})</span>
            <button onClick={() => { void logout(); }} className="text-rose-600 hover:underline">Вийти</button>
          </div>
        </div>
      </footer>

      {/* Global Omnisearch Modal */}
      {isSearchOpen && (
        <Suspense fallback={null}>
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            spaces={spaces}
            sections={sections}
            questions={questions}
            cases={cases}
            courses={courses}
            onNavigateToResult={handleNavigateToSearchResult}
          />
        </Suspense>
      )}

      {isNotificationSettingsOpen && (
        <Suspense fallback={null}>
          <NotificationSettingsModal onClose={() => setIsNotificationSettingsOpen(false)} />
        </Suspense>
      )}

      {/* Прогрес фонової ШІ-обробки документів — видно на будь-якій вкладці */}
      <AiImportProgressWidget />
    </div>
    </AiImportJobsProvider>
    </AppSettingsProvider>
  );
}
