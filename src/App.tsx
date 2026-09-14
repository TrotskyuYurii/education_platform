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
    certificates: [],
    notifications: [],
  });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeQuizSectionId, setActiveQuizSectionId] = useState<string | undefined>(undefined);
  const [activeQuizCourseId, setActiveQuizCourseId] = useState<string | undefined>(undefined);
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(undefined);
  const [activeCasesToRun, setActiveCasesToRun] = useState<any[]>([]);
  const [caseSimulatorMode, setCaseSimulatorMode] = useState<'list' | 'run'>('run');

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
          notifications: data.progress.notifications || [],
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
        {currentTab === 'catalog' && (
          <CourseCatalog
            certificates={progress.certificates || []}
            notifications={progress.notifications || []}
            onDismissNotification={dismissNotification}
            sections={sections}
            courses={courses}
            readSectionIds={validReadSectionIds}
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
