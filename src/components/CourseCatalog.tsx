import React, { useMemo, useState } from 'react';
import { InstructionSection } from '../types';
import { 
  BookOpen, 
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
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CourseCatalogProps {
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
  onStartCourseQuiz
}) => {
  const { user } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    const specificDept = user?.departments?.find(d => d !== 'Всі підрозділи');
    return specificDept || 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'courses' | 'instructions'>('all');

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

        {/* Placeholder Widget 2: News/Announcements */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative group">
          <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">В розробці</div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Новини</h3>
          <p className="text-xs text-slate-500">Події компанії</p>
        </div>

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
    </div>
  );
};
