import React, { useState, useMemo, useEffect } from 'react';
import { 
  InstructionSection, 
  QuizQuestion,
} from '../types';
import { 
  CheckCircle2, 
  Search, 
  ShieldAlert, 
  Award, 
  FileSpreadsheet, 
  Clock, 
  Printer,
  ChevronRight,
  Sparkles,
  Info,
  ArrowLeft,
  Briefcase,
  Maximize2,
  Image as ImageIcon,
  BookOpen,
  ListChecks,
  KeyRound,
  AlertTriangle
} from 'lucide-react';
import { RichTextWithImages } from './RichTextWithImages';
import { ImageLightboxModal } from './ImageLightboxModal';

interface InstructionViewerProps {
  sections: InstructionSection[];
  courses?: any[];
  cases?: any[];
  questions?: QuizQuestion[];
  courseId?: string;
  readSectionIds: string[];
  onToggleReadSection: (sectionId: string) => void;
  onStartQuiz: (type: 'all'|'section'|'course', id?: string) => void;
  onStartCases?: (casesToRun: any[]) => void;
  onBackToCatalog: () => void;
}

export const InstructionViewer: React.FC<InstructionViewerProps> = ({
  sections,
  courses = [],
  cases = [],
  questions = [],
  courseId,
  readSectionIds,
  onToggleReadSection,
  onStartQuiz,
  onStartCases,
  onBackToCatalog
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const activeCourse = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);

  // 1. Filter sections down to ONLY the selected course or instruction
  const courseSections = useMemo(() => {
    // Only show active instructions
    const activeSections = sections.filter(s => s.isActive !== false);
    
    if (!courseId) return activeSections;
    
    // If it's a course, get all its active instructions
    if (activeCourse) {
      return activeSections.filter(s => activeCourse.instructionIds.includes(s.id));
    }
    
    // Fallback: assume courseId is just a single section ID
    return activeSections.filter(s => s.id === courseId);
  }, [sections, courseId, activeCourse]);

  // Set default active section when course changes
  useEffect(() => {
    if (courseSections.length > 0) {
      setActiveSectionId(courseSections[0].id);
    }
  }, [courseId]);

  // 2. Further filter by text search within this course
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return courseSections;
    const query = searchQuery.toLowerCase();
    return courseSections.filter((sec) => (
      sec.title.toLowerCase().includes(query) ||
      sec.subtitle.toLowerCase().includes(query) ||
      sec.summary.toLowerCase().includes(query) ||
      (sec.contentMarkdown && sec.contentMarkdown.toLowerCase().includes(query)) ||
      sec.keyPoints.some((p) => p.toLowerCase().includes(query)) ||
      (sec.keyFields && sec.keyFields.some((f) => f.toLowerCase().includes(query))) ||
      (sec.stopRules && sec.stopRules.some((r) => r.toLowerCase().includes(query)))
    ));
  }, [courseSections, searchQuery]);

  const activeSection = courseSections.find((s) => s.id === activeSectionId) || filteredSections[0] || courseSections[0];
  
  const currentCourseTitle = activeCourse ? activeCourse.title : (activeSection?.title || 'Загальні інструкції');
  const currentCourseDept = activeCourse ? activeCourse.department : (activeSection?.department || 'Загальний підрозділ');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner / Document Header */}
      <div className="mb-6">
        <button
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium text-sm transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Повернутися до каталогу
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase tracking-wider">
                Підрозділ: {currentCourseDept}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentCourseTitle}
            </h1>
            <p className="text-slate-600 mt-2 max-w-3xl text-sm sm:text-base leading-relaxed">
              Ознайомтеся з усіма матеріалами для закріплення знань.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            {activeCourse && activeCourse.useCases && onStartCases && (
              <button
                onClick={() => {
                  const instructionIds = activeCourse.instructionIds || [];
                  const courseCases = cases.filter(c => c.isActive !== false && c.sectionId && instructionIds.includes(c.sectionId));
                  if (courseCases.length > 0) {
                    onStartCases(courseCases);
                  } else {
                    alert('Немає активних кейсів для цього курсу.');
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs transition"
              >
                <Briefcase className="w-4 h-4" />
                <span>Практичні кейси ({cases.filter(c => c.isActive !== false && c.sectionId && (activeCourse.instructionIds || []).includes(c.sectionId)).length})</span>
              </button>
            )}
            {activeCourse ? (
              <button
                onClick={() => onStartQuiz('course', activeCourse.id)}
                id="btn-start-all-quiz"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition"
              >
                <Award className="w-4 h-4" />
                <span>Тест за курсом</span>
              </button>
            ) : (
              <button
                onClick={() => onStartQuiz('section', activeSectionId)}
                id="btn-start-all-quiz"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition"
              >
                <Award className="w-4 h-4" />
                <span>Пройти тест</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              id="btn-print-doc"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              <Printer className="w-4 h-4" />
              <span>Роздрукувати матеріали</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Швидкий пошук у тексті..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Navigator + Content Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Table of Contents / Progress List */}
        <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Список інструкцій
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {courseSections.filter(s => readSectionIds.includes(s.id)).length} / {courseSections.length} вивчено
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                {filteredSections.map((sec) => {
                  const isRead = readSectionIds.includes(sec.id);
                  const isActive = activeSection?.id === sec.id;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`group p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 border ${
                        isActive
                          ? 'bg-blue-50/70 border-blue-200 text-blue-900 shadow-xs'
                          : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleReadSection(sec.id);
                          }}
                          className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600 transition"
                          title={isRead ? 'Позначити як невивчене' : 'Позначити як опрацьоване'}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 ${
                              isRead ? 'text-emerald-500 fill-emerald-100' : 'text-slate-300'
                            }`}
                          />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate group-hover:text-blue-700 transition">
                            {sec.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {sec.pageReference} · {sec.readTimeMin} хв читання
                          </p>
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 mt-1 transition ${isActive ? 'text-blue-600 translate-x-0.5' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  );
                })}
              </div>

              {filteredSections.length === 0 && (
                <div className="text-center py-6 px-4 text-xs text-slate-500">
                  Не знайдено інструкцій за фільтром
                </div>
              )}
            </div>
          </div>

          {/* Quick Quiz Card on Sidebar */}
          <div className="hidden lg:block bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Закріплення матеріалу
              </span>
            </div>
            <h3 className="text-base font-bold leading-snug">
              Готові перевірити свої знання?
            </h3>
            <p className="text-xs text-blue-100 mt-1.5 leading-relaxed">
              Пройдіть тематичний тест за цією інструкцією і отримайте оцінку з розбором помилок.
            </p>
            <button
              onClick={() => onStartQuiz('section', activeSection?.id)}
              className="mt-4 w-full py-2 px-3 bg-white text-blue-600 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4" />
              <span>Тест за обраною інструкцією</span>
            </button>
          </div>
        </div>

        {/* Right Side: Active Section Deep View */}
        <div className="lg:col-span-8 space-y-6">
          {activeSection ? (
            <article className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              
              {/* Section Header */}
              <div className="border-b border-slate-100 pb-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                      {activeSection.pageReference}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {activeSection.readTimeMin} хв читання
                    </span>
                    {activeSection.targetRole !== 'all' && (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold rounded-md capitalize">
                        Роль: {activeSection.targetRole === 'cashier' ? 'Касир' : activeSection.targetRole === 'manager' ? 'Менеджер' : 'Бухгалтер'}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onToggleReadSection(activeSection.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      readSectionIds.includes(activeSection.id)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      {readSectionIds.includes(activeSection.id)
                        ? 'Опрацьовано'
                        : 'Позначити як опрацьоване'}
                    </span>
                  </button>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {activeSection.title}
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                  {activeSection.subtitle}
                </p>

                <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-sm leading-relaxed flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="grow min-w-0">
                    <span className="font-semibold">Суть інструкції: </span>
                    <RichTextWithImages 
                      content={activeSection.summary} 
                      onImageClick={(url, title) => setLightboxImage({ url, title: title || activeSection.title })}
                    />
                  </div>
                </div>
              </div>

              {/* 1. ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ (ОРИГІНАЛ З ФОТО ТА ОФОРМЛЕННЯМ) */}
              {activeSection.contentMarkdown && (
                <div className="mb-8 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span>Повний текст регламенту (вихідний документ)</span>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium">
                      Оригінальна інструкція
                    </span>
                  </div>
                  <div className="prose prose-slate max-w-none">
                    <RichTextWithImages 
                      content={activeSection.contentMarkdown} 
                      onImageClick={(url, title) => setLightboxImage({ url, title: title || activeSection.title })}
                    />
                  </div>
                </div>
              )}

              {/* General Section Illustrations (if present and not already inside markdown) */}
              {activeSection.images && activeSection.images.length > 0 && !activeSection.contentMarkdown && (
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Схеми та загальні ілюстрації інструкції</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeSection.images.map((imgUrl, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => setLightboxImage({ 
                          url: imgUrl, 
                          title: `Ілюстрація ${imgIdx + 1}: ${activeSection.title}` 
                        })}
                        className="group relative rounded-xl border border-slate-200 bg-white p-2 hover:border-blue-400 hover:shadow-md transition cursor-pointer overflow-hidden"
                      >
                        <div className="relative bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden min-h-[140px] max-h-[260px]">
                          <img
                            src={imgUrl}
                            alt={`Ілюстрація ${imgIdx + 1}`}
                            className="max-h-[250px] w-auto max-w-full object-contain rounded-md transition group-hover:scale-[1.01]"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                              <Maximize2 className="w-3.5 h-3.5" />
                              Збільшити схему
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-slate-600">Схема / Ілюстрація {imgIdx + 1}</span>
                          <span className="text-blue-600 font-semibold flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" />
                            Перегляд
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step-by-Step Execution Workflow (if present) */}
              {activeSection.steps && activeSection.steps.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-blue-600" />
                    <span>Покроковий порядок дій</span>
                  </h3>
                  <div className="space-y-3">
                    {activeSection.steps.map((step) => {
                      const allStepImgs = step.images && step.images.length > 0
                        ? step.images
                        : (step.imageUrl ? [step.imageUrl] : []);

                      return (
                        <div
                          key={step.number}
                          className="p-4 sm:p-5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 transition"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {step.number}
                            </div>
                            <div className="grow min-w-0">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                                {step.title}
                              </h4>
                              <div className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                                <RichTextWithImages 
                                  content={step.description}
                                  onImageClick={(url, title) => setLightboxImage({ 
                                    url, 
                                    title: title || `Крок ${step.number}: ${step.title}` 
                                  })}
                                />
                              </div>

                              {step.tip && (
                                <p className="mt-2.5 text-xs text-blue-700 bg-blue-50/90 border border-blue-100 px-3 py-2 rounded-lg font-medium">
                                  💡 {step.tip}
                                </p>
                              )}

                              {step.warning && (
                                <p className="mt-2.5 text-xs text-amber-800 bg-amber-50/90 border border-amber-200 px-3 py-2 rounded-lg font-medium">
                                  ⚠️ {step.warning}
                                </p>
                              )}

                              {/* Screenshots list in step */}
                              {allStepImgs.length > 0 && (
                                <div className="mt-4 space-y-3">
                                  {allStepImgs.map((imgUrl, imgIdx) => (
                                    <div 
                                      key={imgIdx}
                                      onClick={() => setLightboxImage({ 
                                        url: imgUrl, 
                                        title: `Крок ${step.number}: ${step.title}${allStepImgs.length > 1 ? ` (Скріншот ${imgIdx + 1})` : ''}` 
                                      })}
                                      className="group relative rounded-xl border border-slate-200/90 bg-white p-2 hover:border-blue-400 hover:shadow-md transition cursor-pointer overflow-hidden max-w-2xl"
                                    >
                                      <div className="relative bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden min-h-[140px] max-h-[380px]">
                                        <img 
                                          src={imgUrl} 
                                          alt={`Скріншот до кроку ${step.number}`} 
                                          className="max-h-[360px] w-auto max-w-full object-contain rounded-md transition group-hover:scale-[1.01]"
                                          loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                          <span className="px-3.5 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                                            <Maximize2 className="w-3.5 h-3.5" />
                                            Натисніть для збільшення
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1 font-medium text-slate-600">
                                          <ImageIcon className="w-3 h-3 text-slate-400" />
                                          {allStepImgs.length > 1 ? `Скріншот ${imgIdx + 1}` : 'Скріншот інтерфейсу'}
                                        </span>
                                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                                          <Maximize2 className="w-3 h-3" />
                                          Детальний перегляд
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. АНАЛІТИЧНИЙ ПІДСУМКОВИЙ БЛОК В КІНЦІ ІНСТРУКЦІЇ: ВИСНОВКИ, КЛЮЧОВІ ПОЛЯ, СТОП-СПИСКИ */}
              <div className="mt-8 pt-8 border-t-2 border-slate-100 space-y-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Аналітичний підсумок та ключові вимоги інструкції
                  </h3>
                </div>

                {/* Основні висновки */}
                {activeSection.keyPoints && activeSection.keyPoints.length > 0 && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 shadow-xs">
                    <h4 className="text-sm font-bold text-blue-950 mb-3 flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-blue-600" />
                      <span>📌 Основні висновки</span>
                    </h4>
                    <ul className="space-y-2.5">
                      {activeSection.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-blue-950 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                          <div className="grow min-w-0">
                            <RichTextWithImages 
                              content={point} 
                              onImageClick={(url, title) => setLightboxImage({ url, title: title || `Висновок ${idx + 1}` })}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ключові поля та обов'язкові реквізити */}
                {activeSection.keyFields && activeSection.keyFields.length > 0 && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs">
                    <h4 className="text-sm font-bold text-amber-950 mb-3 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-600" />
                      <span>📋 Ключові поля та обов'язкові реквізити</span>
                    </h4>
                    <ul className="space-y-2">
                      {activeSection.keyFields.map((field, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-950 font-medium">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{field}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* СТОП-СПИСКИ */}
                {activeSection.stopRules && activeSection.stopRules.length > 0 && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-rose-50 border-2 border-rose-200 shadow-xs">
                    <h4 className="text-sm font-bold text-rose-900 mb-3 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>🚫 СТОП-СПИСОК — Так робити категорично заборонено!</span>
                    </h4>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-rose-950 font-medium">
                      {activeSection.stopRules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="text-rose-600 font-bold text-base leading-none">✕</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Що система робить сама */}
                {activeSection.systemAutomaticActions && activeSection.systemAutomaticActions.length > 0 && (
                  <div className="p-5 sm:p-6 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-xs">
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-900 mb-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>⚙️ Що система обліку проводить автоматично:</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-emerald-900">
                      {activeSection.systemAutomaticActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Data / Responsibility Comparison Table (if present) */}
                {activeSection.tableData && (
                  <div className="p-5 sm:p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      <span>📊 Таблиця відповідностей та відповідальності</span>
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            {activeSection.tableData.headers.map((h, i) => (
                              <th key={i} className="p-3">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {activeSection.tableData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/80 transition">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3 align-top font-medium">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. КВІЗ-ОПИТ: ПЕРЕВІРИТИ ЗНАННЯ З ЦІЄЇ ІНСТРУКЦІЇ */}
              <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-7 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                      Контроль засвоєння матеріалу
                    </span>
                    {questions.filter(q => q.sectionId === activeSection.id).length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500/80 text-white text-[11px] font-bold rounded-full border border-blue-400">
                        {questions.filter(q => q.sectionId === activeSection.id).length} питань
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    Готові перевірити свої знання з цієї інструкції?
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
                    Пройдіть тест за цим регламентом: перевірте розуміння правил, дій в системі та СТОП-списків з миттєвим розбором відповідей.
                  </p>
                </div>
                <button
                  onClick={() => onStartQuiz('section', activeSection.id)}
                  className="w-full sm:w-auto shrink-0 py-3.5 px-6 bg-white text-blue-700 hover:bg-blue-50 active:scale-95 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Award className="w-5 h-5 text-blue-600" />
                  <span>Перевірити знання з цієї інструкції</span>
                </button>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const curIdx = courseSections.findIndex((s) => s.id === activeSection.id);
                      if (curIdx > 0) setActiveSectionId(courseSections[curIdx - 1].id);
                    }}
                    disabled={courseSections.findIndex((s) => s.id === activeSection.id) <= 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    ← Попередня інструкція
                  </button>
                  <button
                    onClick={() => {
                      const curIdx = courseSections.findIndex((s) => s.id === activeSection.id);
                      if (curIdx < courseSections.length - 1 && curIdx !== -1) setActiveSectionId(courseSections[curIdx + 1].id);
                    }}
                    disabled={courseSections.findIndex((s) => s.id === activeSection.id) === courseSections.length - 1 || courseSections.findIndex((s) => s.id === activeSection.id) === -1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    Наступна інструкція →
                  </button>
                </div>

                <button
                  onClick={() => onStartQuiz('section', activeSection.id)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  <Award className="w-4 h-4" />
                  <span>Перевірити знання з цієї інструкції</span>
                </button>
              </div>

            </article>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              Оберіть інструкцію для перегляду
            </div>
          )}
        </div>

      </div>

      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};
