import React, { useState, useEffect, useMemo } from 'react';
import { Navbar, AppTab } from './components/Navbar';
import { InstructionViewer } from './components/InstructionViewer';
import { QuizRunner } from './components/QuizRunner';
import { CaseSimulator } from './components/CaseSimulator';
import { AcknowledgmentForm } from './components/AcknowledgmentForm';
import { TestManagement } from './components/TestManagement';
import { CourseCatalog } from './components/CourseCatalog';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { AboutApp } from './components/AboutApp';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MyDay } from './components/MyDay';
import { PeopleDirectory } from './components/People';
import { useAuth } from './context/AuthContext';
import { InstructionSection, QuizQuestion, UserProgress, KnowledgeSpace, SearchResultItem } from './types';
import { Info, Search } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Завантаження...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <MainApp />;
}

function MainApp() {
  const { user, logout, canManage, primaryRoleLabel } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('viatec_current_tab') as AppTab;
      if (saved && ['myday', 'catalog', 'manual', 'quiz', 'cases', 'people', 'signoff', 'profile', 'management', 'about', 'dashboard'].includes(saved)) {
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
  const [activeCasesToRun, setActiveCasesToRun] = useState<any[]>([]);
  const [caseSimulatorMode, setCaseSimulatorMode] = useState<'list' | 'run'>('run');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [analyticsFocusUserId, setAnalyticsFocusUserId] = useState<string | null>(null);

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

  useEffect(() => {
    Promise.all([fetchContent(), fetchProgress()]).then(() => setDataLoaded(true));

    // Periodically sync progress/notifications so revocations or updates appear live
    const interval = setInterval(() => {
      fetchProgress();
    }, 15000);
    return () => clearInterval(interval);
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

  const handleRecordScore = (score: number, total: number, modeName: string, department?: string, courseId?: string, sectionId?: string) => {
    const percentage = Math.round((score / total) * 100);
    const scoreRec = {
      score,
      total,
      percentage,
      mode: modeName,
      department,
      courseId,
      sectionId,
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

  const handleSaveProfile = (profile: UserProgress['employeeInfo']) => {
    setProgress((prev) => ({
      ...prev,
      employeeInfo: profile,
    }));
    saveProgressToDb(undefined, undefined, profile);
  };

  if (!dataLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Завантаження даних...</div>;
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
          <button onClick={logout} className="text-rose-600 hover:underline text-sm font-medium">Вийти</button>
        </header>
        <main className="grow p-6">
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
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Global Notifications */}
      {progress.notifications && progress.notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
          {progress.notifications.filter(n => !n.read).map(notif => (
            <div key={notif.id} className="bg-rose-50 border-l-4 border-rose-500 rounded-r-lg p-4 shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-right">
              <div>
                <h4 className="font-bold text-rose-800 text-sm mb-1">Важливе повідомлення</h4>
                <p className="text-xs text-rose-700">{notif.message}</p>
                <div className="text-[10px] text-rose-500 mt-2">{new Date(notif.date).toLocaleString('uk-UA')}</div>
              </div>
              <button 
                onClick={() => dismissNotification(notif.id)}
                className="text-rose-400 hover:text-rose-600 transition p-1"
                title="Закрити"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <Navbar
        currentTab={currentTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onSelectTab={(tab) => {
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
        readCount={validReadSectionIds.length}
        totalSections={sections.length}
        bestScore={progress.bestScore > 0 ? progress.bestScore : null}
        isSigned={progress.employeeInfo.isSigned}
      />

      <main className="grow">
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
              setActiveCasesToRun(courseCases);
              setCurrentTab('cases');
            }}
            onBackToCatalog={() => setCurrentTab('catalog')}
          />
        )}

        {currentTab === 'cases' && (
          <CaseSimulator
            cases={activeCasesToRun}
            startAsList={caseSimulatorMode === 'list'}
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
                  setActiveCasesToRun(courseCases);
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

        {currentTab === 'people' && (
          <PeopleDirectory
            onViewAnalytics={(userId) => {
              setAnalyticsFocusUserId(userId);
              setCurrentTab('dashboard');
            }}
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
            initialSelectedUserId={analyticsFocusUserId}
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
            onImport={async (newSections, newQuestions, replace) => {
              try {
                await fetch('/api/admin/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sections: newSections, questions: newQuestions, replace })
                });
                await fetchContent();
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
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
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
            <button onClick={logout} className="text-rose-600 hover:underline">Вийти</button>
          </div>
        </div>
      </footer>

      {/* Global Omnisearch Modal */}
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
    </div>
  );
}
