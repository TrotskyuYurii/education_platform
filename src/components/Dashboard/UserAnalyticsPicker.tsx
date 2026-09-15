import React, { useState, useMemo } from 'react';
import { 
  Users, Search, ChevronDown, Check, Award,
  CheckCircle2, RefreshCw, X, User as UserIcon 
} from 'lucide-react';
import { UserListItem } from './types';

interface UserAnalyticsPickerProps {
  usersList: UserListItem[];
  selectedUserId: string | null;
  activeUser: any;
  currentUser: any;
  isLoadingUsers: boolean;
  isLoadingUserData: boolean;
  activeEmployeeFullName?: string;
  onSelectUser: (userId: string | null) => void;
  onRefreshList: () => void;
  onRefreshUserData: () => void;
}

export const UserAnalyticsPicker: React.FC<UserAnalyticsPickerProps> = ({
  usersList,
  selectedUserId,
  activeUser,
  currentUser,
  isLoadingUsers,
  isLoadingUserData,
  activeEmployeeFullName,
  onSelectUser,
  onRefreshList,
  onRefreshUserData,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [onlyWithCerts, setOnlyWithCerts] = useState(false);

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
      const matchesCert = !onlyWithCerts || (u.stats.certificatesCount > 0);
      return matchesSearch && matchesDept && matchesCert;
    });
  }, [usersList, searchQuery, deptFilter, onlyWithCerts]);

  const handleSelect = (userId: string | null) => {
    setIsPickerOpen(false);
    onSelectUser(userId);
  };

  return (
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

                  {/* Filter Chips */}
                  <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 text-[10px] scrollbar-none items-center">
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
                    <button
                      type="button"
                      onClick={() => setOnlyWithCerts(prev => !prev)}
                      className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition flex items-center gap-1 ${onlyWithCerts ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
                      title="Показати тільки співробітників із сертифікатами"
                    >
                      <Award className="w-3 h-3" />
                      <span>З сертифікатами ({usersList.filter(u => u.stats.certificatesCount > 0).length})</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="overflow-y-auto flex-1 divide-y divide-slate-50 py-1">
                  
                  {/* Option: Current user */}
                  <div
                    onClick={() => handleSelect(null)}
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
                          onClick={() => handleSelect(u.id || u._id)}
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
                                {u.stats.certificatesCount > 0 && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="shrink-0 inline-flex items-center gap-0.5 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px] font-bold">
                                      <Award className="w-2.5 h-2.5 text-amber-600" /> {u.stats.certificatesCount}
                                    </span>
                                  </>
                                )}
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
                      onRefreshList();
                      if (selectedUserId) onRefreshUserData();
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
            {activeEmployeeFullName && activeEmployeeFullName !== activeUser?.email && (
              <span className="text-slate-500">
                (ПІБ: <strong className="text-slate-700">{activeEmployeeFullName}</strong>)
              </span>
            )}
            <span className="text-slate-400">
              Підрозділ: {activeUser?.departments?.join(', ') || 'Загальний'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshUserData}
              disabled={isLoadingUserData}
              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-white rounded-lg transition"
              title="Оновити дані користувача"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUserData ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => handleSelect(null)}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline decoration-purple-300 underline-offset-2"
            >
              Скинути до моєї аналітики
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
