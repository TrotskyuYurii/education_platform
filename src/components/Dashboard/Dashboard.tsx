import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { UserProgress, InstructionSection } from '../../types';
import { User } from '../../context/AuthContext';
import { RotateCcw } from 'lucide-react';
import { CertificateView } from '../CertificateView';
import { UserListItem, DepartmentScoreStat, ReadProgressStats } from './types';
import { UserAnalyticsPicker } from './UserAnalyticsPicker';
import { KpiMetricsGrid } from './KpiMetricsGrid';
import { CertificatesSection } from './CertificatesSection';
import { AnalyticsCharts } from './AnalyticsCharts';
import { QuizHistoryTable } from './QuizHistoryTable';

interface DashboardProps {
  progress: UserProgress;
  sections: InstructionSection[];
  courses?: any[];
  currentUser?: User | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  progress, 
  sections, 
  courses = [], 
  currentUser 
}) => {
  const isAdmin = Boolean(currentUser?.role === 'admin' || (currentUser?.roleKeys && currentUser.roleKeys.includes('admin')));

  // Admin / Manager state for viewing other users
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<{ user: any; progress: any } | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  
  // Certificate viewer state
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);

  // Fetch all users with summary stats
  const fetchUsersList = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      // Use v2 or backward-compatible endpoint
      const res = await fetch('/api/admin/users-progress');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users list for analytics', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsersList();
    }
  }, [isAdmin, fetchUsersList]);

  // Fetch selected user's detailed progress
  const fetchSelectedUserProgress = useCallback(async (userId: string) => {
    setIsLoadingUserData(true);
    try {
      const res = await fetch(`/api/admin/progress/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUserData(data);
      }
    } catch (err) {
      console.error('Failed to fetch user progress', err);
    } finally {
      setIsLoadingUserData(false);
    }
  }, []);

  const handleSelectUser = (userId: string | null) => {
    setSelectedUserId(userId);
    if (userId) {
      fetchSelectedUserProgress(userId);
    } else {
      setSelectedUserData(null);
    }
  };

  const handleDeleteCertificate = async (courseId: string) => {
    if (!isAdmin || !selectedUserId) return;
    if (!confirm('Ви впевнені, що хочете анулювати цей сертифікат? Співробітник отримає сповіщення про це.')) return;

    try {
      const res = await fetch(`/api/admin/progress/${selectedUserId}/certificate/${courseId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedCertificate(null);
        // Refresh target user's progress & users list
        await fetchSelectedUserProgress(selectedUserId);
        await fetchUsersList();
      } else {
        alert('Помилка при видаленні сертифікату');
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при видаленні сертифікату');
    }
  };

  // Determine active progress to display (either selected user's or current user's)
  const activeProgress: UserProgress = useMemo(() => {
    if (selectedUserId && selectedUserData?.progress) {
      const p = selectedUserData.progress;
      const historyList = p.quizHistory || p.testScores || [];
      const bestScore = historyList.length > 0 
        ? Math.max(...historyList.map((s: any) => s.percentage || 0)) 
        : (p.bestScore || 0);
      const totalAnswers = historyList.length > 0
        ? historyList.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
        : (p.totalQuestionsAnswered || 0);
      
      return {
        readSectionIds: p.readSectionIds || [],
        quizCompleted: historyList.length > 0 || Boolean(p.quizCompleted),
        bestScore,
        totalQuestionsAnswered: totalAnswers,
        employeeInfo: p.employeeInfo || {
          fullName: selectedUserData.user?.email || 'Користувач',
          position: 'Співробітник',
          department: selectedUserData.user?.departments?.[0] || 'ВІАТЕК',
          signedDate: '',
          isSigned: false
        },
        quizHistory: historyList.map((s: any) => ({
          date: s.date,
          score: s.score,
          total: s.total,
          percentage: s.percentage !== undefined ? s.percentage : (s.total > 0 ? Math.round((s.score / s.total) * 100) : 0),
          sectionId: s.sectionId,
          courseId: s.courseId,
          department: s.department,
          mode: s.mode
        })),
        certificates: p.certificates || []
      };
    }
    return progress;
  }, [selectedUserId, selectedUserData, progress]);

  // Selected user info
  const activeUser = useMemo(() => {
    if (selectedUserId && selectedUserData?.user) {
      return selectedUserData.user;
    }
    return currentUser;
  }, [selectedUserId, selectedUserData, currentUser]);

  // Aggregate data for average score by department
  const scoreByDept: DepartmentScoreStat[] = useMemo(() => {
    const deps: Record<string, { totalScore: number; count: number }> = {};
    (activeProgress.quizHistory || []).forEach(history => {
      let dep = history.department || 'Загальний';
      if ((!dep || dep === 'Загальний') && history.courseId) {
        const matchingCourse = courses.find(c => c.id === history.courseId);
        if (matchingCourse?.department) {
          dep = matchingCourse.department;
        } else {
          const matchingSection = sections.find(s => s.courseId === history.courseId);
          if (matchingSection?.department) dep = matchingSection.department;
        }
      }
      if ((!dep || dep === 'Загальний') && history.sectionId) {
        const matchingSection = sections.find(s => s.id === history.sectionId);
        if (matchingSection?.department) {
          dep = matchingSection.department;
        }
      }
      const pct = history.percentage !== undefined 
        ? history.percentage 
        : (history.total > 0 ? Math.round((history.score / history.total) * 100) : 0);

      if (!deps[dep]) deps[dep] = { totalScore: 0, count: 0 };
      deps[dep].totalScore += pct;
      deps[dep].count += 1;
    });

    return Object.entries(deps).map(([name, data]) => ({
      name,
      avgScore: Math.round(data.totalScore / data.count),
      testsTaken: data.count
    })).sort((a, b) => b.testsTaken - a.testsTaken);
  }, [activeProgress.quizHistory, sections, courses]);

  const readProgress: ReadProgressStats = useMemo(() => {
    const totalSections = sections.length;
    const readSections = Math.min(activeProgress.readSectionIds.length, totalSections);
    return {
      read: readSections,
      unread: totalSections - readSections,
      percentage: totalSections > 0 ? Math.round((readSections / totalSections) * 100) : 0
    };
  }, [activeProgress.readSectionIds, sections]);

  const certificates = activeProgress.certificates || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {selectedCertificate && (
        <CertificateView 
          certificate={selectedCertificate} 
          employeeInfo={activeProgress.employeeInfo}
          onClose={() => setSelectedCertificate(null)}
          onDelete={isAdmin && selectedUserId ? () => handleDeleteCertificate(selectedCertificate.courseId) : undefined}
        />
      )}

      {/* Header and Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              Аналітика та Прогрес
              {selectedUserId && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Режим перегляду співробітника
                </span>
              )}
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              {selectedUserId 
                ? `Деталізовані показники успішності та активності співробітника: ${activeUser?.email || ''}`
                : 'Відслідковуйте власну успішність, пройдені тести та сертифікати'
              }
            </p>
          </div>

          {/* Quick return button */}
          {selectedUserId && (
            <button
              onClick={() => handleSelectUser(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer"
              title="Повернутися до моєї власної аналітики"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Мій власний профіль</span>
            </button>
          )}
        </div>

        {/* Admin User Picker subcomponent */}
        {isAdmin && (
          <UserAnalyticsPicker
            usersList={usersList}
            selectedUserId={selectedUserId}
            activeUser={activeUser}
            currentUser={currentUser}
            isLoadingUsers={isLoadingUsers}
            isLoadingUserData={isLoadingUserData}
            activeEmployeeFullName={activeProgress.employeeInfo?.fullName}
            onSelectUser={handleSelectUser}
            onRefreshList={fetchUsersList}
            onRefreshUserData={() => selectedUserId && fetchSelectedUserProgress(selectedUserId)}
          />
        )}
      </div>

      {isLoadingUserData ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Завантаження аналітики співробітника...</p>
        </div>
      ) : (
        <>
          {/* KPI Metrics Grid subcomponent */}
          <KpiMetricsGrid
            bestScore={activeProgress.bestScore}
            completedTestsCount={activeProgress.quizHistory.length}
            readCount={readProgress.read}
            totalSectionsCount={sections.length}
            totalQuestionsAnswered={activeProgress.totalQuestionsAnswered}
          />

          {/* Certificates Section subcomponent */}
          <CertificatesSection
            certificates={certificates}
            selectedUserId={selectedUserId}
            isAdmin={isAdmin}
            onViewCertificate={(cert) => setSelectedCertificate(cert)}
            onDeleteCertificate={handleDeleteCertificate}
          />

          {/* Analytics Charts subcomponent */}
          <AnalyticsCharts
            scoreByDept={scoreByDept}
            readProgress={readProgress}
            totalSectionsCount={sections.length}
          />

          {/* Quiz History Table subcomponent */}
          <QuizHistoryTable
            quizHistory={activeProgress.quizHistory}
            selectedUserId={selectedUserId}
            courses={courses}
            sections={sections}
          />
        </>
      )}

    </div>
  );
};
