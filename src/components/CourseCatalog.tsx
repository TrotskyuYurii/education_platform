import React, { useMemo, useState } from 'react';
import {
  InstructionSection } from '../types';
import { 
  BookOpen,
  AlertTriangle, 
  Search, 
  Play, 
  BookText, 
  Layers, 
  FileText, 
  Users, 
  CalendarDays, 
  Megaphone,
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CourseCatalogProps {
  certificates?: Array<{ courseId: string; courseTitle: string; issuedAt: string; expiresAt: string; }>;
  notifications?: Array<{ id: string; message: string; date: string; read: boolean; }>;
  onDismissNotification?: (id: string) => void;
  sections: InstructionSection[];
  courses: any[];
  readSectionIds: string[];
  onOpenCourse: (courseId: string) => void;
  onStartCourseQuiz: (courseId: string, isCourse: boolean) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  sections,
  courses,
  readSectionIds,
  onOpenCourse,
  onStartCourseQuiz,
  certificates = [],
  notifications = [],
  onDismissNotification
}) => {
  const { user } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    const specificDept = user?.departments?.find(d => d !== 'Всі підрозділи');
    return specificDept || 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'courses' | 'instructions'>('all');
  const [activeNotifIdx, setActiveNotifIdx] = useState<number>(0);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState<boolean>(false);

  // Extract unique departments
  const departments = useMemo(() => {
    const deps = new Set(sections.map(s => s.department));
    return Array.from(deps).filter(Boolean);
  }, [sections]);

  // Combine courses and standalone sections, apply filters
  const filteredItems = useMemo(() => {
    // 1. Process Courses
    const cItems = courses.filter(c => {
      if (c.isActive === false) return false;
      const matchesDept = selectedDepartment === 'all' || c.department === selectedDepartment;
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' || 
        (c.title || '').toLowerCase().includes(searchLower) ||
        (c.department || '').toLowerCase().includes(searchLower);
      return matchesDept && matchesSearch;
    }).map(c => {
      const cSections = sections.filter(s => c.instructionIds?.includes(s.id) && s.isActive !== false);
      return {
        id: c.id,
        isCourse: true,
        title: c.title,
        department: c.department || 'Загальний',
        sections: cSections,
        totalReadTime: cSections.reduce((acc, s) => acc + (s.readTimeMin || 0), 0)
      };
    });

    // Find which sections are part of ANY course
    const sectionsInCourses = new Set<string>();
    courses.forEach(c => {
      (c.instructionIds || []).forEach((id: string) => sectionsInCourses.add(id));
    });

    // 2. Process Standalone Sections
    const sItems = sections.filter(sec => {
      if (sec.isActive === false) return false;
      if (sectionsInCourses.has(sec.id)) return false; // hide if in a course
      const matchesDept = selectedDepartment === 'all' || sec.department === selectedDepartment;
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' || 
        (sec.title || '').toLowerCase().includes(searchLower) ||
        (sec.department || '').toLowerCase().includes(searchLower);
      return matchesDept && matchesSearch;
    }).map(sec => ({
      id: sec.id,
      isCourse: false,
      title: sec.title,
      department: sec.department || 'Загальний',
      sections: [sec],
      totalReadTime: sec.readTimeMin || 0
    }));

    let combined = [...cItems, ...sItems];
    
    if (activeView === 'courses') combined = combined.filter(i => i.isCourse);
    if (activeView === 'instructions') combined = combined.filter(i => !i.isCourse);

    return combined;
  }, [sections, courses, selectedDepartment, searchQuery, activeView]);

  const renderCompactRow = (item: any) => {
    // calculate progress
    const courseReadSections = item.sections.filter((s: any) => readSectionIds.includes(s.id));
    const isCompleted = item.sections.length > 0 && courseReadSections.length === item.sections.length;
    
    return (
      <div key={`item-${item.id}`} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl mb-3 hover:border-blue-300 hover:shadow-md transition-all gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.isCourse ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
            {item.isCourse ? <Layers className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{item.title}</h4>
              {item.isCourse && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">
                  Курс
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{item.department}</span>
              {item.isCourse && <span>• {item.sections.length} інструкцій</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {item.totalReadTime} хв</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:w-auto w-full justify-between sm:justify-end border-t sm:border-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
          <div className="flex flex-col sm:items-end">
            <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4"/> : <Circle className="w-4 h-4"/>}
              {isCompleted ? 'Вивчено' : 'До вивчення'}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onOpenCourse(item.id)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-bold transition"
            >
              <BookText className="w-4 h-4" />
              <span className="hidden sm:inline">Читати</span>
            </button>
            <button
              onClick={() => onStartCourseQuiz(item.id, item.isCourse)}
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition"
              title="Пройти тест"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* DASHBOARD WIDGETS (HR Portal Concept) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        
        {/* Main Welcome Widget */}
        <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Привіт, {user?.username}! 👋
            </h1>
            <p className="text-blue-100 text-sm sm:text-base mb-6 max-w-sm">
              Ласкаво просимо до корпоративного порталу ВІАТЕК. Ваша єдина точка доступу до знань та процесів компанії.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-sm font-medium">
              <BookOpen className="w-4 h-4" />
              База знань: {sections.length} матеріалів
            </div>
          </div>
          <BookOpen className="absolute -right-6 -bottom-6 w-48 h-48 text-white opacity-10 pointer-events-none transform -rotate-12" />
        </div>

        {/* Placeholder Widget 1: Team/Structure */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative group">
          <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">В розробці</div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Команда</h3>
          <p className="text-xs text-slate-500">Структура та контакти</p>
        </div>

        {/* Widget 2: News / Notifications / Announcements */}
        {(() => {
          const unreadNotifs = notifications.filter(n => !n.read);
          const now = new Date();
          const expiringCert = certificates.find(cert => {
            const expires = new Date(cert.expiresAt);
            const diffDays = (expires.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return diffDays > 0 && diffDays <= 30;
          });

          // Priority 1: Unread notifications (e.g. certificate annulment, admin notices)
          if (unreadNotifs.length > 0) {
            const safeIdx = Math.min(activeNotifIdx, unreadNotifs.length - 1);
            const currentNotif = unreadNotifs[safeIdx] || unreadNotifs[0];
            const isCertNotice = currentNotif.message.toLowerCase().includes('сертифікат');

            return (
              <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50/50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                        <Megaphone className="w-3.5 h-3.5 text-rose-600" />
                        Новини та сповіщення
                      </span>
                    </div>
                    {unreadNotifs.length > 1 && (
                      <div className="flex items-center gap-1 bg-rose-100/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-800">
                        <button 
                          disabled={safeIdx <= 0} 
                          onClick={() => setActiveNotifIdx(p => Math.max(0, p - 1))}
                          className="hover:text-rose-950 disabled:opacity-30"
                          title="Попереднє сповіщення"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span>{safeIdx + 1}/{unreadNotifs.length}</span>
                        <button 
                          disabled={safeIdx >= unreadNotifs.length - 1} 
                          onClick={() => setActiveNotifIdx(p => Math.min(unreadNotifs.length - 1, p + 1))}
                          className="hover:text-rose-950 disabled:opacity-30"
                          title="Наступне сповіщення"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mb-2">
                    <div className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold mb-1.5">
                      {isCertNotice ? '⚠️ Анулювання сертифікату' : 'Важливе повідомлення'}
                    </div>
                    <p className="text-xs font-semibold text-rose-950 leading-snug">
                      {currentNotif.message}
                    </p>
                    <div className="text-[10px] text-rose-500 mt-1.5">
                      {new Date(currentNotif.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-rose-200/80 mt-auto">
                  <span className="text-[10px] text-rose-600 font-medium">
                    Нове повідомлення
                  </span>
                  {onDismissNotification && (
                    <button
                      onClick={() => onDismissNotification(currentNotif.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      title="Позначити як прочитане"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Зрозуміло</span>
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Priority 2: Expiring certificate alert
          if (expiringCert) {
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-sm leading-tight mb-1">Новини: строк дії сертифікату</h3>
                    <p className="text-xs text-amber-800 leading-snug">
                      Сертифікат «{expiringCert.courseTitle}» діє до {new Date(expiringCert.expiresAt).toLocaleDateString('uk-UA')}.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          // Priority 3: Standard News widget with history modal trigger
          return (
            <div 
              onClick={() => setIsNewsModalOpen(true)}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative group cursor-pointer hover:border-slate-300 hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Новини</h3>
              <p className="text-xs text-slate-500">Події та сповіщення компанії</p>
              {notifications.length > 0 && (
                <span className="mt-2 text-[10px] text-blue-600 font-semibold hover:underline">
                  Історія сповіщень ({notifications.length})
                </span>
              )}
            </div>
          );
        })()}

      </div>

      {/* KNOWLEDGE BASE SECTION */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Navigation & Filters */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="sticky top-6">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookText className="w-4 h-4 text-blue-600"/> 
              База знань
            </h3>
            
            <div className="space-y-6">
              {/* Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Пошук</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Назва..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
                  />
                </div>
              </div>

              {/* Department Filter */}
              {departments.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Підрозділ</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  >
                    <option value="all">Всі підрозділи</option>
                    {departments.map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Тип матеріалу</label>
                <div className="flex flex-col gap-1.5">
                  <button 
                    onClick={() => setActiveView('all')}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    Всі матеріали
                  </button>
                  <button 
                    onClick={() => setActiveView('courses')}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeView === 'courses' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Layers className="w-4 h-4"/> Комплексні курси
                  </button>
                  <button 
                    onClick={() => setActiveView('instructions')}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeView === 'instructions' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <FileText className="w-4 h-4"/> Окремі інструкції
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main List */}
        <div className="flex-1">
          {filteredItems.length > 0 ? (
            <div className="flex flex-col">
              {filteredItems.map(renderCompactRow)}
            </div>
          ) : (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl border-dashed">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">За вашим запитом матеріалів не знайдено.</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDepartment('all');
                  setActiveView('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition"
              >
                Скинути фільтри
              </button>
            </div>
          )}
        </div>
      </div>

      {/* News & Notifications History Modal */}
      {isNewsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Новини та сповіщення</h3>
                  <p className="text-xs text-slate-500">Центр корпоративних повідомлень</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Нових сповіщень немає</p>
                  <p className="text-xs text-slate-400 mt-1">Всі важливі новини та зміни статусів відображатимуться тут</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => {
                    const isCertNotice = notif.message.toLowerCase().includes('сертифікат');
                    return (
                      <div 
                        key={notif.id} 
                        className={`p-4 rounded-2xl border transition ${notif.read ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-rose-50/80 border-rose-200 text-rose-950'}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${notif.read ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-800'}`}>
                            {isCertNotice ? 'Сертифікат' : 'Сповіщення'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(notif.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{notif.message}</p>
                        {!notif.read && onDismissNotification && (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => onDismissNotification(notif.id)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Ознайомлений</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsNewsModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
