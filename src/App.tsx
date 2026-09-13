import React, { useState, useEffect } from 'react';
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
import { useAuth } from './context/AuthContext';
import { InstructionSection, QuizQuestion, UserProgress } from './types';

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
  const { user, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('viatec_current_tab') as AppTab;
      if (saved && ['catalog', 'manual', 'quiz', 'cases', 'signoff', 'profile', 'management', 'about'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'catalog';
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
  });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeQuizSectionId, setActiveQuizSectionId] = useState<string | undefined>(undefined);
  const [activeQuizCourseId, setActiveQuizCourseId] = useState<string | undefined>(undefined);
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(undefined);
  const [activeCasesToRun, setActiveCasesToRun] = useState<any[]>([]);
  const [caseSimulatorMode, setCaseSimulatorMode] = useState<'list' | 'run'>('run');

  const fetchContent = async () => {
    try {
      const res = await fetch('/api/content');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
        setQuestions(data.questions || []);
        setCourses(data.courses || []);
        setCases(data.cases || []);
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
        const testScores = data.progress.testScores || [];
        setProgress(prev => ({
          ...prev,
          readSectionIds: data.progress.readSectionIds || [],
          quizHistory: testScores,
          certificates: data.progress.certificates || [],
          employeeInfo: data.progress.employeeInfo || prev.employeeInfo,
          bestScore: testScores.length > 0 ? Math.max(0, ...testScores.map((s: any) => s.percentage || 0)) : 0,
          totalQuestionsAnswered: testScores.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
        }));
      }
    } catch (err) {
      console.error('Failed to fetch progress', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchContent(), fetchProgress()]).then(() => setDataLoaded(true));
  }, []);

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
    setProgress((prev) => {
      const exists = prev.readSectionIds.includes(sectionId);
      const updated = exists
        ? prev.readSectionIds.filter((id) => id !== sectionId)
        : [...prev.readSectionIds, sectionId];
      
      saveProgressToDb(updated);
      return { ...prev, readSectionIds: updated };
    });
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

    setProgress((prev) => ({
      ...prev,
      quizCompleted: true,
      bestScore: Math.max(prev.bestScore || 0, percentage),
      totalQuestionsAnswered: (prev.totalQuestionsAnswered || 0) + total,
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
    }));
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
      <Navbar
        currentTab={currentTab}
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
        readCount={progress.readSectionIds.length}
        totalSections={sections.length}
        bestScore={progress.bestScore > 0 ? progress.bestScore : null}
        isSigned={progress.employeeInfo.isSigned}
      />

      <main className="grow">
        {currentTab === 'catalog' && (
          <CourseCatalog
            sections={sections}
            courses={courses}
            readSectionIds={progress.readSectionIds}
            onOpenCourse={handleOpenCourse}
            onStartCourseQuiz={(courseId, isCourse) => handleStartQuiz(isCourse ? 'course' : 'section', courseId)}
          />
        )}

        {currentTab === 'manual' && (
          <InstructionViewer
            sections={sections}
            courses={courses}
            cases={cases}
            questions={questions}
            courseId={activeCourseId}
            readSectionIds={progress.readSectionIds}
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
            progress={progress}
            onSaveProfile={handleSaveProfile}
            onNavigateToQuiz={() => setCurrentTab('quiz')}
          />
        )}

        {currentTab === 'dashboard' && (
          <Dashboard
            progress={progress}
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
          <AboutApp />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">ТОВ «ВІАТЕК»</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Ви увійшли як <strong className="text-slate-700">{user?.email || user?.username}</strong> ({user?.role})</span>
            <button onClick={logout} className="text-rose-600 hover:underline">Вийти</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
