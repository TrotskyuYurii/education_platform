import React, { useState, useEffect } from 'react';
import { InstructionSection, QuizQuestion, KnowledgeSpace } from '../types';
import { 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileSpreadsheet,
  MonitorPlay,
  ArrowLeft,
  Play,
  Award,
  Sparkles,
  BookText,
  Building2,
  ListTodo,
  Circle,
  Menu,
  X,
  ChevronRight,
  FolderTree,
  GitBranch
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RichTextWithImages } from './RichTextWithImages';

interface InstructionViewerProps {
  sections: InstructionSection[];
  courses: any[];
  cases: any[];
  questions: QuizQuestion[];
  spaces?: KnowledgeSpace[];
  courseId: string | undefined;
  initialSectionId?: string;
  readSectionIds: string[];
  onToggleReadSection: (id: string, isRead: boolean) => void;
  onStartQuiz: (type: 'course' | 'section', id: string) => void;
  onStartCases?: (casesToRun: any[]) => void;
  onBackToCatalog: () => void;
}

export const InstructionViewer: React.FC<InstructionViewerProps> = ({
  sections,
  courses,
  cases,
  questions,
  spaces = [],
  courseId,
  initialSectionId,
  readSectionIds,
  onToggleReadSection,
  onStartQuiz,
  onStartCases,
  onBackToCatalog
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId || null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Setup active course and sections
  const activeCourse = courseId ? courses.find(c => c.id === courseId) : undefined;
  const courseSections = activeCourse 
    ? sections.filter(s => activeCourse.instructionIds?.includes(s.id) && s.isActive !== false)
    : sections;

  useEffect(() => {
    if (initialSectionId && courseSections.some(s => s.id === initialSectionId)) {
      setActiveSectionId(initialSectionId);
    } else if (courseSections.length > 0 && !activeSectionId) {
      // Auto select first section
      setActiveSectionId(courseSections[0].id);
    }
  }, [courseSections, initialSectionId, activeSectionId]);

  const activeSection = courseSections.find(s => s.id === activeSectionId) || courseSections[0];
  const isCompleted = activeSection && readSectionIds.includes(activeSection.id);

  // Крок 12 (Аналітика): count opens per section for the "популярні / без переглядів" report.
  useEffect(() => {
    if (!activeSection?.id) return;
    fetch(`/api/sections/${activeSection.id}/view`, { method: 'POST' }).catch(() => {});
  }, [activeSection?.id]);
  
  // Progress calculations
  const totalSections = courseSections.length;
  const completedSections = courseSections.filter(s => readSectionIds.includes(s.id)).length;
  const progressPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
  const allRead = completedSections === totalSections && totalSections > 0;

  if (!activeSection) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button onClick={onBackToCatalog} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Повернутися до матеріалів
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          Матеріал не знайдено
        </div>
      </div>
    );
  }

  const renderSidebar = () => (
    <nav aria-label="Зміст курсу" className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white sticky top-0 z-10">
        <button onClick={onBackToCatalog} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition mb-4 uppercase tracking-wider">
          <ArrowLeft className="w-3.5 h-3.5" /> До каталогу
        </button>
        <h2 className="font-extrabold text-slate-900 text-lg leading-tight mb-3">
          {activeCourse ? activeCourse.title : 'Окрема інструкція'}
        </h2>
        {activeCourse && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Прогрес</span>
              <span className={progressPercent === 100 ? 'text-emerald-600' : 'text-blue-600'}>{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {courseSections.map((sec, idx) => {
          const isRead = readSectionIds.includes(sec.id);
          const isActive = sec.id === activeSection.id;
          
          let isLocked = false;
          if (activeCourse?.isProgressive && idx > 0) {
            const prevSec = courseSections[idx - 1];
            if (!readSectionIds.includes(prevSec.id)) {
              isLocked = true;
            }
          }

          return (
            <button
              key={sec.id}
              disabled={isLocked}
              onClick={() => {
                if (!isLocked) {
                  setActiveSectionId(sec.id);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-start gap-3 ${
                isActive 
                  ? 'bg-blue-50 border border-blue-200 shadow-sm' 
                  : isLocked
                    ? 'opacity-50 cursor-not-allowed bg-slate-50 border border-transparent'
                    : 'hover:bg-slate-100 border border-transparent cursor-pointer'
              }`}
            >
              <div className={`shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full ${
                isRead ? 'bg-emerald-100 text-emerald-600' : isActive ? 'bg-blue-100 text-blue-600' : isLocked ? 'bg-slate-200 text-slate-400' : 'bg-slate-200 text-slate-500'
              }`}>
                {isRead ? <CheckCircle2 className="w-3.5 h-3.5" /> : isLocked ? <div className="text-[10px]">🔒</div> : <span className="text-[10px] font-bold">{idx + 1}</span>}
              </div>
              <div>
                <div className={`text-sm font-semibold leading-tight mb-1 ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>{sec.title}</div>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {sec.readTimeMin} хв</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Course Completion Actions */}
      {activeCourse && allRead && (
        <div className="p-4 border-t border-slate-200 bg-emerald-50/50">
          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 text-center">Курс завершено</h4>
          <button
            onClick={() => onStartQuiz('course', activeCourse.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-sm font-bold transition shadow-sm mb-2"
          >
            <Award className="w-4 h-4" /> Фінальний тест
          </button>
          {activeCourse.useCases && onStartCases && (
            <button
              onClick={() => {
                const instructionIds = activeCourse.instructionIds || [];
                const courseCases = cases.filter(c => c.isActive !== false && c.sectionId && instructionIds.includes(c.sectionId));
                if (courseCases.length > 0) {
                  onStartCases(courseCases);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition shadow-sm"
            >
              <MonitorPlay className="w-4 h-4" /> Практичні кейси
            </button>
          )}
        </div>
      )}
    </nav>
  );

  return (
    <div className="max-w-7xl mx-auto lg:px-6 py-0 lg:py-6 flex flex-col h-[100dvh] lg:h-[calc(100vh-80px)]">
      {/* Mobile Toggle */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20">
        <button onClick={onBackToCatalog} className="text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-900 truncate px-4">{activeCourse ? activeCourse.title : 'Інструкція'}</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-900">
          {isMobileMenuOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden lg:rounded-3xl lg:border border-slate-200 bg-white lg:shadow-sm">
        
        {/* Sidebar (Desktop + Mobile overlay) */}
        <div className={`
          absolute lg:static inset-0 z-10 lg:z-0 lg:w-72 shrink-0 bg-white transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {renderSidebar()}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white relative">
          
          <div className="flex-1 p-5 sm:p-8 md:p-12 max-w-4xl mx-auto w-full">
            {/* Breadcrumb / Metadata */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {(() => {
                const activeSpace = spaces.find(s => s.id === (activeSection.spaceId || 'space-general'));
                return activeSpace ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                    <FolderTree className="w-3 h-3 text-blue-600" />
                    {activeSpace.name}
                  </span>
                ) : null;
              })()}
              <span className="inline-flex px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                {activeSection.department || 'Загальний'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono font-bold tracking-wider">
                <GitBranch className="w-3 h-3" />
                v{activeSection.version || '1.0'}
              </span>
              {activeSection.status && (
                <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  activeSection.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  activeSection.status === 'in_review' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  activeSection.status === 'archived' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {activeSection.status === 'draft' ? 'Чернетка' :
                   activeSection.status === 'in_review' ? 'На рецензії' :
                   activeSection.status === 'archived' ? 'Архів' : 'Опубліковано'}
                </span>
              )}
              <span className="inline-flex px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                Час: {activeSection.readTimeMin} хв
              </span>
            </div>

            {/* Title Block */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4 tracking-tight">
              {activeSection.title}
            </h1>
            {activeSection.subtitle && (
              <p className="text-lg text-slate-500 font-medium mb-8 leading-relaxed">
                {activeSection.subtitle}
              </p>
            )}

            {/* Read Toggle Status */}
            <div className={`p-4 rounded-2xl border mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
              isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                {isCompleted ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <BookOpen className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className={`font-bold text-sm ${isCompleted ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {isCompleted ? 'Матеріал вивчено' : 'Матеріал не вивчено'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {isCompleted ? 'Ви підтвердили ознайомлення з цим розділом.' : 'Позначте як вивчене після прочитання.'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onToggleReadSection(activeSection.id, !isCompleted)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  isCompleted 
                    ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                {isCompleted ? 'Скасувати позначку' : 'Позначити як вивчене'}
              </button>
            </div>

            {/* Markdown Content (Typography plugin handles styling) */}
            <div className="prose prose-slate prose-blue max-w-none mb-12">
              <RichTextWithImages 
                contentMarkdown={activeSection.contentMarkdown} 
                contentHtml={activeSection.contentHtml}
                images={activeSection.images} 
              />
            </div>

            {/* Special Callouts: Stop Rules */}
            {activeSection.stopRules && activeSection.stopRules.length > 0 && (
              <div className="mb-8 p-6 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500 opacity-5 rounded-bl-full pointer-events-none"></div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-rose-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Стоп-правила (Заборонено!)
                </h4>
                <ul className="space-y-2 text-rose-900 text-sm">
                  {(activeSection.stopRules || []).map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-rose-600 font-bold mt-0.5">✕</span>
                      <span className="font-medium leading-relaxed">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Special Callouts: System Actions */}
            {activeSection.systemAutomaticActions && activeSection.systemAutomaticActions.length > 0 && (
              <div className="mb-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Що система робить автоматично
                </h4>
                <ul className="space-y-2 text-emerald-900 text-sm">
                  {(activeSection.systemAutomaticActions || []).map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                      <span className="font-medium leading-relaxed">{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Test block */}
            <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                    Перевірка знань
                  </span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight mb-2">
                  Готові перевірити себе?
                </h3>
                <p className="text-sm text-blue-100 max-w-lg">
                  Пройдіть швидкий тест за цим матеріалом, щоб закріпити знання з миттєвим зворотним зв'язком.
                </p>
              </div>
              <button
                onClick={() => onStartQuiz('section', activeSection.id)}
                className="w-full sm:w-auto shrink-0 py-3.5 px-6 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2.5"
              >
                <Award className="w-5 h-5 text-blue-600" />
                Почати тест
              </button>
            </div>
            
            {/* Footer Navigation */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 pb-12">
              <button
                onClick={() => {
                  const curIdx = courseSections.findIndex((s) => s.id === activeSection.id);
                  if (curIdx > 0) setActiveSectionId(courseSections[curIdx - 1].id);
                }}
                disabled={courseSections.findIndex((s) => s.id === activeSection.id) <= 0}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-200 text-slate-700 disabled:opacity-40 disabled:bg-slate-50 hover:bg-slate-100 transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4"/> Попередня
              </button>
              <button
                onClick={() => {
                  const curIdx = courseSections.findIndex((s) => s.id === activeSection.id);
                  if (curIdx < courseSections.length - 1 && curIdx !== -1) setActiveSectionId(courseSections[curIdx + 1].id);
                }}
                disabled={courseSections.findIndex((s) => s.id === activeSection.id) === courseSections.length - 1 || courseSections.findIndex((s) => s.id === activeSection.id) === -1}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                Наступна <ChevronRight className="w-4 h-4"/>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
