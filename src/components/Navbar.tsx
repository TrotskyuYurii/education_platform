import React from 'react';
import { BookOpen, CheckCircle2, Award, Briefcase, Sparkles, FileText, Settings2 } from 'lucide-react';
import { INSTRUCTION_DOCUMENT_META } from '../data/instructionData';
import { useAuth } from '../context/AuthContext';

export type AppTab = 'catalog' | 'manual' | 'quiz' | 'cases' | 'signoff' | 'management' | 'dashboard';

interface NavbarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  readCount: number;
  totalSections: number;
  bestScore: number | null;
  isSigned: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  readCount,
  totalSections,
  bestScore,
  isSigned,
}) => {
  const { user } = useAuth();
  const readPercent = totalSections > 0 ? Math.round((readCount / totalSections) * 100) : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Meta */}
          <div 
            onClick={() => onSelectTab('catalog')}
            className="flex items-center gap-3 cursor-pointer select-none group"
            id="nav-logo"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:bg-blue-700 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight group-hover:text-blue-600 transition">
                  {INSTRUCTION_DOCUMENT_META.company}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                  {INSTRUCTION_DOCUMENT_META.system}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                Навчальний портал
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5" id="nav-tabs">
            <button
              id="tab-btn-manual"
              onClick={() => onSelectTab('catalog')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'catalog' || currentTab === 'manual'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Навчальні курси</span>
              <span className={`text-xs px-1.5 py-0.2 rounded-full ${
                currentTab === 'catalog' || currentTab === 'manual' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {readCount}/{totalSections}
              </span>
            </button>

            <button
              id="tab-btn-quiz"
              onClick={() => onSelectTab('quiz')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'quiz'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>2. Тестування (Квіз)</span>
              {bestScore !== null && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full ${
                  currentTab === 'quiz' ? 'bg-blue-500 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {bestScore}%
                </span>
              )}
            </button>

            <button
              id="tab-btn-cases"
              onClick={() => onSelectTab('cases')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'cases'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>3. Симулятор кейсів</span>
            </button>

            <button
              id="tab-btn-signoff"
              onClick={() => onSelectTab('signoff')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'signoff'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${isSigned ? 'text-emerald-500' : ''}`} />
              <span>4. Лист ознайомлення</span>
              {isSigned && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>

            <button
              id="tab-btn-dashboard"
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Аналітика</span>
            </button>

            {user?.role === 'admin' && (
              <button
                id="tab-btn-management"
                onClick={() => onSelectTab('management')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                  currentTab === 'management'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'text-purple-700 bg-purple-50/70 border-purple-200 hover:bg-purple-100'
                }`}
                title="Завантажити або створити власний навчальний матеріал"
              >
                <Settings2 className="w-4 h-4" />
                <span>Керування тестами</span>
              </button>
            )}
          </nav>

          {/* Quick Progress Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-end gap-1.5">
                <span>Прогрес вивчення:</span>
                <span className="text-blue-600 font-bold">{readPercent}%</span>
              </div>
              <div className="w-28 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${readPercent}%` }}
                />
              </div>
            </div>

            <button
              id="btn-quick-quiz"
              onClick={() => onSelectTab(currentTab === 'quiz' ? 'catalog' : 'quiz')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition flex items-center gap-1.5"
            >
              {currentTab === 'quiz' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>До каталогу</span>
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Пройти тест</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Mobile Sub-Navigation */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-2 border-t border-slate-100 no-scrollbar">
          <button
            onClick={() => onSelectTab('catalog')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              currentTab === 'catalog' || currentTab === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Навчальні курси ({readCount}/{totalSections})
          </button>
          <button
            onClick={() => onSelectTab('quiz')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              currentTab === 'quiz' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            2. Тестування {bestScore !== null ? `(${bestScore}%)` : ''}
          </button>
          <button
            onClick={() => onSelectTab('cases')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              currentTab === 'cases' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            3. Кейси
          </button>
          <button
            onClick={() => onSelectTab('signoff')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              currentTab === 'signoff' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            4. Лист ознайомлення
          </button>
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              currentTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Аналітика
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => onSelectTab('management')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                currentTab === 'management' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}
            >
              Керування тестами
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
