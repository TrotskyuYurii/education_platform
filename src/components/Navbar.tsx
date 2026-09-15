import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, CheckCircle2, Award, Briefcase, Sparkles, FileText, Settings2, Info, LogOut, ChevronDown, User, Search, Sun, Users, Bell } from 'lucide-react';
import { INSTRUCTION_DOCUMENT_META } from '../data/instructionData';
import { useAuth } from '../context/AuthContext';

export type AppTab = 'myday' | 'catalog' | 'manual' | 'quiz' | 'cases' | 'people' | 'signoff' | 'management' | 'dashboard' | 'about';

interface NavbarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenSearch?: () => void;
  onOpenNotificationSettings?: () => void;
  readCount: number;
  totalSections: number;
  bestScore: number | null;
  isSigned: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch,
  onOpenNotificationSettings,
  readCount,
  totalSections,
  bestScore,
  isSigned,
}) => {
  const { user, logout, canManage, primaryRoleLabel } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const clampedReadCount = Math.max(0, Math.min(readCount, totalSections));
  const readPercent = totalSections > 0 ? Math.round((clampedReadCount / totalSections) * 100) : 0;

  // Close dropdown when tapping or clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    await logout();
    window.location.reload();
  };

  const handleOpenProfile = () => {
    onSelectTab('signoff');
    setIsProfileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Meta */}
          <div 
            onClick={() => onSelectTab('myday')}
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
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                Навчальний портал
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5" id="nav-tabs">
            <button
              id="tab-btn-myday"
              onClick={() => onSelectTab('myday')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'myday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Мій день</span>
            </button>

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
              <span>Навчальні матеріали</span>
              <span className={`text-xs px-1.5 py-0.2 rounded-full ${
                currentTab === 'catalog' || currentTab === 'manual' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {clampedReadCount}/{totalSections}
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
              <span>Тестування (Квіз)</span>
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
              <span>Кейси</span>
            </button>

            <button
              id="tab-btn-people"
              onClick={() => onSelectTab('people')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                currentTab === 'people'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Люди</span>
            </button>

            {canManage && (
              <button
                id="tab-btn-management"
                onClick={() => onSelectTab('management')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                  currentTab === 'management'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'text-purple-700 bg-purple-50/70 border-purple-200 hover:bg-purple-100'
                }`}
                title="Адміністрування: матеріали, користувачі, оргструктура та ролі"
              >
                <Settings2 className="w-4 h-4" />
                <span>Адміністрування</span>
              </button>
            )}
          </nav>

          {/* Global Omnisearch Trigger Button */}
          {onOpenSearch && (
            <button
              id="global-search-trigger"
              onClick={onOpenSearch}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 hover:border-slate-300 transition flex items-center justify-center shadow-2xs group shrink-0"
              title="Швидкий глобальний пошук (⌘K або Ctrl+K)"
              aria-label="Швидкий глобальний пошук"
            >
              <Search className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition" />
            </button>
          )}

          {/* Quick Progress Badge & Profile Menu */}
          <div className="flex items-center gap-3 sm:gap-4" ref={profileMenuRef}>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-end gap-1.5">
                <span>Прогрес вивчення:</span>
                <span className="text-blue-600 font-bold">{readPercent}%</span>
              </div>
              <div className="w-24 sm:w-28 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${readPercent}%` }}
                />
              </div>
            </div>
            
            {/* Unified Profile & Logout Menu (Desktop & Mobile) */}
            <div className="relative">
              <button
                id="tab-btn-signoff-menu"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition border ${
                  currentTab === 'signoff' || isProfileMenuOpen
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
                title="Мій профіль та керування акаунтом"
                aria-expanded={isProfileMenuOpen}
              >
                <div className="relative">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    currentTab === 'signoff' || isProfileMenuOpen ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                  </div>
                  {isSigned && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                  )}
                </div>
                <span className="hidden sm:inline font-medium">Мій профіль</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Backdrop for Mobile */}
              {isProfileMenuOpen && (
                <div 
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs md:hidden"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
              )}

              {/* Submenu Popover Card */}
              {isProfileMenuOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full mt-2 w-72 sm:w-64 bg-white border border-slate-200 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="px-4 py-3 bg-gradient-to-br from-slate-50 to-blue-50/30 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-500 font-medium">Обліковий запис</p>
                        <p className="text-sm font-bold text-slate-900 truncate" title={user?.email || user?.username}>
                          {user?.fullName || user?.email || user?.username || 'Користувач'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        user?.role === 'admin' || user?.isAdmin || user?.roleKeys?.includes('admin') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {primaryRoleLabel || (user?.role === 'admin' ? 'Адміністратор' : 'Співробітник')}
                      </span>
                      {isSigned ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ознайомлено
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Потрібен підпис
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submenu Options */}
                  <div className="p-2 space-y-1">
                    <button
                      id="submenu-btn-signoff"
                      onClick={handleOpenProfile}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] ${
                        currentTab === 'signoff'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          currentTab === 'signoff' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="leading-tight">Підтвердження</div>
                          <div className="text-[11px] text-slate-400 font-normal">Електронний підпис і статус</div>
                        </div>
                      </div>
                      {isSigned && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
                      )}
                    </button>

                    <button
                      id="submenu-btn-dashboard"
                      onClick={() => {
                        onSelectTab('dashboard');
                        setIsProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] ${
                        currentTab === 'dashboard'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          currentTab === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="leading-tight">Профіль</div>
                          <div className="text-[11px] text-slate-400 font-normal">Прогрес, статистика та сертифікати</div>
                        </div>
                      </div>
                    </button>

                    {onOpenNotificationSettings && (
                      <button
                        id="submenu-btn-notification-settings"
                        onClick={() => {
                          onOpenNotificationSettings();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition min-h-[44px]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="leading-tight">Сповіщення</div>
                          <div className="text-[11px] text-slate-400 font-normal">Налаштування email-сповіщень</div>
                        </div>
                      </button>
                    )}

                    <button
                      id="submenu-btn-about"
                      onClick={() => {
                        onSelectTab('about');
                        setIsProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] ${
                        currentTab === 'about'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          currentTab === 'about' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Info className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="leading-tight">Про додаток</div>
                          <div className="text-[11px] text-slate-400 font-normal">Довідка, можливості та опис системи</div>
                        </div>
                      </div>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      id="submenu-btn-logout"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition min-h-[44px]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="leading-tight font-semibold">Вийти</div>
                        <div className="text-[11px] text-rose-400 font-normal">Завершити поточну сесію</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center overflow-x-auto border-t border-slate-100 py-1.5 gap-1.5 no-scrollbar">
          <button
            id="mobile-tab-btn-myday"
            onClick={() => onSelectTab('myday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
              currentTab === 'myday' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Мій день</span>
          </button>
          <button
            onClick={() => onSelectTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center ${
              currentTab === 'catalog' || currentTab === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Навчальні матеріали ({clampedReadCount}/{totalSections})
          </button>
          <button
            onClick={() => onSelectTab('quiz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center ${
              currentTab === 'quiz' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Тестування {bestScore !== null ? `(${bestScore}%)` : ''}
          </button>
          <button
            onClick={() => onSelectTab('cases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center ${
              currentTab === 'cases' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Кейси
          </button>
          <button
            id="mobile-tab-btn-people"
            onClick={() => onSelectTab('people')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
              currentTab === 'people' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Люди
          </button>
          {canManage && (
            <button
              onClick={() => onSelectTab('management')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[38px] flex items-center ${
                currentTab === 'management' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 font-semibold'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              Адміністрування
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
