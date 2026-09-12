import React, { useMemo, useState } from 'react';
import { InstructionSection } from '../types';
import { BookOpen, Search, ArrowRight, Play, BookText } from 'lucide-react';

interface CourseCatalogProps {
  sections: InstructionSection[];
  courses: any[];
  readSectionIds: string[];
  onOpenCourse: (courseId: string) => void;
  onStartCourseQuiz: (courseId: string) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  sections,
  courses,
  readSectionIds,
  onOpenCourse,
  onStartCourseQuiz
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique departments
  const departments = useMemo(() => {
    const deps = new Set(sections.map(s => s.department));
    return Array.from(deps).filter(Boolean);
  }, [sections]);

  // Combine courses and standalone sections, apply filters
  const filteredItems = useMemo(() => {
    // 1. Process Courses
    const cItems = courses.filter(c => {
      const matchesDept = selectedDepartment === 'all' || c.department === selectedDepartment;
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' || 
        (c.title || '').toLowerCase().includes(searchLower) ||
        (c.department || '').toLowerCase().includes(searchLower);
      return matchesDept && matchesSearch;
    }).map(c => {
      const cSections = sections.filter(s => c.instructionIds?.includes(s.id));
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

    return [...cItems, ...sItems];
  }, [sections, courses, selectedDepartment, searchQuery]);


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-blue-600 rounded-2xl p-8 mb-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Корпоративний портал ВІАТЕК
          </h1>
          <p className="text-blue-100 max-w-2xl text-lg">
            Єдина база знань, регламентів та навчальних курсів для співробітників компанії. Оберіть свій підрозділ або курс для вивчення.
          </p>
        </div>
        <BookOpen className="absolute -right-8 -bottom-8 w-64 h-64 text-blue-500 opacity-20 pointer-events-none" />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук за назвою інструкції, курсу або підрозділом..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
          />
        </div>

        {departments.length > 0 && (
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Усі підрозділи</option>
            {departments.map(dep => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        )}
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          // calculate progress
          const courseReadSections = item.sections.filter(s => readSectionIds.includes(s.id));
          const progressPercent = item.sections.length > 0 
            ? Math.round((courseReadSections.length / item.sections.length) * 100) 
            : 0;

          return (
            <div key={`item-${item.id}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="inline-flex px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                  {item.department}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {item.totalReadTime} хв
                </span>
              </div>
              
              <div className="mb-2">
                {item.isCourse && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md inline-block">
                    Курс ({item.sections.length} інструкцій)
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 leading-tight mb-6 flex-1">
                {item.title}
              </h3>

              <div className="mb-6">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-600">Статус</span>
                  <span className={progressPercent === 100 ? 'text-emerald-600' : 'text-blue-600'}>
                    {progressPercent === 100 ? 'Вивчено' : 'Не вивчено'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                <button
                  onClick={() => onOpenCourse(item.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-bold transition"
                >
                  <BookText className="w-4 h-4" />
                  <span>Читати</span>
                </button>
                <button
                  onClick={() => onStartCourseQuiz(item.id)}
                  className="inline-flex items-center justify-center py-2.5 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition"
                  title="Пройти тест"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-2xl border-dashed">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Матеріалів не знайдено. Спробуйте змінити фільтри.</p>
          </div>
        )}
      </div>
    </div>
  );
};
