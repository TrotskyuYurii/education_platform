import React, { useMemo, useState, useEffect } from 'react';
import { UserProgress, InstructionSection } from '../types';
import { User } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Award, Target, BookOpen, Clock, AlertTriangle, FileCheck, 
  Users, Search, ChevronDown, Check, RotateCcw, Shield, User as UserIcon,
  Building2, History, RefreshCw, X, Sparkles, CheckCircle2
} from 'lucide-react';
import { CertificateView } from './CertificateView';

interface DashboardProps {
  progress: UserProgress;
  sections: InstructionSection[];
  courses?: any[];
  currentUser?: User | null;
}

interface UserListItem {
  _id: string;
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  departments: string[];
  allowedInstructionIds?: string[];
  createdAt?: string;
  employeeInfo?: any;
  stats: {
    readCount: number;
    testsCount: number;
    bestScore: number;
    certificatesCount: number;
    totalQuestionsAnswered: number;
    lastActivity: string | null;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  progress, 
  sections, 
  courses = [], 
  currentUser 
}) => {
  const isAdmin = currentUser?.role === 'admin';

  // Admin state for viewing other users
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<{ user: any; progress: any } | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  
  // Search and filter in user picker
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  
  // Certificate viewer
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);

  // Fetch all users with summary stats if admin
  const fetchUsersList = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
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
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsersList();
    }
  }, [isAdmin]);

  // Fetch selected user's detailed progress when selectedUserId changes
  const fetchSelectedUserProgress = async (userId: string) => {
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
  };

  const handleSelectUser = (userId: string | null) => {
    setSelectedUserId(userId);
    setIsPickerOpen(false);
    if (userId) {
      fetchSelectedUserProgress(userId);
    } else {
      setSelectedUserData(null);
    }
  };

  // Determine active progress to display (either selected user's or current user's)
  const activeProgress: UserProgress = useMemo(() => {
    if (selectedUserId && selectedUserData?.progress) {
      const p = selectedUserData.progress;
      const testScores = p.testScores || [];
      const bestScore = testScores.length > 0 
        ? Math.max(...testScores.map((s: any) => s.percentage || 0)) 
        : 0;
      const totalAnswers = testScores.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
      
      return {
        readSectionIds: p.readSectionIds || [],
        quizCompleted: testScores.length > 0,
        bestScore,
        totalQuestionsAnswered: totalAnswers,
        employeeInfo: p.employeeInfo || {
          fullName: selectedUserData.user.email || 'Користувач',
          position: 'Співробітник',
          department: selectedUserData.user.departments?.[0] || 'ВІАТЕК',
          signedDate: '',
          isSigned: false
        },
        quizHistory: testScores.map((s: any) => ({
          date: s.date,
          score: s.score,
          total: s.total,
          percentage: s.percentage,
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

  // Department list from all users for filtering
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    usersList.forEach(u => {
      (u.departments || []).forEach(d => set.add(d));
    });
    return Array.from(set).sort();
  }, [usersList]);

  // Filtered users for the dropdown
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const matchesSearch = 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.employeeInfo?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.departments.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesDept = deptFilter === 'all' || u.departments.includes(deptFilter);
      return matchesSearch && matchesDept;
    });
  }, [usersList, searchQuery, deptFilter]);

  // Aggregate data for average score by department
  const scoreByDept = useMemo(() => {
    const deps: Record<string, { totalScore: number; count: number }> = {};
    activeProgress.quizHistory.forEach(history => {
      let dep = history.department || 'Загальний';
      if (dep === 'Загальний' && history.courseId) {
        const matchingCourse = courses.find(c => c.id === history.courseId);
        if (matchingCourse?.department) {
          dep = matchingCourse.department;
        } else {
          const matchingSection = sections.find(s => s.courseId === history.courseId);
          if (matchingSection?.department) dep = matchingSection.department;
        }
      }
      if (!deps[dep]) deps[dep] = { totalScore: 0, count: 0 };
      deps[dep].totalScore += history.percentage;
      deps[dep].count += 1;
    });

    return Object.entries(deps).map(([name, data]) => ({
      name,
      avgScore: Math.round(data.totalScore / data.count),
      testsTaken: data.count
    })).sort((a, b) => b.testsTaken - a.testsTaken);
  }, [activeProgress.quizHistory, sections, courses]);

  const readProgress = useMemo(() => {
    const totalSections = sections.length;
    const readSections = Math.min(activeProgress.readSectionIds.length, totalSections);
    return {
      read: readSections,
      unread: totalSections - readSections,
      percentage: totalSections > 0 ? Math.round((readSections / totalSections) * 100) : 0
    };
  }, [activeProgress.readSectionIds, sections]);

  const certificates = activeProgress.certificates || [];
  const now = new Date();
  const warningDays = 30;

  const pieData = [
    { name: 'Опрацьовано', value: readProgress.read },
    { name: 'Залишилось', value: readProgress.unread }
  ];

  // Helper to get title for history items
  const getItemTitle = (history: any) => {
    if (history.courseId) {
      const c = courses.find(course => course.id === history.courseId);
      if (c?.title) return c.title;
    }
    if (history.sectionId) {
      const s = sections.find(sec => sec.id === history.sectionId);
      if (s?.title) return s.title;
    }
    return history.department ? `Тест (${history.department})` : 'Підсумковий тест';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {selectedCertificate && (
        <CertificateView 
          certificate={selectedCertificate} 
          employeeInfo={activeProgress.employeeInfo}
          onClose={() => setSelectedCertificate(null)}
        />
      )}

      {/* Header and Admin User Selector */}
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

          {/* If viewing someone else, quick return button */}
          {selectedUserId && (
            <button
              onClick={() => handleSelectUser(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shrink-0"
              title="Повернутися до моєї власної аналітики"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Мій власний профіль</span>
            </button>
          )}
        </div>

        {/* ADMIN USER PICKER CARD */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-blue-50/50 rounded-2xl p-5 border border-purple-200/80 shadow-xs relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                      Адміністрування аналітики
                    </span>
                    <span className="text-[10px] bg-purple-200/70 text-purple-800 font-semibold px-2 py-0.5 rounded-md">
                      {usersList.length} користувачів у базі
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Вибір користувача для перегляду статистики
                  </h3>
                </div>
              </div>

              {/* Selector Combobox Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                  className="w-full md:w-80 flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl shadow-xs hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left transition"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {selectedUserId ? (
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-xs font-bold">
                        {activeUser?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {selectedUserId ? (activeUser?.email || 'Співробітник') : 'Мій власний профіль (Ви)'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {selectedUserId 
                          ? (activeUser?.departments?.join(', ') || 'Всі підрозділи') 
                          : currentUser?.email
                        }
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isPickerOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsPickerOpen(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-40 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[480px]">
                      
                      {/* Search Bar */}
                      <div className="px-3 pb-2.5 border-b border-slate-100">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Пошук за email або підрозділом..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            autoFocus
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Department Filter Chips */}
                        {allDepartments.length > 0 && (
                          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 text-[10px] scrollbar-none">
                            <button
                              type="button"
                              onClick={() => setDeptFilter('all')}
                              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition ${deptFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              Всі підрозділи
                            </button>
                            {allDepartments.map(dep => (
                              <button
                                key={dep}
                                type="button"
                                onClick={() => setDeptFilter(dep)}
                                className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition ${deptFilter === dep ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {dep}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Scrollable list */}
                      <div className="overflow-y-auto flex-1 divide-y divide-slate-50 py-1">
                        
                        {/* Option: Current user */}
                        <div
                          onClick={() => handleSelectUser(null)}
                          className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition ${!selectedUserId ? 'bg-purple-50/80 font-semibold' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Мій власний профіль</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">Ви</span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{currentUser?.email}</div>
                            </div>
                          </div>
                          {!selectedUserId && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                        </div>

                        {/* List of other users */}
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                          Співробітники ({filteredUsers.length})
                        </div>

                        {isLoadingUsers ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Завантаження списку користувачів...
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Користувачів не знайдено
                          </div>
                        ) : (
                          filteredUsers.map((u) => {
                            const isSelected = selectedUserId === u.id || selectedUserId === u._id;
                            return (
                              <div
                                key={u.id || u._id}
                                onClick={() => handleSelectUser(u.id || u._id)}
                                className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition ${isSelected ? 'bg-purple-50/80' : 'hover:bg-slate-50'}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {u.email?.[0]?.toUpperCase() || 'U'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-xs font-bold text-slate-900 truncate">
                                        {u.email}
                                      </span>
                                      {u.role === 'admin' && (
                                        <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold uppercase shrink-0">
                                          Адмін
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                                      <span className="truncate">
                                        {u.departments?.join(', ') || 'Всі підрозділи'}
                                      </span>
                                      <span className="text-slate-300">·</span>
                                      <span className="shrink-0 text-slate-600 font-medium">
                                        Тестів: {u.stats.testsCount} ({u.stats.bestScore}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Оберіть користувача зі списку</span>
                        <button
                          type="button"
                          onClick={() => {
                            fetchUsersList();
                            if (selectedUserId) fetchSelectedUserProgress(selectedUserId);
                          }}
                          className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Оновити</span>
                        </button>
                      </div>

                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Selected User Info Banner */}
            {selectedUserId && (
              <div className="mt-4 pt-3.5 border-t border-purple-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-600 font-medium">Перегляд картки:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-purple-200 shadow-2xs">
                    {activeUser?.email}
                  </span>
                  {activeUser?.role === 'admin' ? (
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      Адміністратор
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      Користувач
                    </span>
                  )}
                  {activeProgress.employeeInfo?.fullName && activeProgress.employeeInfo?.fullName !== activeUser?.email && (
                    <span className="text-slate-500">
                      (ПІБ: <strong className="text-slate-700">{activeProgress.employeeInfo.fullName}</strong>)
                    </span>
                  )}
                  <span className="text-slate-400">
                    Підрозділ: {activeUser?.departments?.join(', ') || 'Загальний'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchSelectedUserProgress(selectedUserId)}
                    disabled={isLoadingUserData}
                    className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-white rounded-lg transition"
                    title="Оновити дані користувача"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUserData ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleSelectUser(null)}
                    className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline decoration-purple-300 underline-offset-2"
                  >
                    Скинути до моєї аналітики
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoadingUserData ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Завантаження аналітики співробітника...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Найкращий бал</p>
                <p className="text-2xl font-bold text-slate-900">{activeProgress.bestScore}%</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Завершено тестів</p>
                <p className="text-2xl font-bold text-slate-900">{activeProgress.quizHistory.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Прочитано інструкцій</p>
                <p className="text-2xl font-bold text-slate-900">{readProgress.read} / {sections.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Всього відповідей</p>
                <p className="text-2xl font-bold text-slate-900">{activeProgress.totalQuestionsAnswered}</p>
              </div>
            </div>
          </div>

          {/* Certificates Section */}
          {certificates.length > 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-purple-600" /> 
                {selectedUserId ? `Сертифікати користувача (${certificates.length})` : 'Ваші сертифікати'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {certificates.map((cert: any, idx: number) => {
                  const expDate = new Date(cert.expiresAt);
                  const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                  const isWarning = daysLeft <= warningDays && daysLeft > 0;
                  const isExpired = daysLeft <= 0;

                  return (
                    <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 pr-4">{cert.courseTitle}</h4>
                        {isExpired ? (
                          <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg shrink-0" title="Прострочено">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                        ) : isWarning ? (
                          <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0" title={`Спливає через ${daysLeft} дн.`}>
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                            <FileCheck className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      
                      <div className="text-sm text-slate-500 space-y-1 mb-4">
                        <p>Отримано: {new Date(cert.issuedAt).toLocaleDateString('uk-UA')}</p>
                        <p className={isExpired ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-600 font-bold' : ''}>
                          Дійсний до: {expDate.toLocaleDateString('uk-UA')}
                        </p>
                      </div>

                      {isExpired || isWarning ? (
                        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 mb-4">
                          {isExpired ? 'Сертифікат недійсний.' : 'Термін дії сертифіката скоро спливає.'}
                        </div>
                      ) : null}

                      <button 
                        onClick={() => setSelectedCertificate(cert)}
                        className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                      >
                        Переглянути сертифікат
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedUserId ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <Award className="w-4 h-4 text-slate-400" />
                Співробітник ще не має виданих сертифікатів (необхідно пройти курс на 80%+ балів).
              </span>
            </div>
          ) : null}

          {/* Charts: Score by dept & Reading progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Charts: Avg score by department */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Середній бал за підрозділами (%)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Результати тестів співробітника за напрямками</p>
                </div>
                {scoreByDept.length > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg">
                    {scoreByDept.length} {scoreByDept.length === 1 ? 'підрозділ' : 'підрозділи(-ів)'}
                  </span>
                )}
              </div>

              {scoreByDept.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreByDept} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                        cursor={{fill: '#f1f5f9'}}
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        formatter={(value: any) => [`${value}%`, 'Середній бал']}
                      />
                      <Legend iconType="circle" />
                      <Bar dataKey="avgScore" name="Середній бал" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  <Target className="w-8 h-8 text-slate-300 mb-2" />
                  <span>Немає завершених тестувань для розрахунку статистики</span>
                </div>
              )}
            </div>

            {/* Charts: Progress Donut */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-1">Прогрес читання інструкцій</h3>
              <p className="text-xs text-slate-500 mb-6">Відсоток опрацьованих регламентів</p>
              
              <div className="h-[230px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-900">{readProgress.percentage}%</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Опрацьовано</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-around text-center text-xs">
                <div>
                  <div className="font-bold text-emerald-600 text-base">{readProgress.read}</div>
                  <div className="text-slate-500">Прочитано</div>
                </div>
                <div className="w-px h-8 bg-slate-100" />
                <div>
                  <div className="font-bold text-slate-400 text-base">{readProgress.unread}</div>
                  <div className="text-slate-500">Залишилось</div>
                </div>
                <div className="w-px h-8 bg-slate-100" />
                <div>
                  <div className="font-bold text-slate-800 text-base">{sections.length}</div>
                  <div className="text-slate-500">Всього в базі</div>
                </div>
              </div>
            </div>

          </div>

          {/* Test Scores History Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedUserId ? `Історія тестувань користувача (${activeProgress.quizHistory.length})` : 'Історія ваших тестувань'}
                </h3>
              </div>
              {activeProgress.quizHistory.length > 0 && (
                <span className="text-xs text-slate-500">
                  Всього спроб: <strong>{activeProgress.quizHistory.length}</strong>
                </span>
              )}
            </div>

            {activeProgress.quizHistory.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                Співробітник ще не проходив жодного тесту чи тренажера кейсів.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Дата та час</th>
                      <th className="py-3 px-4">Матеріал / Курс</th>
                      <th className="py-3 px-4">Підрозділ</th>
                      <th className="py-3 px-4">Тип</th>
                      <th className="py-3 px-4 text-center">Правильних</th>
                      <th className="py-3 px-4 text-right">Результат</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {activeProgress.quizHistory.map((item, i) => {
                      const itemDate = item.date ? new Date(item.date).toLocaleString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '—';

                      const isPassed = item.percentage >= 80;
                      const isMedium = item.percentage >= 60 && item.percentage < 80;

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {itemDate}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {getItemTitle(item)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                              {item.department || 'Загальний'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {item.mode === 'cases' ? (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200 text-[10px]">
                                Кейси
                              </span>
                            ) : (
                              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-200 text-[10px]">
                                Тест
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            {item.score} / {item.total}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              isPassed 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isMedium 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {item.percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};
